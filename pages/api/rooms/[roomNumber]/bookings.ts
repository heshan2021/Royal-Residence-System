// pages/api/rooms/[roomNumber]/bookings.ts
// API endpoint for fetching upcoming bookings for a specific room

import type { NextApiRequest, NextApiResponse } from 'next';
import { db, rooms, bookings, guests } from '../../../../src/db';
import { eq, and, gte, or, isNull, lte } from 'drizzle-orm';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { roomNumber } = req.query;

    if (!roomNumber || typeof roomNumber !== 'string') {
      return res.status(400).json({ error: 'Room number is required' });
    }

    // Find the room
    const room = await db.query.rooms.findFirst({
      where: eq(rooms.number, roomNumber),
    });

    if (!room) {
      return res.status(404).json({ error: `Room ${roomNumber} not found` });
    }

    // Get current date for filtering upcoming bookings
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Fetch all active bookings for this room that are upcoming or ongoing
    const roomBookings = await db.query.bookings.findMany({
      where: and(
        eq(bookings.roomId, room.id),
        eq(bookings.status, 'active'),
        // Get bookings that are either:
        // 1. Ongoing (check-in date <= today AND (check-out date >= today OR check-out date is null))
        // 2. Future (check-in date >= today)
        or(
          // Ongoing bookings
          and(
            lte(bookings.checkInDate, today),
            or(
              gte(bookings.checkOutDate, today),
              isNull(bookings.checkOutDate)
            )
          ),
          // Future bookings
          gte(bookings.checkInDate, today)
        )
      ),
      with: {
        guest: true,
      },
      orderBy: (bookings, { asc }) => [asc(bookings.checkInDate)],
    });

    // Format the response
    const formattedBookings = roomBookings.map(booking => ({
      checkInDate: booking.checkInDate.toISOString(),
      checkOutDate: booking.checkOutDate ? booking.checkOutDate.toISOString() : null,
      guestName: booking.guest?.name || 'Unknown Guest',
      bookingId: booking.id,
    }));

    return res.status(200).json(formattedBookings);

  } catch (error) {
    console.error('Error fetching room bookings:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch room bookings',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
