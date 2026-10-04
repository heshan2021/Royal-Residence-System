// pages/api/rooms/checkin.ts
// API endpoint for checking in a guest
// Creates booking, records advance payment, and updates room status
//
// RESERVATIONS (Phase 2)
//  `reserve: true` books the room for a guest who has not arrived yet. The
//  booking is identical in every accounting sense - same overlap rule, same
//  server-side price, same advance payment - except that `checked_in_at` stays
//  NULL, which is what marks it as RESERVED rather than occupied. The guest is
//  checked in later through POST /api/bookings/[bookingId]/checkin.
//
// CONFIRMED OVERLAP ("book anyway")
//  When the only clash is the guest who is in the room right now and the new
//  stay begins today, the desk may acknowledge it: `overlapAcknowledgement`
//  records that guest's EARLY DEPARTURE (the stay is cut to today's 11:00 slot,
//  re-priced for the nights actually used, over-payment refunded) and then
//  reserves the room for the arriving guest. The shortened folio stays `active`
//  so it keeps demanding its own check-out until it is settled - and, crucially,
//  the night is never sold twice. A future booking can never be acknowledged.

import type { NextApiRequest, NextApiResponse } from 'next';
import { eq, and, or, lt, gt, isNull, asc } from 'drizzle-orm';
import { db, rooms, guests, bookings, transactions, type Booking } from '../../../src/db';
import {
  CHECK_IN_HOUR_SLT,
  CHECK_OUT_HOUR_SLT,
  formatHotelDate,
  hotelSlotInstant,
  nightsBetween,
  parseDateOnly,
  priceForNights,
  sltToday,
} from '../../../lib/hotelDates';
import { reconcileRoom } from '../../../lib/roomState';

interface CheckInRequest {
  roomNumber: string;
  guestName: string;
  phoneNumber: string;
  nicNumber: string;
  checkInDate: string; // 'YYYY-MM-DD', or an ISO instant converted to its SLT date
  checkOutDate: string; // 'YYYY-MM-DD', or an ISO instant converted to its SLT date
  totalAmount?: number; // when supplied it must equal the server-computed price
  advancePayment?: number;
  paymentMethod?: 'Cash' | 'Bank';
  reserve?: boolean; // true = hold the room for a guest who has not arrived yet
  overlapAcknowledgement?: {
    // The folio to cut short because its guest is checking out today.
    incumbentBookingId?: unknown;
    reason?: unknown;
  };
}

// FIX (B3/B13/B14/B15): every field below is now validated before any write.
const PAYMENT_METHODS = ['Cash', 'Bank'];
const MAX_NAME = 100;
const MAX_PHONE = 20;
const MAX_NIC = 30;
// The guest has to be in the room now for their departure to be acknowledged,
// and a today-turnaround always frees the room at the 11:00 check-out slot.
const DEFAULT_REFUND_METHOD = 'Cash';

/** The clash a "book anyway" would override, as reported back to the form. */
interface OverlapInfo {
  bookingId: number;
  guestName: string | null;
  checkInDate: string;      // ISO instant of the conflicting arrival slot
  checkOutDate: string | null;
  inHouse: boolean;         // The conflicting guest is in the room right now
  canAcknowledge: boolean;  // The desk may confirm their early departure today
}

/** The incumbent folio as it looks after a confirmed early departure. */
interface ShortenedFolio {
  bookingId: number;
  guestName: string | null;
  checkInDate: string;
  checkOutDate: string;
  nights: number;           // Nights actually used, and therefore charged
  bookedNights: number;
  previousTotal: number;
  totalAmount: number;      // Re-priced total
  paidAmount: number;
  refunded: number;
  outstandingBalance: number;
}

function asTrimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Parse a monetary field. Returns null when the value is not a finite number. */
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
    const body = (req.body ?? {}) as CheckInRequest;

    // ---------------------------------------------------------------- validation
    const roomNumber = asTrimmed(body.roomNumber);
    const guestName = asTrimmed(body.guestName);
    const phoneNumber = asTrimmed(body.phoneNumber);
    const nicNumber = asTrimmed(body.nicNumber);

    if (!roomNumber) {
      return res.status(400).json({ error: 'roomNumber is required' });
    }
    if (!guestName) {
      return res.status(400).json({ error: 'Guest name is required' });
    }
    if (guestName.length > MAX_NAME) {
      return res.status(400).json({ error: `Guest name must be ${MAX_NAME} characters or fewer` });
    }
    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required' });
    }
    if (phoneNumber.length > MAX_PHONE) {
      return res.status(400).json({ error: `Phone number must be ${MAX_PHONE} characters or fewer` });
    }
    if (!nicNumber) {
      return res.status(400).json({ error: 'NIC number is required' });
    }
    if (nicNumber.length > MAX_NIC) {
      return res.status(400).json({ error: `NIC number must be ${MAX_NIC} characters or fewer` });
    }

    const inDate = parseDateOnly(body.checkInDate, 'checkInDate');
    if (!inDate.ok) {
      return res.status(400).json({ error: inDate.error });
    }
    const outDate = parseDateOnly(body.checkOutDate, 'checkOutDate');
    if (!outDate.ok) {
      return res.status(400).json({ error: outDate.error });
    }
    if (outDate.value <= inDate.value) {
      return res.status(400).json({
        error: 'Check-out date must be after check-in date',
        details: `Check-in is ${CHECK_IN_HOUR_SLT}:00 and check-out is ${CHECK_OUT_HOUR_SLT}:00, so a stay of zero nights is not possible`,
      });
    }

    // Standardize hotel times: Check-in at 14:00, Check-out at 11:00 (Asia/Colombo)
    const standardizedCheckIn = hotelSlotInstant(inDate.value, 'check-in');
    const standardizedCheckOut = hotelSlotInstant(outDate.value, 'check-out');
    const nights = nightsBetween(standardizedCheckIn, standardizedCheckOut);

    // 1. Find the room first: the stay is priced from the server-side rate, never
    //    from a client-supplied total.
    const room = await db.query.rooms.findFirst({
      where: eq(rooms.number, roomNumber),
    });

    if (!room) {
      return res.status(404).json({ error: `Room ${roomNumber} not found` });
    }

    const roomRate = Number(room.price);
    if (!Number.isFinite(roomRate) || roomRate <= 0) {
      return res.status(500).json({ error: `Room ${roomNumber} has no valid nightly rate configured` });
    }
    const serverTotal = roomRate * nights;

    const clientTotal = asMoney(body.totalAmount);
    if (clientTotal === null || clientTotal < 0) {
      return res.status(400).json({ error: 'totalAmount must be zero or a positive number' });
    }
    if (body.totalAmount !== undefined && clientTotal !== serverTotal) {
      return res.status(400).json({
        error: 'Total amount does not match the room rate',
        details: `${nights} night(s) at LKR ${roomRate.toLocaleString()} = LKR ${serverTotal.toLocaleString()}`,
      });
    }

    const advancePayment = asMoney(body.advancePayment);
    if (advancePayment === null || advancePayment < 0) {
      return res.status(400).json({ error: 'advancePayment must be zero or a positive number' });
    }
    if (advancePayment > serverTotal) {
      return res.status(400).json({
        error: 'Advance payment cannot exceed the total amount',
        details: `Advance of LKR ${advancePayment.toLocaleString()} on a LKR ${serverTotal.toLocaleString()} stay`,
      });
    }
    if (advancePayment > 0 && !PAYMENT_METHODS.includes(body.paymentMethod as string)) {
      return res.status(400).json({
        error: 'paymentMethod is required when an advance payment is recorded',
        details: 'Expected "Cash" or "Bank" - without it the advance would never reach the ledger',
      });
    }
    const paymentMethod = body.paymentMethod;

    // 2. Find or create guest
    let guest = await db.query.guests.findFirst({
      where: eq(guests.nicNumber, nicNumber),
    });

    if (!guest) {
      // Create new guest
      const [newGuest] = await db.insert(guests).values({
        name: guestName,
        phoneNumber: phoneNumber,
        nicNumber: nicNumber,
      }).returning();
      guest = newGuest;
    } else {
      // Update existing guest's name and phone if they've changed
      // This ensures the transaction ledger shows the current guest name
      if (guest.name !== guestName || guest.phoneNumber !== phoneNumber) {
        const [updatedGuest] = await db.update(guests)
          .set({
            name: guestName,
            phoneNumber: phoneNumber,
            updatedAt: new Date(),
          })
          .where(eq(guests.id, guest.id))
          .returning();
        guest = updatedGuest;
      }
    }

    // Check for overlapping bookings (double booking prevention)
    // Find any active booking that overlaps with the requested dates
    // Two date ranges [A1, A2] and [B1, B2] overlap if: A1 < B2 AND A2 > B1
    // We check all cases to ensure proper overlap detection including future bookings
    console.log("Checking overlap for:", { newCheckIn: standardizedCheckIn.toISOString(), newCheckOut: standardizedCheckOut.toISOString() });
    
    const conflictingBookings = await db.query.bookings.findMany({
      where: and(
        eq(bookings.roomId, room.id),
        eq(bookings.status, 'active'),
        or(
          // Case 1: Standard overlaps (both bookings have check-out dates)
          // Existing booking overlaps if: existing_checkIn < new_checkOut AND existing_checkOut > new_checkIn
          and(
            lt(bookings.checkInDate, standardizedCheckOut),
            gt(bookings.checkOutDate, standardizedCheckIn)
          ),
          // Case 2: Existing booking is long-term (no check-out date) - conflicts if new booking doesn't end before it starts
          and(
            lt(bookings.checkInDate, standardizedCheckOut),
            isNull(bookings.checkOutDate)
          ),
          // Case 3: New booking would overlap with a future booking
          // (existing booking starts during or after new booking's period but before new checkout)
          and(
            gt(bookings.checkInDate, standardizedCheckIn),
            lt(bookings.checkInDate, standardizedCheckOut)
          )
        )
      ),
      // Oldest first, so the folio that gets named is always the same one.
      orderBy: (bookings, { asc: ascOrder }) => [ascOrder(bookings.checkInDate)],
    });

    // A reservation is an `active` booking whose guest has not arrived yet.
    const reserve = body.reserve === true;
    const now = new Date();
    const todaySLT = sltToday();
    // A "book anyway" is only ever a today-turnaround: the room is handed over
    // this afternoon, never weeks from now.
    const arrivesToday = sltToday(standardizedCheckIn) === todaySLT;

    let overlapInfo: OverlapInfo | null = null;
    let acknowledgedIncumbent: Booking | null = null;

    if (conflictingBookings.length > 0) {
      const conflict = conflictingBookings[0];
      const conflictGuest = await db.query.guests.findFirst({ where: eq(guests.id, conflict.guestId) });

      // What the desk may override: exactly ONE conflict, and that conflict is
      // the guest who has actually ARRIVED and is in the room right now - never
      // somebody else's future booking, and never a reservation whose own guest
      // has not turned up yet. It needs a real check-out date we can re-price,
      // and their stay must have begun on an earlier day: there is only
      // something to end early if the guest is not due in *today*. It can only
      // happen while reserving, because the current guest is still in the room.
      const inHouse = conflict.checkedInAt !== null && conflict.checkInDate <= now;
      const todayCheckOutSlot = hotelSlotInstant(todaySLT, 'check-out');
      const canAcknowledge =
        reserve &&
        conflictingBookings.length === 1 &&
        inHouse &&
        conflict.checkInDate < todayCheckOutSlot &&
        arrivesToday &&
        conflict.checkOutDate !== null;

      overlapInfo = {
        bookingId: conflict.id,
        guestName: conflictGuest ? conflictGuest.name : null,
        checkInDate: conflict.checkInDate.toISOString(),
        checkOutDate: conflict.checkOutDate ? conflict.checkOutDate.toISOString() : null,
        inHouse,
        canAcknowledge,
      };

      const ack = body.overlapAcknowledgement;
      const ackId = ack ? Number(ack.incumbentBookingId) : NaN;

      if (canAcknowledge && Number.isInteger(ackId) && ackId === conflict.id) {
        // Confirmed: this guest is leaving today (see step 2b below).
        acknowledgedIncumbent = conflict;
      } else {
        let errorMessage = `Room ${roomNumber} is already booked`;

        if (conflict.checkOutDate) {
          errorMessage += ` from ${formatHotelDate(conflict.checkInDate)} to ${formatHotelDate(conflict.checkOutDate)}`;
        } else {
          errorMessage += ` from ${formatHotelDate(conflict.checkInDate)} (long-term stay, no check-out date)`;
        }

        return res.status(400).json({
          error: errorMessage,
          details: canAcknowledge
            ? `If ${(overlapInfo as OverlapInfo).guestName ?? 'the current guest'} is leaving today, confirm the early departure to reserve the room from today`
            : 'Please select different dates or a different room',
          overlap: overlapInfo,
        });
      }
    }

    // 2b. Confirmed overlap: the guest in the room is leaving today, so their
    //     booked stay is cut to today's 11:00 check-out slot. The folio is
    //     re-priced for the nights actually used and any over-payment is
    //     refunded right here, while the folio itself stays `active`: it still
    //     has to be collected and closed at the desk. Leaving it untouched would
    //     put two active bookings on tonight and sell the same night twice.
    let shortened: ShortenedFolio | null = null;
    if (acknowledgedIncumbent) {
      const departureSlot = hotelSlotInstant(todaySLT, 'check-out');
      const bookedNights = nightsBetween(
        acknowledgedIncumbent.checkInDate,
        acknowledgedIncumbent.checkOutDate as Date
      );
      const actualNights = nightsBetween(acknowledgedIncumbent.checkInDate, departureSlot);

      // A departure that lands at (or before) the guest's own arrival instant is
      // not a shortening at all - their stay begins today, so there is nothing to
      // end early and no nights to refund. `canAcknowledge` already refuses this;
      // it is re-tested here because the whole folio rewrite hangs off it.
      if (
        acknowledgedIncumbent.checkInDate >= departureSlot ||
        actualNights >= bookedNights
      ) {
        return res.status(400).json({
          error: `The stay on room ${roomNumber} cannot be shortened to today`,
          details: acknowledgedIncumbent.checkInDate >= departureSlot
            ? `That guest is due in today (${formatHotelDate(acknowledgedIncumbent.checkInDate)}) and still has the room - they cannot be checked out before they arrive`
            : `It is booked for ${bookedNights} night(s) from ${formatHotelDate(acknowledgedIncumbent.checkInDate)} - check that guest out normally instead`,
          overlap: { ...(overlapInfo as OverlapInfo), canAcknowledge: false },
        });
      }

      const paidSoFar = (
        await db
          .select({ amount: transactions.amount })
          .from(transactions)
          .where(eq(transactions.bookingId, acknowledgedIncumbent.id))
      ).reduce((total, row) => total + Number(row.amount), 0);

      const previousTotal = Number(acknowledgedIncumbent.totalPrice);
      const rePricedTotal = priceForNights(previousTotal, bookedNights, actualNights);
      const refundDue = Math.max(0, paidSoFar - rePricedTotal);

      if (refundDue > 0) {
        // Money already collected for nights the guest will not use. A negative
        // row keeps SUM(transactions.amount) equal to the re-priced folio.
        await db.insert(transactions).values({
          bookingId: acknowledgedIncumbent.id,
          amount: -refundDue,
          paymentMethod: DEFAULT_REFUND_METHOD,
          paymentType: 'refund',
        });
      }

      await db
        .update(bookings)
        .set({ checkOutDate: departureSlot, totalPrice: rePricedTotal })
        .where(eq(bookings.id, acknowledgedIncumbent.id));

      shortened = {
        bookingId: acknowledgedIncumbent.id,
        guestName: overlapInfo ? (overlapInfo as OverlapInfo).guestName : null,
        checkInDate: acknowledgedIncumbent.checkInDate.toISOString(),
        checkOutDate: departureSlot.toISOString(),
        nights: actualNights,
        bookedNights,
        previousTotal,
        totalAmount: rePricedTotal,
        paidAmount: paidSoFar,
        refunded: refundDue,
        outstandingBalance: Math.max(0, rePricedTotal - paidSoFar),
      };

      console.warn(
        `Confirmed overlap on room ${roomNumber}: folio ${shortened.bookingId} (${shortened.guestName || 'guest'}) shortened to ${todaySLT} 11:00 - ${actualNights}/${bookedNights} night(s), LKR ${rePricedTotal} charged, LKR ${refundDue} refunded`
      );
    }

    // 3. Create booking record with standardized hotel times and server pricing.
    //    `checkedInAt` is what separates a stay from a reservation: NULL means
    //    the guest has not arrived, so the room is sold but still empty.
    const [booking] = await db.insert(bookings).values({
      guestId: guest.id,
      roomId: room.id,
      checkInDate: standardizedCheckIn,
      checkOutDate: standardizedCheckOut,
      totalPrice: serverTotal,
      status: 'active',
      checkedInAt: reserve ? null : now,
    }).returning();

    // 4. Record the advance payment
    if (advancePayment > 0 && paymentMethod) {
      await db.insert(transactions).values({
        bookingId: booking.id,
        amount: advancePayment,
        paymentMethod: paymentMethod,
        paymentType: 'advance',
      });
    }

    // 5. Refresh the room's occupancy cache from the bookings table (E-6)
    await reconcileRoom(room.id);
    const updatedRoom = await db.query.rooms.findFirst({ where: eq(rooms.id, room.id) });

    return res.status(200).json({
      success: true,
      room: updatedRoom ?? { ...room, isOccupied: !reserve, checkOutTime: standardizedCheckOut },
      booking,
      reserved: reserve,
      nights,
      totalAmount: serverTotal,
      paidAmount: advancePayment,
      // Present only when an incumbent guest's stay was cut short to free the room.
      overlapAcknowledged: shortened ?? undefined,
      message: reserve
        ? `Room ${roomNumber} reserved for ${guestName} from ${formatHotelDate(standardizedCheckIn)} to ${formatHotelDate(standardizedCheckOut)} - ${nights} night(s), guest has not arrived yet`
        : `Guest ${guestName} checked into room ${roomNumber} for ${nights} night(s)`,
    });

  } catch (error) {
    console.error('Check-in error:', error);
    return res.status(500).json({ 
      error: 'Failed to process check-in',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
