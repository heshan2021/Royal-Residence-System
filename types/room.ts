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

export interface Room {
  id: string;
  number: string;
  price: number | string;
  amenities: string[];
  isOccupied: boolean;
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
