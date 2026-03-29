// pages/api/rooms/checkin.ts
// API endpoint for checking in a guest
// Creates booking, records advance payment, and updates room status

import type { NextApiRequest, NextApiResponse } from 'next';
import { db, rooms, guests, bookings, transactions } from '../../../src/db';
import { eq, and, or, lt, gt, lte, gte, isNull } from 'drizzle-orm';

interface CheckInRequest {
  roomNumber: string;
  guestName: string;
  phoneNumber: string;
  nicNumber: string;
  checkInDate: string; // Date-only string (YYYY-MM-DD)
  checkOutDate: string; // Date-only string (YYYY-MM-DD)
  totalAmount: number;
  advancePayment?: number;
  paymentMethod?: 'Cash' | 'Bank';
}

/**
 * Standardize hotel times to ensure 3-hour turnaround window
 * Check-In Time: 14:00:00 (2:00 PM)
 * Check-Out Time: 11:00:00 (11:00 AM)
 * 
 * @param dateStr Date-only string in format YYYY-MM-DD
 * @param isCheckIn Whether to add check-in time (14:00) or check-out time (11:00)
 * @returns Date object with standardized time
 */
function addHotelTime(dateStr: string, isCheckIn: boolean): Date {
  // Use local time in Sri Lanka (Asia/Colombo, UTC+5:30)
  // Append time with explicit +05:30 timezone to avoid runtime conversion issues
  const time = isCheckIn ? '14:00:00' : '11:00:00';
  // Create date explicitly in Sri Lanka timezone
  const date = new Date(`${dateStr}T${time}+05:30`);
  return date;
}

/**
 * Format date for display with Sri Lanka timezone
 * @param date Date object
 * @returns Formatted string like "March 25 (2:00 PM)"
 */
function formatHotelDate(date: Date, isCheckIn: boolean): string {
  const options: Intl.DateTimeFormatOptions = {
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Colombo'
  };
  
  const formatted = date.toLocaleDateString('en-US', options);
  return formatted;
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
      checkInDate,
      checkOutDate,
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
    } else {
      // Update existing guest's name and phone if they've changed
      // This ensures the transaction ledger shows the current guest name
      if (guest.name !== guestName || guest.phoneNumber !== phoneNumber) {
        const [updatedGuest] = await db.update(guests)
          .set({
            name: guestName,
            phoneNumber: phoneNumber,
            updatedAt: new Date(),
          })
          .where(eq(guests.id, guest.id))
          .returning();
        guest = updatedGuest;
      }
    }

    // 2. Find the room
    const room = await db.query.rooms.findFirst({
      where: eq(rooms.number, roomNumber),
    });

    if (!room) {
      return res.status(404).json({ error: `Room ${roomNumber} not found` });
    }

    // Standardize hotel times: Check-in at 2:00 PM, Check-out at 11:00 AM
    const standardizedCheckIn = addHotelTime(checkInDate, true); // 14:00:00
    const standardizedCheckOut = addHotelTime(checkOutDate, false); // 11:00:00

    // Check for overlapping bookings (double booking prevention)
    // Find any active booking that overlaps with the requested dates
    // Two date ranges [A1, A2] and [B1, B2] overlap if: A1 < B2 AND A2 > B1
    // We check all cases to ensure proper overlap detection including future bookings
    console.log("Checking overlap for:", { newCheckIn: standardizedCheckIn.toISOString(), newCheckOut: standardizedCheckOut.toISOString() });
    
    const overlappingBooking = await db.query.bookings.findFirst({
      where: and(
        eq(bookings.roomId, room.id),
        eq(bookings.status, 'active'),
        or(
          // Case 1: Standard overlaps (both bookings have check-out dates)
          // Existing booking overlaps if: existing_checkIn < new_checkOut AND existing_checkOut > new_checkIn
          and(
            lt(bookings.checkInDate, standardizedCheckOut),
            gt(bookings.checkOutDate, standardizedCheckIn)
          ),
          // Case 2: Existing booking is long-term (no check-out date) - conflicts if new booking doesn't end before it starts
          and(
            lt(bookings.checkInDate, standardizedCheckOut),
            isNull(bookings.checkOutDate)
          ),
          // Case 3: New booking would overlap with a future booking
          // (existing booking starts during or after new booking's period but before new checkout)
          and(
            gt(bookings.checkInDate, standardizedCheckIn),
            lt(bookings.checkInDate, standardizedCheckOut)
          )
        )
      ),
    });

    if (overlappingBooking) {
      // Format the overlapping booking dates for display
      const existingCheckIn = overlappingBooking.checkInDate;
      const existingCheckOut = overlappingBooking.checkOutDate;
      
      let errorMessage = `Room ${roomNumber} is already booked`;
      
      if (existingCheckOut) {
        errorMessage += ` from ${formatHotelDate(existingCheckIn, true)} to ${formatHotelDate(existingCheckOut, false)}`;
      } else {
        errorMessage += ` from ${formatHotelDate(existingCheckIn, true)} (long-term stay, no check-out date)`;
      }
      
      return res.status(400).json({ 
        error: errorMessage,
        details: 'Please select different dates or a different room'
      });
    }

    // 3. Create booking record with standardized hotel times
    const [booking] = await db.insert(bookings).values({
      guestId: guest.id,
      roomId: room.id,
      checkInDate: standardizedCheckIn,
      checkOutDate: standardizedCheckOut,
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
        checkOutTime: new Date(checkOutDate),
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
