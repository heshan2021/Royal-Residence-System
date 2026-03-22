// pages/api/bookings/monthly.ts
// API endpoint to get all active bookings for a specific month
import type { NextApiRequest, NextApiResponse } from 'next';
import { db, bookings, rooms, guests } from '../../../src/db';
import { eq, and, gte, lte, isNull, or } from 'drizzle-orm';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Prevent Vercel edge caching - always fetch fresh data
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  try {
    // Parse year and month from query string (format: YYYY-MM)
    const { year, month } = req.query;
    
    if (!year || !month) {
      return res.status(400).json({ error: 'Year and month parameters are required (format: YYYY-MM)' });
    }

    const yearNum = parseInt(year as string);
    const monthNum = parseInt(month as string);
    
    if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      return res.status(400).json({ error: 'Invalid year or month format. Use YYYY-MM' });
    }

    // Calculate start and end of the month
    const startOfMonth = new Date(yearNum, monthNum - 1, 1, 0, 0, 0, 0);
    const endOfMonth = new Date(yearNum, monthNum, 0, 23, 59, 59, 999); // Last day of month

    // Get all active bookings that overlap with the specified month
    // A booking overlaps if: check_in_date <= end_of_month AND (check_out_date >= start_of_month OR check_out_date IS NULL)
    const activeBookings = await db
      .select({
        roomNumber: rooms.number,
        checkInDate: bookings.checkInDate,
        checkOutDate: bookings.checkOutDate,
        guestName: guests.name,
        phoneNumber: guests.phoneNumber,
        status: bookings.status,
      })
      .from(bookings)
      .innerJoin(rooms, eq(bookings.roomId, rooms.id))
      .innerJoin(guests, eq(bookings.guestId, guests.id))
      .where(
        and(
          eq(bookings.status, 'active'),
          lte(bookings.checkInDate, endOfMonth),
          or(
            gte(bookings.checkOutDate, startOfMonth),
            isNull(bookings.checkOutDate)
          )
        )
      )
      .orderBy(rooms.number, bookings.checkInDate);

    // Format dates for frontend
    const formattedBookings = activeBookings.map(booking => ({
      roomNumber: booking.roomNumber,
      checkInDate: booking.checkInDate.toISOString(),
      checkOutDate: booking.checkOutDate ? booking.checkOutDate.toISOString() : null,
      guestName: booking.guestName,
      phoneNumber: booking.phoneNumber,
    }));

    return res.status(200).json(formattedBookings);
  } catch (error) {
    console.error('Error fetching monthly bookings:', error);
    
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