// Guest interface for guest records
export interface Guest {
  id: string;
  name: string;
  phone_number: string;
  nic_number: string;
}

export interface Room {
  id: string;
  number: string;
  price: number | string;
  amenities: string[];
  isOccupied: boolean;
  isDueOut?: boolean; // True if the room has a guest departing today
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
