// pages/api/rooms/checkin.ts
// API endpoint for checking in a guest
// Creates booking, records advance payment, and updates room status

import type { NextApiRequest, NextApiResponse } from 'next';
import { eq, and, or, lt, gt, isNull } from 'drizzle-orm';
import { db, rooms, guests, bookings, transactions } from '../../../src/db';
import {
  CHECK_IN_HOUR_SLT,
  CHECK_OUT_HOUR_SLT,
  formatHotelDate,
  hotelSlotInstant,
  nightsBetween,
  parseDateOnly,
} from '../../../lib/hotelDates';
import { reconcileRoom } from '../../../lib/roomState';

interface CheckInRequest {
  roomNumber: string;
  guestName: string;
  phoneNumber: string;
  nicNumber: string;
  checkInDate: string; // 'YYYY-MM-DD', or an ISO instant converted to its SLT date
  checkOutDate: string; // 'YYYY-MM-DD', or an ISO instant converted to its SLT date
  totalAmount?: number; // when supplied it must equal the server-computed price
  advancePayment?: number;
  paymentMethod?: 'Cash' | 'Bank';
}

// FIX (B3/B13/B14/B15): every field below is now validated before any write.
const PAYMENT_METHODS = ['Cash', 'Bank'];
const MAX_NAME = 100;
const MAX_PHONE = 20;
const MAX_NIC = 30;

function asTrimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Parse a monetary field. Returns null when the value is not a finite number. */
function asMoney(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return 0;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}


export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = (req.body ?? {}) as CheckInRequest;

    // ---------------------------------------------------------------- validation
    const roomNumber = asTrimmed(body.roomNumber);
    const guestName = asTrimmed(body.guestName);
    const phoneNumber = asTrimmed(body.phoneNumber);
    const nicNumber = asTrimmed(body.nicNumber);

    if (!roomNumber) {
      return res.status(400).json({ error: 'roomNumber is required' });
    }
    if (!guestName) {
      return res.status(400).json({ error: 'Guest name is required' });
    }
    if (guestName.length > MAX_NAME) {
      return res.status(400).json({ error: `Guest name must be ${MAX_NAME} characters or fewer` });
    }
    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required' });
    }
    if (phoneNumber.length > MAX_PHONE) {
      return res.status(400).json({ error: `Phone number must be ${MAX_PHONE} characters or fewer` });
    }
    if (!nicNumber) {
      return res.status(400).json({ error: 'NIC number is required' });
    }
    if (nicNumber.length > MAX_NIC) {
      return res.status(400).json({ error: `NIC number must be ${MAX_NIC} characters or fewer` });
    }

    const inDate = parseDateOnly(body.checkInDate, 'checkInDate');
    if (!inDate.ok) {
      return res.status(400).json({ error: inDate.error });
    }
    const outDate = parseDateOnly(body.checkOutDate, 'checkOutDate');
    if (!outDate.ok) {
      return res.status(400).json({ error: outDate.error });
    }
    if (outDate.value <= inDate.value) {
      return res.status(400).json({
        error: 'Check-out date must be after check-in date',
        details: `Check-in is ${CHECK_IN_HOUR_SLT}:00 and check-out is ${CHECK_OUT_HOUR_SLT}:00, so a stay of zero nights is not possible`,
      });
    }

    // Standardize hotel times: Check-in at 14:00, Check-out at 11:00 (Asia/Colombo)
    const standardizedCheckIn = hotelSlotInstant(inDate.value, 'check-in');
    const standardizedCheckOut = hotelSlotInstant(outDate.value, 'check-out');
    const nights = nightsBetween(standardizedCheckIn, standardizedCheckOut);

    // 1. Find the room first: the stay is priced from the server-side rate, never
    //    from a client-supplied total.
    const room = await db.query.rooms.findFirst({
      where: eq(rooms.number, roomNumber),
    });

    if (!room) {
      return res.status(404).json({ error: `Room ${roomNumber} not found` });
    }

    const roomRate = Number(room.price);
    if (!Number.isFinite(roomRate) || roomRate <= 0) {
      return res.status(500).json({ error: `Room ${roomNumber} has no valid nightly rate configured` });
    }
    const serverTotal = roomRate * nights;

    const clientTotal = asMoney(body.totalAmount);
    if (clientTotal === null || clientTotal < 0) {
      return res.status(400).json({ error: 'totalAmount must be zero or a positive number' });
    }
    if (body.totalAmount !== undefined && clientTotal !== serverTotal) {
      return res.status(400).json({
        error: 'Total amount does not match the room rate',
        details: `${nights} night(s) at LKR ${roomRate.toLocaleString()} = LKR ${serverTotal.toLocaleString()}`,
      });
    }

    const advancePayment = asMoney(body.advancePayment);
    if (advancePayment === null || advancePayment < 0) {
      return res.status(400).json({ error: 'advancePayment must be zero or a positive number' });
    }
    if (advancePayment > serverTotal) {
      return res.status(400).json({
        error: 'Advance payment cannot exceed the total amount',
        details: `Advance of LKR ${advancePayment.toLocaleString()} on a LKR ${serverTotal.toLocaleString()} stay`,
      });
    }
    if (advancePayment > 0 && !PAYMENT_METHODS.includes(body.paymentMethod as string)) {
      return res.status(400).json({
        error: 'paymentMethod is required when an advance payment is recorded',
        details: 'Expected "Cash" or "Bank" - without it the advance would never reach the ledger',
      });
    }
    const paymentMethod = body.paymentMethod;

    // 2. Find or create guest
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
        errorMessage += ` from ${formatHotelDate(existingCheckIn)} to ${formatHotelDate(existingCheckOut)}`;
      } else {
        errorMessage += ` from ${formatHotelDate(existingCheckIn)} (long-term stay, no check-out date)`;
      }
      
      return res.status(400).json({ 
        error: errorMessage,
        details: 'Please select different dates or a different room'
      });
    }

    // 3. Create booking record with standardized hotel times and server pricing
    const [booking] = await db.insert(bookings).values({
      guestId: guest.id,
      roomId: room.id,
      checkInDate: standardizedCheckIn,
      checkOutDate: standardizedCheckOut,
      totalPrice: serverTotal,
      status: 'active',
    }).returning();

    // 4. Record the advance payment
    if (advancePayment > 0 && paymentMethod) {
      await db.insert(transactions).values({
        bookingId: booking.id,
        amount: advancePayment,
        paymentMethod: paymentMethod,
        paymentType: 'advance',
      });
    }

    // 5. Refresh the room's occupancy cache from the bookings table (E-6)
    await reconcileRoom(room.id);
    const updatedRoom = await db.query.rooms.findFirst({ where: eq(rooms.id, room.id) });

    return res.status(200).json({
      success: true,
      room: updatedRoom ?? { ...room, isOccupied: true, checkOutTime: standardizedCheckOut },
      booking,
      nights,
      totalAmount: serverTotal,
      paidAmount: advancePayment,
      message: `Guest ${guestName} checked into room ${roomNumber} for ${nights} night(s)`,
    });

  } catch (error) {
    console.error('Check-in error:', error);
    return res.status(500).json({ 
      error: 'Failed to process check-in',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
