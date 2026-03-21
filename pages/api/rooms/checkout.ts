// pages/api/rooms/checkout.ts
// API endpoint for checking out a guest
// Records final payment, updates booking status, and clears room

import type { NextApiRequest, NextApiResponse } from 'next';
import { db, rooms, bookings, transactions } from '../../../src/db';
import { eq, and } from 'drizzle-orm';

interface CheckOutRequest {
  roomNumber: string;
  finalPayment?: number;
  paymentMethod?: 'Cash' | 'Bank';
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
      finalPayment,
      paymentMethod,
    }: CheckOutRequest = req.body;

    // 1. Find the room
    const room = await db.query.rooms.findFirst({
      where: eq(rooms.number, roomNumber),
    });

    if (!room) {
      return res.status(404).json({ error: `Room ${roomNumber} not found` });
    }

    if (!room.isOccupied) {
      return res.status(400).json({ error: `Room ${roomNumber} is not occupied` });
    }

    // 2. Find the active booking for this room
    const activeBooking = await db.query.bookings.findFirst({
      where: and(
        eq(bookings.roomId, room.id),
        eq(bookings.status, 'active')
      ),
    });

    if (!activeBooking) {
      return res.status(404).json({ error: 'No active booking found for this room' });
    }

    // 3. If final payment provided, record transaction
    if (finalPayment && finalPayment > 0 && paymentMethod) {
      await db.insert(transactions).values({
        bookingId: activeBooking.id,
        amount: finalPayment,
        paymentMethod: paymentMethod,
        paymentType: 'final_settlement',
      });
    }

    // 4. Update booking status to completed
    await db.update(bookings)
      .set({
        status: 'completed',
        checkOutDate: new Date(),
      })
      .where(eq(bookings.id, activeBooking.id));

    // 5. Clear room - make it available again
    const [updatedRoom] = await db.update(rooms)
      .set({
        isOccupied: false,
        guestName: null,
        phoneNumber: null,
        nicNumber: null,
        checkOutTime: null,
        updatedAt: new Date(),
      })
      .where(eq(rooms.id, room.id))
      .returning();

    return res.status(200).json({
      success: true,
      room: updatedRoom,
      message: `Room ${roomNumber} checked out successfully`,
    });

  } catch (error) {
    console.error('Check-out error:', error);
    return res.status(500).json({ 
      error: 'Failed to process check-out',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
