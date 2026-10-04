// pages/api/bookings/[bookingId]/checkin.ts
// Checks in a guest against a RESERVATION - an `active` booking with no
// `checked_in_at` yet, created by POST /api/rooms/checkin with `reserve: true`.
//
// This is the second half of the reservation flow: the room was sold in advance
// and the guest has now arrived. Nothing but the arrival stamp changes - the
// stay window already holds the room - so no money moves and no price is
// recomputed here; the desk settles the folio at check-out as usual.
//
// The room must be genuinely free first. A reservation left un-checked-in next
// to an unclosed folio is exactly the mistake this guards against: two guests,
// one room.

import type { NextApiRequest, NextApiResponse } from 'next';
import { and, eq, gt, isNotNull, isNull, lte, or } from 'drizzle-orm';
import { db, bookings, guests, rooms } from '../../../../src/db';
import { formatHotelDate, sltToday } from '../../../../lib/hotelDates';
import { reconcileRoom } from '../../../../lib/roomState';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const bookingId = Number(req.query.bookingId);
  if (!Number.isInteger(bookingId) || bookingId <= 0) {
    return res.status(400).json({ error: 'bookingId must be a positive integer' });
  }

  try {
    const booking = await db.query.bookings.findFirst({ where: eq(bookings.id, bookingId) });

    if (!booking) {
      return res.status(404).json({ error: `Booking ${bookingId} not found` });
    }
    if (booking.status !== 'active') {
      return res.status(400).json({
        error: `Booking ${bookingId} is ${booking.status} - only an active reservation can be checked in`,
      });
    }
    if (booking.checkedInAt) {
      return res.status(400).json({
        error: `Booking ${bookingId} was already checked in on ${booking.checkedInAt.toISOString()}`,
      });
    }

    // The booking day is a Sri Lankan calendar day, so "today" is compared in SLT.
    const arrivalDay = sltToday(booking.checkInDate);
    const todaySLT = sltToday();
    if (arrivalDay > todaySLT) {
      return res.status(400).json({
        error: `This room is reserved from ${arrivalDay}`,
        details: 'The guest cannot be checked in before the reserved arrival day',
      });
    }

    // Somebody may still be in the room: a reservation can only be checked in
    // once the previous guest has actually left. The dashboard hides the action
    // in that state, but the API is the last line of defence.
    const now = new Date();
    const stillInRoom = await db.query.bookings.findFirst({
      where: and(
        eq(bookings.roomId, booking.roomId),
        eq(bookings.status, 'active'),
        isNotNull(bookings.checkedInAt),
        lte(bookings.checkInDate, now),
        or(isNull(bookings.checkOutDate), gt(bookings.checkOutDate, now))
      ),
    });

    if (stillInRoom) {
      const occupant = await db.query.guests.findFirst({ where: eq(guests.id, stillInRoom.guestId) });
      return res.status(409).json({
        error: `Room still held by ${occupant ? occupant.name : 'another guest'} (folio #${stillInRoom.id})`,
        details: 'Check that guest out first - then this reservation can be checked in',
        bookingId: stillInRoom.id,
      });
    }

    const [updated] = await db
      .update(bookings)
      .set({ checkedInAt: now })
      .where(eq(bookings.id, bookingId))
      .returning();

    // The rooms.* cache only counts CHECKED-IN guests, so an arrival must be
    // reconciled just as a departure is.
    await reconcileRoom(booking.roomId);
    const room = await db.query.rooms.findFirst({ where: eq(rooms.id, booking.roomId) });
    const guest = await db.query.guests.findFirst({ where: eq(guests.id, booking.guestId) });

    return res.status(200).json({
      success: true,
      room,
      booking: updated,
      bookingId,
      guestName: guest ? guest.name : null,
      checkedInAt: updated.checkedInAt,
      message: `${guest ? guest.name : 'Guest'} checked into room ${room ? room.number : ''} (reserved ${formatHotelDate(booking.checkInDate)} - ${booking.checkOutDate ? formatHotelDate(booking.checkOutDate) : 'long-term'})`,
    });
  } catch (error) {
    console.error('Reservation check-in error:', error);
    return res.status(500).json({
      error: 'Failed to check in the reserved guest',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
