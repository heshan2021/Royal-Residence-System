// pages/api/book/rooms.ts
// API endpoint to get all rooms for initial display
//
// FIX (B4): the public grid returned no availability information at all, so the
// booking engine could not tell a guest whether a room was free. Occupancy is
// now derived from the `bookings` table (the source of truth) for "right now",
// with NULL check-outs treated as open-ended long-term stays.
// Responses are no longer cached because occupancy changes constantly.

import type { NextApiRequest, NextApiResponse } from 'next';
import { db, rooms, bookings } from '../../../src/db';
import { and, eq, gt, isNull, lte, or } from 'drizzle-orm';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Live occupancy: never serve a cached grid
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  try {
    // Get all rooms - use a safer approach that handles missing columns
    // First, get the basic columns that definitely exist
    const roomData = await db.select({
      id: rooms.id,
      number: rooms.number,
      price: rooms.price,
      amenities: rooms.amenities,
    }).from(rooms).orderBy(rooms.id);

    // Which rooms hold a guest at this moment?
    const now = new Date();
    const occupiedRows = await db.select({ roomId: bookings.roomId })
      .from(bookings)
      .where(and(
        eq(bookings.status, 'active'),
        lte(bookings.checkInDate, now),
        or(isNull(bookings.checkOutDate), gt(bookings.checkOutDate, now))
      ));
    const occupiedRoomIds = new Set(occupiedRows.map(row => row.roomId));

    // Transform the data to include the new columns with fallback values
    const allRooms = roomData.map(room => ({
      id: room.id,
      name: `Room ${room.number}`, // Fallback name using room number
      description: 'Experience luxury and comfort in our meticulously designed rooms.',
      size: 'Standard',
      image_url: 'https://images.unsplash.com/photo-1542314831-c6a4d140b3c6?auto=format&fit=crop&w=800&q=80',
      price: room.price,
      amenities: room.amenities || [],
      number: room.number,
      isOccupied: occupiedRoomIds.has(room.id),
      isAvailable: !occupiedRoomIds.has(room.id)
    }));

    return res.status(200).json(allRooms);

  } catch (error) {
    console.error('Error fetching rooms:', error);
    
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