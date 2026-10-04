// Guest interface for guest records
export interface Guest {
  id: string;
  name: string;
  phone_number: string;
  nic_number: string;
}

// A folio that is still `active` even though its stay window has already ended.
// It keeps the room on the dashboard until it is paid AND checked out.
export interface OpenFolio {
  bookingId: number;        // Booking the check-out action must target
  guestName: string | null;
  totalAmount: number;      // Folio total
  paidAmount: number;       // Money recorded against the folio so far
  checkOutDate: string | null; // ISO instant of the scheduled check-out slot
  overdueDays: number;      // Whole Sri Lankan days since that check-out day
}

// A room that is SOLD but not yet occupied: its guest has a booking covering the
// day being viewed and has not arrived (bookings.checked_in_at is still NULL).
// The room must not be sold again, but nobody is in it - so it must never be
// counted or drawn as "Occupied".
export interface ReservedStay {
  bookingId: number;            // Reservation the check-in action must target
  guestName: string | null;
  checkInDate: string;          // ISO instant of the booked arrival slot
  checkOutDate: string | null;  // ISO instant of the booked departure slot
  nights: number;
  totalAmount: number;
  paidAmount: number;
}

export interface Room {
  id: string;
  number: string;
  price: number | string;
  amenities: string[];
  isOccupied: boolean;
  isReserved?: boolean; // True when the room is sold for the viewed day but its guest has not arrived
  reserved?: ReservedStay; // The reservation the card's check-in action should target
  reservationsOnDay?: ReservedStay[]; // Further reservations covering the viewed day (informational)
  isDueOut?: boolean; // True if the room has a guest departing today
  isOverdue?: boolean; // True when an active folio was never closed after its stay ended
  overdueDays?: number; // Whole Sri Lankan days since the unclosed folio's check-out day
  bookingId?: number; // Booking the card's check-out action should target
  openFolios?: OpenFolio[]; // Any further unclosed folios on this room (informational)
  checkOutTime?: string;
  guestName?: string;
  phoneNumber?: string;
  nicNumber?: string;
  // Payment fields
  totalAmount?: number;      // Total booking cost (price × days)
  paidAmount?: number;       // Amount already paid
  paymentMethod?: 'Cash' | 'Bank';  // Payment method for advance payment
}

// Payment method type for reuse
export type PaymentMethod = 'Cash' | 'Bank';

// A concession granted while settling a folio at check-out (student rate, no
// cheaper room free, repeating customer, goodwill ...). The amount may never
// exceed the balance still owed - the API rejects it - and it always needs a
// reason, so no money is ever given away anonymously.
export interface CheckOutSubmission {
  finalPayment?: number;
  paymentMethod?: PaymentMethod;
  earlyDeparture?: boolean;
  discountAmount?: number;
  discountReason?: string;
}

// What the desk sends to HOLD a room for a guest who has not arrived yet. The
// reservation is a normal booking except that no arrival is recorded, so the
// room is sold but still empty.
export interface ReservationSubmission {
  guestName: string;
  phoneNumber: string;
  nicNumber: string;
  checkInDate: Date;   // UTC midnight of the Sri Lankan arrival day
  checkOutDate: Date;  // UTC midnight of the Sri Lankan departure day
  advancePayment: number;
  paymentMethod?: PaymentMethod;
}

// The incumbent folio standing in the way of a reservation, as the API reports
// it. `canAcknowledge` is the API's own verdict, not the UI's: only the guest
// who is in the room right now, on a stay that begins today, may be confirmed
// out early. A future booking can never be overridden.
export interface OverlapConflict {
  bookingId: number;
  guestName: string | null;
  checkInDate: string;
  checkOutDate: string | null;
  inHouse: boolean;
  canAcknowledge: boolean;
}

// Result of a confirmed "book anyway": the incumbent guest left today, so that
// stay was cut to today's check-out slot, re-priced for the nights actually
// used, and any over-payment refunded. Their folio stays open until the desk
// settles it - which is why the room is only reserved, never checked in.
export interface ShortenedFolio {
  bookingId: number;
  guestName: string | null;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  bookedNights: number;
  previousTotal: number;
  totalAmount: number;
  paidAmount: number;
  refunded: number;
  outstandingBalance: number;
}

// Transaction history item for ledger display
export interface TransactionHistoryItem {
  transactionId: number;
  amount: number;
  method: string;
  type: string;
  date: string | null;
  guestName: string;
  guestNic: string;
  roomNumber: string;
}
