// pages/api/rooms.ts
// API endpoint to get all rooms with booking and payment information
import type { NextApiRequest, NextApiResponse } from 'next';
import { db, rooms, bookings, transactions, guests } from '../../src/db';
import { eq, and, sum, lte, gt, gte, isNull, or } from 'drizzle-orm';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Prevent Vercel edge caching - always fetch fresh data
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  try {
    // Parse date parameter from query string (format: YYYY-MM-DD)
    const dateParam = req.query.date as string | undefined;
    let targetDateStart: Date;
    let targetDateEnd: Date;
    
    if (dateParam) {
      // Parse the date string and create start/end of day boundaries
      // This ensures we check for bookings that overlap with ANY part of the target date
      const [year, month, day] = dateParam.split('-').map(Number);
      if (!year || !month || !day) {
        return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
      }
      // Start of day (00:00:00)
      targetDateStart = new Date(year, month - 1, day, 0, 0, 0, 0);
      // End of day (23:59:59.999)
      targetDateEnd = new Date(year, month - 1, day, 23, 59, 59, 999);
    } else {
      // Default to today
      const now = new Date();
      targetDateStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      targetDateEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    }

    // Get all rooms
    const allRooms = await db.query.rooms.findMany({
      orderBy: (rooms, { asc }) => [asc(rooms.number)],
    });

    // For each room, check if it's occupied on the target date
    const roomsWithPayments = await Promise.all(
      allRooms.map(async (room) => {
        let totalAmount = 0;
        let paidAmount = 0;
        let isOccupiedOnTargetDate = false;
        let guestName: string | undefined;
        let phoneNumber: string | undefined;
        let nicNumber: string | undefined;
        let checkOutTimeDisplay: string | undefined;

        // Check if room is occupied on target date using date range logic:
        // A room is "Occupied" on targetDate IF there is a booking where:
        // status = 'active' AND check_in_date <= end_of_target_day AND (check_out_date >= start_of_target_day OR check_out_date IS NULL)
        // This ensures bookings that start anytime during the day or span over the day are included
        const activeBookingOnDate = await db.query.bookings.findFirst({
          where: and(
            eq(bookings.roomId, room.id),
            eq(bookings.status, 'active'),
            lte(bookings.checkInDate, targetDateEnd), // check_in_date <= end of target day
            or(
              gt(bookings.checkOutDate, targetDateEnd), // MUST be strictly greater than end of target day to be occupied
              isNull(bookings.checkOutDate) // OR check_out_date IS NULL
            )
          ),
        });

        if (activeBookingOnDate) {
          isOccupiedOnTargetDate = true;
          totalAmount = activeBookingOnDate.totalPrice;

          // Get sum of all transactions for this booking
          const paymentsResult = await db
            .select({ total: sum(transactions.amount) })
            .from(transactions)
            .where(eq(transactions.bookingId, activeBookingOnDate.id));

          paidAmount = Number(paymentsResult[0]?.total) || 0;

          // Get guest information from the booking
          const guest = await db.query.guests.findFirst({
            where: eq(guests.id, activeBookingOnDate.guestId),
          });

          if (guest) {
            guestName = guest.name;
            phoneNumber = guest.phoneNumber;
            nicNumber = guest.nicNumber;
          }

          // Format checkOutTime
          if (activeBookingOnDate.checkOutDate) {
            checkOutTimeDisplay = activeBookingOnDate.checkOutDate.toISOString();
          } else {
            checkOutTimeDisplay = 'Long-term';
          }
        }

        return {
          id: `room-${room.number}`,
          number: room.number,
          price: room.price ? parseFloat(room.price) : null,
          amenities: room.amenities || [],
          isOccupied: isOccupiedOnTargetDate,
          guestName,
          phoneNumber,
          nicNumber,
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
