// lib/roomState.ts
// The `bookings` table is the single source of truth for occupancy. The columns
// on `rooms` (is_occupied / guest_name / phone_number / nic_number /
// check_out_time) are a denormalised cache used for display.
//
// FIX (B5/E-6): those cached columns used to be written ad-hoc by check-in and
// blindly nulled by check-out, so they drifted apart from the bookings table
// (room 303 was stuck "occupied" with no live booking; room 202 was "available"
// while holding a live one). They are now always re-derived from bookings.

import { and, eq, gte, isNull, lte, or, desc } from 'drizzle-orm';
import { bookings, db, guests, rooms } from '../src/db';

export interface RoomFlagState {
  isOccupied: boolean;
  guestName: string | null;
  phoneNumber: string | null;
  nicNumber: string | null;
  checkOutTime: Date | null;
}

const VACANT: RoomFlagState = {
  isOccupied: false,
  guestName: null,
  phoneNumber: null,
  nicNumber: null,
  checkOutTime: null,
};

/**
 * Resolve what the room's cached columns should say at `at` (default: now),
 * based on the active booking that covers that moment.
 */
export async function deriveRoomState(roomId: number, at: Date = new Date()): Promise<RoomFlagState> {
  const booking = await db.query.bookings.findFirst({
    where: and(
      eq(bookings.roomId, roomId),
      eq(bookings.status, 'active'),
      lte(bookings.checkInDate, at),
      or(isNull(bookings.checkOutDate), gte(bookings.checkOutDate, at))
    ),
    orderBy: (bookings, { desc: descOrder }) => [descOrder(bookings.checkInDate)],
  });

  if (!booking) return VACANT;

  const guest = await db.query.guests.findFirst({ where: eq(guests.id, booking.guestId) });
  return {
    isOccupied: true,
    guestName: guest?.name ?? null,
    phoneNumber: guest?.phoneNumber ?? null,
    nicNumber: guest?.nicNumber ?? null,
    checkOutTime: booking.checkOutDate ?? null,
  };
}

/** Re-derive and persist the room's cached occupancy columns. */
export async function reconcileRoom(roomId: number, at: Date = new Date()): Promise<RoomFlagState> {
  const state = await deriveRoomState(roomId, at);
  await db
    .update(rooms)
    .set({ ...state, updatedAt: new Date() })
    .where(eq(rooms.id, roomId));
  return state;
}

export { desc };
