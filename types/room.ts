export interface Room {
  id: string;
  number: string;
  price: number | string;
  amenities: string[];
  isOccupied: boolean;
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
