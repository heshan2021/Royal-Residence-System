// pages/api/rooms.ts
// API endpoint to get all rooms with booking and payment information
import type { NextApiRequest, NextApiResponse } from 'next';
import { db, rooms, bookings, transactions, guests } from '../../src/db';
import { eq, and, sum, lte, lt, gte, isNull, or } from 'drizzle-orm';
import { parseDateOnly, sltDayBounds, sltToday } from '../../lib/hotelDates';

/**
 * Whole Sri Lankan days between two `YYYY-MM-DD` days (used for "overdue N days").
 */
function daysBetweenDays(fromDay: string, toDay: string): number {
  const [fy, fm, fd] = fromDay.split('-').map(Number);
  const [ty, tm, td] = toDay.split('-').map(Number);
  const from = Date.UTC(fy, fm - 1, fd);
  const to = Date.UTC(ty, tm - 1, td);
  return Math.max(0, Math.round((to - from) / 86_400_000));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Prevent Vercel edge caching - always fetch fresh data
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  try {
    // The day being viewed is always a Sri Lankan calendar day, because every
    // booking window is stored as the UTC instant of a hotel slot (14:00 / 11:00
    // Asia/Colombo). Defaults to today in Sri Lanka.
    const parsedViewDate = parseDateOnly(req.query.date ?? sltToday(), 'date');
    if (!parsedViewDate.ok) {
      return res.status(400).json({ error: parsedViewDate.error });
    }
    const viewDateOnly = parsedViewDate.value;
    const { start: targetDateStart, end: targetDateEnd } = sltDayBounds(viewDateOnly);

    // Get all rooms - use select instead of findMany to avoid automatic column selection
    const allRooms = await db.select({
      id: rooms.id,
      number: rooms.number,
      price: rooms.price,
      amenities: rooms.amenities,
      isOccupied: rooms.isOccupied,
      checkOutTime: rooms.checkOutTime,
      guestName: rooms.guestName,
      phoneNumber: rooms.phoneNumber,
      nicNumber: rooms.nicNumber,
      createdAt: rooms.createdAt,
      updatedAt: rooms.updatedAt,
    }).from(rooms).orderBy(rooms.number);

    /** Everything the dashboard needs to describe one folio (booking). */
    const folioSummary = async (booking: {
      id: number;
      guestId: number;
      totalPrice: number;
      checkInDate: Date;
      checkOutDate: Date | null;
    }) => {
      // Payments on a folio are always summed from the ledger.
      const paymentsResult = await db
        .select({ total: sum(transactions.amount) })
        .from(transactions)
        .where(eq(transactions.bookingId, booking.id));

      const guest = await db.query.guests.findFirst({
        where: eq(guests.id, booking.guestId),
      });

      const checkOutDate = booking.checkOutDate ?? null;
      return {
        bookingId: booking.id,
        guestName: guest?.name ?? undefined,
        phoneNumber: guest?.phoneNumber ?? undefined,
        nicNumber: guest?.nicNumber ?? undefined,
        totalAmount: Number(booking.totalPrice) || 0,
        paidAmount: Number(paymentsResult[0]?.total) || 0,
        // Scheduled departure day -> how long the folio has been left open.
        overdueDays: checkOutDate
          ? daysBetweenDays(sltToday(checkOutDate), viewDateOnly)
          : 0,
        checkOutTime: checkOutDate ? checkOutDate.toISOString() : null,
        // The booked window, as the reservation card needs it.
        checkInTime: booking.checkInDate.toISOString(),
        nights: checkOutDate
          ? Math.max(1, daysBetweenDays(sltToday(booking.checkInDate), sltToday(checkOutDate)))
          : 0,
      };
    };

    // For each room, check if it is occupied on the target date
    const roomsWithPayments = await Promise.all(
      allRooms.map(async (room) => {
        // A room is "Occupied" on targetDate IF there is a booking where check_out_date > end of target day
        // A room is "Due Out" on targetDate IF there is a booking where check_out_date is within the target date
        const activeBookingsOnDate = await db.query.bookings.findMany({
          where: and(
            eq(bookings.roomId, room.id),
            eq(bookings.status, 'active'),
            lte(bookings.checkInDate, targetDateEnd), // check_in_date <= end of target day
            or(
              gte(bookings.checkOutDate, targetDateStart), // MUST be greater than or equal to start of target day
              isNull(bookings.checkOutDate) // OR check_out_date IS NULL
            )
          ),
          orderBy: (bookings, { asc }) => [asc(bookings.checkInDate)],
        });

        // Unclosed folios: still `active`, but the stay window ended BEFORE the day
        // being viewed. Left unchecked these rows vanished from the dashboard, so the
        // money they owe could never be collected. They now keep the room on the grid
        // as "Not Checked Out" until the folio is settled and closed.
        const unclosedBookings = await db.query.bookings.findMany({
          where: and(
            eq(bookings.roomId, room.id),
            eq(bookings.status, 'active'),
            lt(bookings.checkOutDate, targetDateStart) // window ended before this day
          ),
          // Oldest first: the longest-standing debt is the one on the card.
          orderBy: (bookings, { asc }) => [asc(bookings.checkInDate)],
        });

        // A booking only occupies the room once its guest has arrived: an
        // `active` booking whose `checkedInAt` is still NULL is a RESERVATION -
        // sold for that night, but with nobody in the room yet.
        const arrivingBookings = activeBookingsOnDate.filter(b => b.checkedInAt);
        const reservationBookings = activeBookingsOnDate.filter(b => !b.checkedInAt);

        // Find if we have a departing guest and/or a staying guest
        const departingBooking = arrivingBookings.find(b => b.checkOutDate && b.checkOutDate <= targetDateEnd);
        const stayingBooking = arrivingBookings.find(b => !b.checkOutDate || b.checkOutDate > targetDateEnd);

        // The reservation covering the day being viewed. A no-show for a day
        // that already passed is deliberately not listed here: it still owes
        // money, so it surfaces as an unclosed folio instead.
        const reservationOnDate = reservationBookings.find(
          b => b.checkOutDate === null || b.checkOutDate > targetDateStart
        ) || null;

        // Prioritize departing booking so the receptionist can process their
        // checkout folio, then the arriving reservation, then the oldest
        // unclosed folio.
        let activeBookingOnDate = departingBooking || stayingBooking;

        if (!activeBookingOnDate) {
          activeBookingOnDate = reservationOnDate || unclosedBookings[0];
        }

        // A reserved room is sold but empty, so it must never read as "Occupied".
        const isReserved = !!activeBookingOnDate && activeBookingOnDate === reservationOnDate;

        const isOverdue = !isReserved
          && !!activeBookingOnDate
          && !!activeBookingOnDate.checkOutDate
          && activeBookingOnDate.checkOutDate < targetDateStart;

        const summary = activeBookingOnDate
          ? await folioSummary(activeBookingOnDate)
          : null;

        // Any other unclosed folio on this room stays visible too (it is settled
        // from the room's own check-out view once the card's folio is closed).
        const openFolios = [];
        for (const booking of unclosedBookings) {
          if (summary && booking.id === summary.bookingId) continue;
          const folio = await folioSummary(booking);
          openFolios.push({
            bookingId: folio.bookingId,
            guestName: folio.guestName ?? null,
            totalAmount: folio.totalAmount,
            paidAmount: folio.paidAmount,
            checkOutDate: folio.checkOutTime,
            overdueDays: folio.overdueDays,
          });
        }

        // Further reservations covering the viewed day. Only one is shown as the
        // room's own state: while a guest is still in the room, that guest owns
        // the card and the arriving reservation is listed underneath it.
        const reservationsOnDay = [];
        for (const reservation of reservationBookings) {
          if (summary && reservation.id === summary.bookingId) continue;
          const folio = await folioSummary(reservation);
          reservationsOnDay.push({
            bookingId: folio.bookingId,
            guestName: folio.guestName ?? null,
            checkInDate: folio.checkInTime,
            checkOutDate: folio.checkOutTime,
            nights: folio.nights,
            totalAmount: folio.totalAmount,
            paidAmount: folio.paidAmount,
          });
        }

        return {
          id: `room-${room.number}`,
          number: room.number,
          price: room.price ? parseFloat(room.price) : null,
          amenities: room.amenities || [],
          isOccupied: !!summary && !isReserved,
          isReserved,
          reserved: isReserved && summary
            ? {
                bookingId: summary.bookingId,
                guestName: summary.guestName ?? null,
                checkInDate: summary.checkInTime,
                checkOutDate: summary.checkOutTime,
                nights: summary.nights,
                totalAmount: summary.totalAmount,
                paidAmount: summary.paidAmount,
              }
            : undefined,
          reservationsOnDay,
          isDueOut: !!departingBooking,
          isOverdue,
          overdueDays: isOverdue && summary ? summary.overdueDays : undefined,
          bookingId: summary?.bookingId,
          openFolios,
          guestName: summary?.guestName,
          phoneNumber: summary?.phoneNumber,
          nicNumber: summary?.nicNumber,
          checkOutTime: summary ? (summary.checkOutTime ?? 'Long-term') : undefined,
          totalAmount: summary?.totalAmount ?? 0,
          paidAmount: summary?.paidAmount ?? 0,
        };
      })
    );

    return res.status(200).json(roomsWithPayments);
  } catch (error) {
    console.error('Error fetching rooms:', error);
    
    // Provide more helpful error messages
    let errorMessage = 'Database error';
    if (error instanceof Error) {
      if (error.message.includes('NEON_DATABASE_URL')) {
        errorMessage = 'Database connection not configured. Please set NEON_DATABASE_URL environment variable.';
      } else if (error.message.includes('relation') || error.message.includes('table')) {
        errorMessage = 'Database tables not found. Please run database migrations.';
      } else {
        errorMessage = error.message;
      }
    }
    
    return res.status(500).json({ 
      error: errorMessage,
      details: error instanceof Error ? error.stack : 'Unknown error'
    });
  }
}
