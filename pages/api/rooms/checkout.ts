// pages/api/rooms/checkout.ts
// Check a guest out of a room, optionally as an EARLY DEPARTURE.
//
// Fixes applied here:
//  B2  - the booking to close is chosen by the DATE WINDOW being viewed, not by
//        "first active booking for the room" (which used to close stale rows).
//  E-4 - the departure is stamped with the hotel check-out slot (11:00 SLT) of
//        the viewed day instead of `new Date()`, which created phantom stays.
//  B29 - a folio left open past its stay is still reachable: the booking is
//        resolved from an explicit `bookingId`, the day being viewed, or the
//        room's most recent UNCLOSED folio (an `active` booking whose window
//        already ended). Such a folio is stamped with its OWN scheduled
//        check-out slot, so closing it late never stretches the stay.
//  B16 - early departure re-prices the folio for the nights actually consumed.
//  B17 - an over-payment caused by early departure is recorded as a refund row.
//  D13 - a scheduled check-out is refused while the folio still owes money; an
//        EARLY departure may close with a residual debt (the room must be
//        released for re-sale) which is reported as `outstandingBalance`.
//  E-6 - room flags are re-derived from bookings instead of blanket-nulled.

import type { NextApiRequest, NextApiResponse } from 'next';
import { and, eq, gte, isNull, lt, lte, or } from 'drizzle-orm';
import { db, rooms, bookings, transactions } from '../../../src/db';
import {
  formatHotelDate,
  hotelSlotInstant,
  nightsBetween,
  parseDateOnly,
  priceForNights,
  sltDayBounds,
  sltToday,
} from '../../../lib/hotelDates';
import { reconcileRoom } from '../../../lib/roomState';

interface CheckOutRequest {
  roomNumber: string;
  date?: string; // calendar day being viewed, 'YYYY-MM-DD' (defaults to today SLT)
  bookingId?: number; // the exact folio to close (a dashboard card knows its own id)
  finalPayment?: number;
  paymentMethod?: 'Cash' | 'Bank';
  earlyDeparture?: boolean; // guest leaves before their booked check-out date
}

const PAYMENT_METHODS = ['Cash', 'Bank'];

function asTrimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asMoney(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return 0;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = (req.body ?? {}) as CheckOutRequest;

    // ---------------------------------------------------------------- validation
    const roomNumber = asTrimmed(body.roomNumber);
    if (!roomNumber) {
      return res.status(400).json({ error: 'roomNumber is required' });
    }

    const parsedDate = parseDateOnly(body.date ?? sltToday(), 'date');
    if (!parsedDate.ok) {
      return res.status(400).json({ error: parsedDate.error });
    }
    const viewDate = parsedDate.value;
    const earlyDeparture = body.earlyDeparture === true;

    // 1. Find the room
    const room = await db.query.rooms.findFirst({
      where: eq(rooms.number, roomNumber),
    });

    if (!room) {
      return res.status(404).json({ error: `Room ${roomNumber} not found` });
    }

    // 2. Find the folio to close. Occupancy is derived from bookings -
    //    `rooms.is_occupied` is only a cache.
    //
    //    Resolution order:
    //      a) the exact folio the dashboard asked for (`bookingId`),
    //      b) the booking that covers the day being viewed,
    //      c) the room's most recent UNCLOSED folio - an `active` booking whose
    //         stay window already ended. Without (c) those folios were unreachable
    //         on every later day, so the money they owe could never be collected.
    const dayBounds = sltDayBounds(viewDate);

    const requestedBookingId = Number(body.bookingId);
    const hasRequestedBookingId = Number.isInteger(requestedBookingId) && requestedBookingId > 0;

    const requestedBooking = hasRequestedBookingId
      ? await db.query.bookings.findFirst({
          where: and(
            eq(bookings.id, requestedBookingId),
            eq(bookings.roomId, room.id),
            eq(bookings.status, 'active')
          ),
        })
      : null;

    if (hasRequestedBookingId && !requestedBooking) {
      return res.status(404).json({
        error: `Booking ${requestedBookingId} is not an active booking for room ${roomNumber}`,
      });
    }

    const dayBooking = requestedBooking
      ? null
      : await db.query.bookings.findFirst({
          where: and(
            eq(bookings.roomId, room.id),
            eq(bookings.status, 'active'),
            lte(bookings.checkInDate, dayBounds.end),
            or(isNull(bookings.checkOutDate), gte(bookings.checkOutDate, dayBounds.start))
          ),
          orderBy: (bookings, { desc: descOrder }) => [descOrder(bookings.checkInDate)],
        });

    const booking = requestedBooking ?? dayBooking ?? await db.query.bookings.findFirst({
      where: and(
        eq(bookings.roomId, room.id),
        eq(bookings.status, 'active'),
        lt(bookings.checkOutDate, dayBounds.start) // stay window ended before this day
      ),
      orderBy: (bookings, { desc: descOrder }) => [descOrder(bookings.checkInDate)],
    });

    if (!booking) {
      return res.status(404).json({
        error: `Room ${roomNumber} has no active booking covering ${viewDate}`,
      });
    }

    // 3. Determine the departure instant (hotel check-out slot).
    //    Normal case: the 11:00 slot of the day being viewed.
    //    Unclosed folio: its OWN scheduled check-out slot, so closing a stale folio
    //    days later never stretches the stay (and never inflates its total).
    const scheduledCheckOutDay = booking.checkOutDate ? sltToday(booking.checkOutDate) : null;
    const folioWasOverdue = scheduledCheckOutDay !== null && scheduledCheckOutDay < viewDate;

    let departureInstant = folioWasOverdue
      ? hotelSlotInstant(scheduledCheckOutDay as string, 'check-out')
      : hotelSlotInstant(viewDate, 'check-out');

    if (departureInstant < booking.checkInDate) {
      // Guest only arrived today, after the 11:00 check-out slot: a same-day
      // departure cannot be stamped earlier than the arrival.
      departureInstant = booking.checkInDate;
    }

    const bookedNights = booking.checkOutDate
      ? nightsBetween(booking.checkInDate, booking.checkOutDate)
      : null;

    if (earlyDeparture && bookedNights === null) {
      return res.status(400).json({
        error: 'Long-term stays cannot be marked as an early departure',
        details: 'This booking has no scheduled check-out date; it is simply settled and closed',
      });
    }

    // 4. Work out the folio: what has been paid, and what the stay is now worth.
    const paymentRows = await db
      .select({ amount: transactions.amount })
      .from(transactions)
      .where(eq(transactions.bookingId, booking.id));
    const paidBefore = paymentRows.reduce((sum, row) => sum + Number(row.amount), 0);

    const finalPayment = asMoney(body.finalPayment);
    if (finalPayment === null || finalPayment < 0) {
      return res.status(400).json({ error: 'finalPayment must be zero or a positive number' });
    }
    if (finalPayment > 0 && !PAYMENT_METHODS.includes(body.paymentMethod as string)) {
      return res.status(400).json({
        error: 'paymentMethod is required when a final payment is recorded',
        details: 'Expected "Cash" or "Bank"',
      });
    }

    let nights = bookedNights ?? nightsBetween(booking.checkInDate, departureInstant);
    let total = Number(booking.totalPrice);
    let earlyDepartureApplied = false;

    if (earlyDeparture && bookedNights !== null) {
      const actualNights = nightsBetween(booking.checkInDate, departureInstant);
      if (actualNights >= bookedNights) {
        return res.status(400).json({
          error: 'Not an early departure',
          details: `${actualNights} night(s) is the full booked stay, which ends ${formatHotelDate(booking.checkOutDate as Date)}`,
        });
      }
      nights = actualNights;
      total = priceForNights(Number(booking.totalPrice), bookedNights, actualNights);
      earlyDepartureApplied = true;
    }

    const collected = paidBefore + finalPayment;
    const outstanding = total - collected;
    const refundDue = outstanding < 0 ? -outstanding : 0;

    // 5. A scheduled check-out may not close a folio that still owes money (D13) -
    //    the receptionist collects the balance first.
    //    An EARLY departure is different: the guest is already leaving and the
    //    room has to be released for re-sale, so the stay is closed at the
    //    re-priced amount and anything still owed stays on the completed folio
    //    (reported as `outstandingBalance`) instead of blocking the room.
    //    Money is never silently discarded.
    const uncollected = outstanding > 0 ? outstanding : 0;
    if (uncollected > 0 && !earlyDepartureApplied) {
      return res.status(400).json({
        error: 'Outstanding balance must be settled before check-out',
        details: `LKR ${uncollected.toLocaleString()} is still due on this booking`,
        balance: uncollected,
        totalAmount: total,
        paidAmount: paidBefore,
      });
    }

    // 6. Record the money movements, then close the booking.
    if (finalPayment > 0 && body.paymentMethod) {
      await db.insert(transactions).values({
        bookingId: booking.id,
        amount: finalPayment,
        paymentMethod: body.paymentMethod,
        paymentType: 'final_settlement',
      });
    }

    if (refundDue > 0) {
      // An early departure can leave the guest in credit. A negative row keeps
      // the ledger's net revenue equal to the re-priced folio.
      await db.insert(transactions).values({
        bookingId: booking.id,
        amount: -refundDue,
        paymentMethod: body.paymentMethod ?? 'Cash',
        paymentType: 'refund',
      });
    }

    if (uncollected > 0) {
      // Early departure with money still owed: log it so the debt is traceable.
      console.warn(
        `Early departure left LKR ${uncollected} unpaid on booking ${booking.id} (room ${roomNumber})`
      );
    }

    const [updatedBooking] = await db
      .update(bookings)
      .set({
        status: 'completed',
        checkOutDate: departureInstant,
        totalPrice: total,
      })
      .where(eq(bookings.id, booking.id))
      .returning();

    // 7. Refresh the room's occupancy cache from the bookings table (E-6).
    await reconcileRoom(room.id);
    const updatedRoom = await db.query.rooms.findFirst({ where: eq(rooms.id, room.id) });

    return res.status(200).json({
      success: true,
      room: updatedRoom ?? room,
      booking: updatedBooking,
      nights,
      bookedNights,
      earlyDeparture: earlyDepartureApplied,
      totalAmount: total,
      paidAmount: collected,
      refundDue,
      outstandingBalance: uncollected,
      settled: uncollected === 0,
      wasOverdue: folioWasOverdue,
      message: earlyDepartureApplied
        ? `Room ${roomNumber} early departure: ${nights} night(s) charged, LKR ${total.toLocaleString()}${
            uncollected > 0 ? ` (LKR ${uncollected.toLocaleString()} still owed)` : ''
          }`
        : folioWasOverdue
          ? `Room ${roomNumber} checked out successfully (unclosed folio from ${formatHotelDate(booking.checkOutDate as Date)} settled)`
          : `Room ${roomNumber} checked out successfully`,
    });

  } catch (error) {
    console.error('Check-out error:', error);
    return res.status(500).json({ 
      error: 'Failed to process check-out',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
