// pages/api/book/availability.ts
// API endpoint for checking room availability with strict overlap logic
// Implements the "Night Slot" philosophy: 14:00 Check-In / 11:00 Check-Out

import type { NextApiRequest, NextApiResponse } from 'next';
import { db, rooms, bookings } from '../../../src/db';
import { and, eq, gt, lt, or, isNull, not, sql } from 'drizzle-orm';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Prevent caching for real-time availability
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  try {
    const { checkIn, checkOut, guests } = req.query;

    // Validate required parameters
    if (!checkIn || !checkOut) {
      return res.status(400).json({ 
        error: 'Missing required parameters: checkIn and checkOut are required' 
      });
    }

    // Parse dates and validate format
    const checkInDate = new Date(checkIn as string);
    const checkOutDate = new Date(checkOut as string);

    if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    // Validate date logic
    if (checkOutDate <= checkInDate) {
      return res.status(400).json({ error: 'Check-out date must be after check-in date' });
    }

    // Apply Royal Residence "Night Slot" times:
    // Check-In: 14:00:00 (2:00 PM) Sri Lanka Time
    // Check-Out: 11:00:00 (11:00 AM) the following day
    const checkInWithTime = new Date(checkInDate);
    checkInWithTime.setHours(14, 0, 0, 0); // 14:00:00

    const checkOutWithTime = new Date(checkOutDate);
    checkOutWithTime.setHours(11, 0, 0, 0); // 11:00:00

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
        // Check for overlapping bookings
        const overlappingBookings = await db.select()
          .from(bookings)
          .where(
            and(
              eq(bookings.roomId, room.id),
              eq(bookings.status, 'active'),
              // Strict overlap logic: newCheckIn < existingCheckOut AND newCheckOut > existingCheckIn
              // Use sql template for date comparisons
              sql`${bookings.checkOutDate} > ${checkInWithTime.toISOString()}::timestamp`,
              sql`${bookings.checkInDate} < ${checkOutWithTime.toISOString()}::timestamp`
            )
          )
          .limit(1);

        // Room is available if no overlapping bookings found
        const isAvailable = overlappingBookings.length === 0;

        // Calculate total price for the stay
        const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
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