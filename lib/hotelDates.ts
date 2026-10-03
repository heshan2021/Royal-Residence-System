// lib/hotelDates.ts
// Single source of truth for Royal Residence "Night Slot" time arithmetic.
//
// Business rules:
//   Check-in  : 14:00 Asia/Colombo (UTC+05:30)
//   Check-out : 11:00 Asia/Colombo (UTC+05:30) -> 3 hour turnaround window
//
// IMPORTANT: the `bookings.check_in_date` / `bookings.check_out_date` columns are
// `timestamp WITHOUT time zone` and every existing row stores a **UTC instant**
// (e.g. 14:00 SLT is persisted as '2026-04-02 08:30:00'). Every helper below
// therefore returns real `Date` instants so Drizzle serialises them to UTC the
// same way, on any server timezone (Sri Lanka locally, UTC on Vercel).

export const SLT_OFFSET_MINUTES = 330; // +05:30
export const CHECK_IN_HOUR_SLT = 14;
export const CHECK_OUT_HOUR_SLT = 11;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Today's calendar date in Sri Lanka as 'YYYY-MM-DD'. */
export function sltToday(now: Date = new Date()): string {
  return new Date(now.getTime() + SLT_OFFSET_MINUTES * 60_000).toISOString().slice(0, 10);
}

/**
 * Strictly validate a date-only string ('YYYY-MM-DD').
 * Rejects impossible dates such as 2026-13-45 or 2026-02-30.
 */
export function parseDateOnly(value: unknown, field: string): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof value === 'string' && (value.includes('T') || value.endsWith('Z'))) {
    // The dashboard posts JS Dates, which JSON-serialise to UTC instants. A UTC
    // instant can fall on the previous Sri Lankan day (local midnight = 18:30Z),
    // so convert the instant to its SLT calendar date instead of slicing it.
    const instant = new Date(value);
    if (Number.isNaN(instant.getTime())) {
      return { ok: false, error: `${field} is not a valid date` };
    }
    value = sltToday(instant);
  }
  if (typeof value !== 'string' || !DATE_ONLY.test(value)) {
    return { ok: false, error: `${field} must be a valid date in YYYY-MM-DD format` };
  }
  const [y, m, d] = value.split('-').map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) {
    return { ok: false, error: `${field} is not a real calendar date` };
  }
  return { ok: true, value };
}

/** The instant that a given calendar day's hotel slot begins. */
export function hotelSlotInstant(dateOnly: string, kind: 'check-in' | 'check-out'): Date {
  const hour = kind === 'check-in' ? CHECK_IN_HOUR_SLT : CHECK_OUT_HOUR_SLT;
  return new Date(`${dateOnly}T${String(hour).padStart(2, '0')}:00:00+05:30`);
}

/** Inclusive Sri Lanka day bounds for a calendar date, as UTC instants. */
export function sltDayBounds(dateOnly: string): { start: Date; end: Date } {
  return {
    start: new Date(`${dateOnly}T00:00:00.000+05:30`),
    end: new Date(`${dateOnly}T23:59:59.999+05:30`),
  };
}

/** Whole nights between two hotel instants (never below 1). */
export function nightsBetween(checkIn: Date, checkOut: Date): number {
  return Math.max(1, Math.round((checkOut.getTime() - checkIn.getTime()) / MS_PER_DAY));
}

/** Human readable slot, e.g. "October 5 at 2:00 PM" (used in API error text). */
export function formatHotelDate(date: Date): string {
  return date.toLocaleString('en-US', {
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Colombo',
  });
}

/** Per-night rate implied by a booking's total price, rounded to whole LKR. */
export function nightlyRate(totalPrice: number, nights: number): number {
  if (nights <= 0) return totalPrice;
  return Math.round(totalPrice / nights);
}

/**
 * Price a stay. `nights` are the nights actually consumed; when it differs from
 * the nights originally booked the folio is re-priced (early departure).
 */
export function priceForNights(totalPrice: number, bookedNights: number, nights: number): number {
  return nightlyRate(totalPrice, bookedNights) * nights;
}
