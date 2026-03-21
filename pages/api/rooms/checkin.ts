// pages/api/rooms/checkin.ts
// API endpoint for checking in a guest
// Creates booking, records advance payment, and updates room status

import type { NextApiRequest, NextApiResponse } from 'next';
import { db, rooms, guests, bookings, transactions } from '../../../src/db';
import { eq } from 'drizzle-orm';

interface CheckInRequest {
  roomNumber: string;
  guestName: string;
  phoneNumber: string;
  nicNumber: string;
  checkOutTime: string;
  totalAmount: number;
  advancePayment?: number;
  paymentMethod?: 'Cash' | 'Bank';
}

/**
 * Parse checkout time string in format "HH:MM DD/MM/YYYY" to Date object
 * Example: "14:30 22/03/2026" -> Date object
 */
function parseCheckOutTime(checkOutTimeStr: string): Date {
  // Expected format: "HH:MM DD/MM/YYYY"
  const parts = checkOutTimeStr.trim().split(' ');
  
  if (parts.length !== 2) {
    // Try parsing as ISO string or other standard format
    const date = new Date(checkOutTimeStr);
    if (!isNaN(date.getTime())) {
      return date;
    }
    throw new Error(`Invalid checkout time format: ${checkOutTimeStr}`);
  }
  
  const [time, dateStr] = parts;
  const [hours, minutes] = time.split(':').map(Number);
  const [day, month, year] = dateStr.split('/').map(Number);
  
  // Validate parsed values
  if (isNaN(hours) || isNaN(minutes) || isNaN(day) || isNaN(month) || isNaN(year)) {
    throw new Error(`Invalid checkout time format: ${checkOutTimeStr}`);
  }
  
  // Create date (month is 0-indexed in JavaScript)
  const date = new Date(year, month - 1, day, hours, minutes, 0, 0);
  
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid checkout time format: ${checkOutTimeStr}`);
  }
  
  return date;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      roomNumber,
      guestName,
      phoneNumber,
      nicNumber,
      checkOutTime,
      totalAmount,
      advancePayment,
      paymentMethod,
    }: CheckInRequest = req.body;

    // 1. Find or create guest
    let guest = await db.query.guests.findFirst({
      where: eq(guests.nicNumber, nicNumber),
    });

    if (!guest) {
      // Create new guest
      const [newGuest] = await db.insert(guests).values({
        name: guestName,
        phoneNumber: phoneNumber,
        nicNumber: nicNumber,
      }).returning();
      guest = newGuest;
    }

    // 2. Find the room
    const room = await db.query.rooms.findFirst({
      where: eq(rooms.number, roomNumber),
    });

    if (!room) {
      return res.status(404).json({ error: `Room ${roomNumber} not found` });
    }

    if (room.isOccupied) {
      return res.status(400).json({ error: `Room ${roomNumber} is already occupied` });
    }

    // 3. Create booking record
    const [booking] = await db.insert(bookings).values({
      guestId: guest.id,
      roomId: room.id,
      checkInDate: new Date(),
      totalPrice: totalAmount,
      status: 'active',
    }).returning();

    // 4. If advance payment provided, record transaction
    if (advancePayment && advancePayment > 0 && paymentMethod) {
      await db.insert(transactions).values({
        bookingId: booking.id,
        amount: advancePayment,
        paymentMethod: paymentMethod,
        paymentType: 'advance',
      });
    }

    // 5. Update room to occupied status
    const [updatedRoom] = await db.update(rooms)
      .set({
        isOccupied: true,
        guestName: guestName,
        phoneNumber: phoneNumber,
        nicNumber: nicNumber,
        checkOutTime: parseCheckOutTime(checkOutTime),
        updatedAt: new Date(),
      })
      .where(eq(rooms.id, room.id))
      .returning();

    return res.status(200).json({
      success: true,
      room: updatedRoom,
      booking: booking,
      message: `Guest ${guestName} checked into room ${roomNumber}`,
    });

  } catch (error) {
    console.error('Check-in error:', error);
    return res.status(500).json({ 
      error: 'Failed to process check-in',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
