// lib/discounts.ts
// Room-rate concessions granted when a folio is settled at check-out.
//
// Royal Residence discounts a stay for a stated reason - a student, a night
// where no cheaper room was free, a repeating customer, goodwill - so the
// money given away must always be attributable to a human reason.
//
// Pure helpers only (no React, no database), so the API route and the
// check-out modal apply exactly the same rules.
//
// Model (see src/db/schema.ts -> bookings.discountAmount):
//   gross folio value  = bookings.totalPrice + bookings.discountAmount
//   settled            = paid transactions === bookings.totalPrice (the NET)
// The discount therefore never touches the payment ledger: it simply lowers
// what the guest owes, and only by as much as was still outstanding.

/** Preset reasons offered by the check-out modal, plus a free-text escape. */
export const DISCOUNT_REASONS = [
  'Student',
  'No cheaper room available',
  'Repeating customer',
  'Other',
] as const;

export type DiscountReasonPreset = (typeof DISCOUNT_REASONS)[number];

/** The preset that makes the receptionist type the reason in their own words. */
export const OTHER_DISCOUNT_REASON: DiscountReasonPreset = 'Other';

/** `bookings.discount_reason` is varchar(255). */
export const DISCOUNT_REASON_MAX_LENGTH = 255;

/** Longest amount a room rate can realistically give away (guards typos). */
export const DISCOUNT_AMOUNT_MAX = 10_000_000;

export interface DiscountDecision {
  /** Rupees to write off the folio (0 = no discount). */
  amount: number;
  /** Why, in the receptionist's words ('' when there is no discount). */
  reason: string;
}

export type DiscountValidation =
  | { ok: true; discount: DiscountDecision }
  | { ok: false; error: string; details?: string };

/**
 * Validate a check-out discount against what the folio still owes.
 *
 * @param rawAmount     Amount sent by the client (rupees).
 * @param rawReason     Reason sent by the client.
 * @param maxDiscount   Rupees still owed on the folio *after* the final payment
 *                      (`total - paid - finalPayment`). A discount may never
 *                      exceed this, which is what keeps the folio from going
 *                      into credit: the discount forgives debt, it never
 *                      refunds cash (an over-payment stays a `refund` row).
 */
export function validateDiscount(
  rawAmount: unknown,
  rawReason: unknown,
  maxDiscount: number
): DiscountValidation {
  const noDiscount: DiscountValidation = { ok: true, discount: { amount: 0, reason: '' } };

  // An absent / blank amount simply means "no discount".
  if (rawAmount === undefined || rawAmount === null || rawAmount === '') {
    if (typeof rawReason === 'string' && rawReason.trim() !== '') {
      return { ok: false, error: 'A discount reason was given without a discount amount' };
    }
    return noDiscount;
  }

  const amount = typeof rawAmount === 'number' ? rawAmount : Number(rawAmount);
  if (!Number.isFinite(amount)) {
    return { ok: false, error: 'discountAmount must be a number' };
  }
  if (amount < 0) {
    return { ok: false, error: 'discountAmount must be zero or a positive number' };
  }
  if (amount === 0) {
    // Amount given but nothing to forgive: treat blank reason as "no discount",
    // but never silently drop a reason the receptionist typed.
    if (typeof rawReason === 'string' && rawReason.trim() !== '') {
      return { ok: false, error: 'A discount reason was given without a discount amount' };
    }
    return noDiscount;
  }

  if (!Number.isInteger(amount)) {
    return { ok: false, error: 'discountAmount must be a whole number of rupees' };
  }
  if (amount > DISCOUNT_AMOUNT_MAX) {
    return {
      ok: false,
      error: `discountAmount may not exceed LKR ${DISCOUNT_AMOUNT_MAX.toLocaleString()}`,
    };
  }

  const reason = typeof rawReason === 'string' ? rawReason.trim() : '';
  if (reason === '') {
    return {
      ok: false,
      error: 'A reason is required when a discount is applied',
      details: 'e.g. Student, No cheaper room available, Repeating customer',
    };
  }
  if (reason.length > DISCOUNT_REASON_MAX_LENGTH) {
    return {
      ok: false,
      error: `The discount reason may not exceed ${DISCOUNT_REASON_MAX_LENGTH} characters`,
    };
  }

  if (maxDiscount <= 0) {
    return {
      ok: false,
      error: 'There is nothing left to discount on this folio',
      details:
        'The balance is already covered - drop the discount, or correct the final payment first',
    };
  }
  if (amount > maxDiscount) {
    return {
      ok: false,
      error: 'The discount is larger than the outstanding balance',
      details: `At most LKR ${Math.round(maxDiscount).toLocaleString()} can be discounted on this folio`,
    };
  }

  return { ok: true, discount: { amount, reason } };
}

/**
 * Compose the reason stored on the folio: the chosen preset, with the free-text
 * note appended when the receptionist added one (or used "Other").
 */
export function composeDiscountReason(preset: string, note: string): string {
  const cleanNote = note.trim();
  if (cleanNote === '') return '';
  if (preset === OTHER_DISCOUNT_REASON || preset === '') return cleanNote;
  return `${preset} — ${cleanNote}`;
}

/** Show a reason on a receipt / report without overflowing the column. */
export function shortDiscountReason(reason: string | null | undefined): string {
  if (!reason) return '';
  return reason.length > DISCOUNT_REASON_MAX_LENGTH
    ? `${reason.slice(0, DISCOUNT_REASON_MAX_LENGTH - 1)}…`
    : reason;
}
