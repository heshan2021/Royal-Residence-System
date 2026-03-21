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
}
