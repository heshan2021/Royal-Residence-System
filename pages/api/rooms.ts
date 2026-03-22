// pages/api/rooms.ts
// API endpoint to get all rooms with booking and payment information
import type { NextApiRequest, NextApiResponse } from 'next';
import { db, rooms, bookings, transactions } from '../../src/db';
import { eq, and, sum } from 'drizzle-orm';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Prevent Vercel edge caching - always fetch fresh data
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  try {
    // Get all rooms
    const allRooms = await db.query.rooms.findMany({
      orderBy: (rooms, { asc }) => [asc(rooms.number)],
    });

    // For each occupied room, get the active booking and total paid amount
    const roomsWithPayments = await Promise.all(
      allRooms.map(async (room) => {
        let totalAmount = 0;
        let paidAmount = 0;

        if (room.isOccupied) {
          // Find active booking
          const activeBooking = await db.query.bookings.findFirst({
            where: and(
              eq(bookings.roomId, room.id),
              eq(bookings.status, 'active')
            ),
          });

          if (activeBooking) {
            totalAmount = activeBooking.totalPrice;

            // Get sum of all transactions for this booking
            const paymentsResult = await db
              .select({ total: sum(transactions.amount) })
              .from(transactions)
              .where(eq(transactions.bookingId, activeBooking.id));

            paidAmount = Number(paymentsResult[0]?.total) || 0;
          }
        }

        // Format checkOutTime: if null and occupied, show "Long-term"
        let checkOutTimeDisplay: string | undefined;
        if (room.isOccupied) {
          checkOutTimeDisplay = room.checkOutTime 
            ? room.checkOutTime.toISOString() 
            : 'Long-term';
        }

        return {
          id: `room-${room.number}`,
          number: room.number,
          price: room.price ? parseFloat(room.price) : null,
          amenities: room.amenities || [],
          isOccupied: room.isOccupied || false,
          guestName: room.guestName,
          phoneNumber: room.phoneNumber,
          nicNumber: room.nicNumber,
          checkOutTime: checkOutTimeDisplay,
          totalAmount,
          paidAmount,
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
