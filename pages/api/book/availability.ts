// pages/api/book/availability.ts
// API endpoint for checking room availability with strict overlap logic
// Implements the "Night Slot" philosophy: 14:00 Check-In / 11:00 Check-Out
//
// FIX (B28): the overlap test used `check_out_date > :checkIn`, which SQL never
// matches for NULL. Long-term guests (NULL check-out) were therefore offered as
// available. NULL check-outs are now treated as open-ended stays.
// Slots are also built with the shared Sri Lanka hotel-slot helpers instead of
// setHours(), so the result no longer depends on the server's timezone.

import type { NextApiRequest, NextApiResponse } from 'next';
import { db, rooms, bookings } from '../../../src/db';
import { and, eq, gt, isNull, lt, or } from 'drizzle-orm';
import { hotelSlotInstant, nightsBetween, parseDateOnly } from '../../../lib/hotelDates';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Prevent caching for real-time availability
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  try {
    const { checkIn, checkOut } = req.query;

    // Validate required parameters
    if (!checkIn || !checkOut) {
      return res.status(400).json({ 
        error: 'Missing required parameters: checkIn and checkOut are required' 
      });
    }

    const parsedCheckIn = parseDateOnly(checkIn, 'checkIn');
    if (!parsedCheckIn.ok) {
      return res.status(400).json({ error: parsedCheckIn.error });
    }
    const parsedCheckOut = parseDateOnly(checkOut, 'checkOut');
    if (!parsedCheckOut.ok) {
      return res.status(400).json({ error: parsedCheckOut.error });
    }

    // Validate date logic (date-only strings sort chronologically)
    if (parsedCheckOut.value <= parsedCheckIn.value) {
      return res.status(400).json({ error: 'Check-out date must be after check-in date' });
    }

    // Royal Residence "Night Slot" instants: check-in 14:00 SLT, check-out 11:00 SLT.
    const checkInSlot = hotelSlotInstant(parsedCheckIn.value, 'check-in');
    const checkOutSlot = hotelSlotInstant(parsedCheckOut.value, 'check-out');
    const nights = nightsBetween(checkInSlot, checkOutSlot);

    // Get all rooms - use safe approach for columns that might not exist
    const roomData = await db.select({
      id: rooms.id,
      number: rooms.number,
      price: rooms.price,
      amenities: rooms.amenities,
    }).from(rooms).orderBy(rooms.id);

    // For each room, check if it has any overlapping bookings
    const availableRooms = await Promise.all(
      roomData.map(async (room) => {
        // Strict overlap logic: newCheckIn < existingCheckOut AND newCheckOut > existingCheckIn.
        // A NULL check-out means the guest never checked out (long-term stay) and
        // always overlaps - SQL `NULL > x` is NULL, so it must be matched explicitly.
        const overlappingBookings = await db.select({ id: bookings.id })
          .from(bookings)
          .where(
            and(
              eq(bookings.roomId, room.id),
              eq(bookings.status, 'active'),
              lt(bookings.checkInDate, checkOutSlot),
              or(
                isNull(bookings.checkOutDate),
                gt(bookings.checkOutDate, checkInSlot)
              )
            )
          )
          .limit(1);

        // Room is available if no overlapping bookings found
        const isAvailable = overlappingBookings.length === 0;

        // Calculate total price for the stay
        const pricePerNight = room.price ? parseFloat(room.price) : 0;
        const totalPrice = pricePerNight * nights;

        // Return room data with availability status
        return {
          id: room.id,
          name: `Room ${room.number}`, // Fallback name
          description: 'Experience luxury and comfort in our meticulously designed rooms.',
          size: 'Standard',
          image_url: 'https://images.unsplash.com/photo-1542314831-c6a4d140b3c6?auto=format&fit=crop&w=800&q=80',
          price: room.price,
          amenities: room.amenities || [],
          number: room.number,
          isAvailable,
          totalPrice
        };
      })
    );

    // Filter to only available rooms
    const filteredRooms = availableRooms
      .filter(room => room.isAvailable)
      .map(({ isAvailable, totalPrice, ...room }) => room); // Remove temporary fields

    return res.status(200).json(filteredRooms);

  } catch (error) {
    console.error('Error checking availability:', error);
    
    let errorMessage = 'Database error';
    if (error instanceof Error) {
      if (error.message.includes('NEON_DATABASE_URL')) {
        errorMessage = 'Database connection not configured.';
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