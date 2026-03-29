// pages/api/book/rooms.ts
// API endpoint to get all rooms for initial display

import type { NextApiRequest, NextApiResponse } from 'next';
import { db, rooms } from '../../../src/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Allow caching for room data (changes infrequently)
  res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour cache

  try {
    // Get all rooms - use a safer approach that handles missing columns
    // First, get the basic columns that definitely exist
    const roomData = await db.select({
      id: rooms.id,
      number: rooms.number,
      price: rooms.price,
      amenities: rooms.amenities,
    }).from(rooms).orderBy(rooms.id);

    // Transform the data to include the new columns with fallback values
    const allRooms = roomData.map(room => ({
      id: room.id,
      name: `Room ${room.number}`, // Fallback name using room number
      description: 'Experience luxury and comfort in our meticulously designed rooms.',
      size: 'Standard',
      image_url: 'https://images.unsplash.com/photo-1542314831-c6a4d140b3c6?auto=format&fit=crop&w=800&q=80',
      price: room.price,
      amenities: room.amenities || [],
      number: room.number
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