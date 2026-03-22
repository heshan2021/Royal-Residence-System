// src/modules/receptionist/lib/repository.ts
// Repository Pattern implementation for Receptionist Module
// This file contains all database interactions via API routes
// UI components should only call these functions

import { Room as UIRoom, PaymentMethod, Guest as UIGuest, TransactionHistoryItem } from '../../../../types/room';
import { CheckInData } from '../components/CheckInModal';

// ============================================================================
// ROOM MANAGEMENT - Using Database via API
// ============================================================================

/**
 * Get all rooms from database
 * @param targetDate - Optional date to check room occupancy for (defaults to current date)
 * @returns Promise<UIRoom[]> - Array of all rooms with payment info
 */
export async function getAllRooms(targetDate?: Date): Promise<UIRoom[]> {
  try {
    const url = targetDate 
      ? `/api/rooms?date=${targetDate.toISOString().split('T')[0]}`
      : '/api/rooms';
    
    const response = await fetch(url, { cache: 'no-store' });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const rooms = await response.json();
    
    // Room data is now fully managed from the database
    // Room 301's guest info, checkOutTime, isOccupied etc. comes from DB
    return rooms;
  } catch (error) {
    console.error('Failed to fetch rooms:', error);
    // Return empty array on error
    return [];
  }
}

/**
 * Get room by ID
 * @param id - Room ID (format: 'room-302')
 * @returns Promise<UIRoom | null> - Room object or null if not found
 */
export async function getRoomById(id: string): Promise<UIRoom | null> {
  const rooms = await getAllRooms();
  return rooms.find(r => r.id === id) || null;
}

/**
 * Calculate amount due for a room
 * @param room - Room object
 * @returns number - Amount due (totalAmount - paidAmount)
 */
export function calculateAmountDue(room: UIRoom): number {
  const totalAmount = room.totalAmount || 0;
  const paidAmount = room.paidAmount || 0;
  return Math.max(0, totalAmount - paidAmount);
}

/**
 * Get payment status for a room
 * @param room - Room object
 * @returns 'paid' | 'partial' | 'unpaid' | null
 */
export function getPaymentStatus(room: UIRoom): 'paid' | 'partial' | 'unpaid' | null {
  if (!room.isOccupied || room.totalAmount === undefined) return null;
  
  const paidAmount = room.paidAmount || 0;
  const totalAmount = room.totalAmount;
  
  if (paidAmount >= totalAmount) return 'paid';
  if (paidAmount > 0) return 'partial';
  return 'unpaid';
}

/**
 * Check in a guest to a room
 * Creates booking, records advance payment, updates room status
 * @param roomId - Room ID (format: 'room-302')
 * @param checkInData - Check-in data from form
 * @returns Promise<UIRoom> - Updated room object
 */
export async function checkInGuest(roomId: string, checkInData: CheckInData): Promise<UIRoom> {
  // Extract room number from ID (e.g., 'room-302' -> '302')
  const roomNumber = roomId.replace('room-', '');
  
  // Calculate total amount based on room price and days
  const rooms = await getAllRooms();
  const room = rooms.find(r => r.id === roomId);
  const roomPrice = room && typeof room.price === 'number' ? room.price : 0;
  const totalAmount = roomPrice * (checkInData.days || 1);
  
  try {
    // Format dates as YYYY-MM-DD (date-only) for API to add standardized hotel times
    const checkInDateStr = checkInData.checkInDate.toISOString().split('T')[0];
    const checkOutDateStr = checkInData.checkOutDate.toISOString().split('T')[0];
    
    const response = await fetch('/api/rooms/checkin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        roomNumber,
        guestName: checkInData.guestName,
        phoneNumber: checkInData.phoneNumber,
        nicNumber: checkInData.nicNumber,
        checkInDate: checkInDateStr,
        checkOutDate: checkOutDateStr,
        totalAmount,
        advancePayment: checkInData.advancePayment,
        paymentMethod: checkInData.paymentMethod,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      // The API now returns detailed error messages with specific booked dates
      const errorMessage = errorData.error || `Check-in failed: ${response.status}`;
      // Include details if available, but the main error message should be sufficient
      throw new Error(errorMessage);
    }
    
    const result = await response.json();
    
    // Return the updated room in UI format
    return {
      id: roomId,
      number: roomNumber,
      price: roomPrice,
      amenities: room?.amenities || [],
      isOccupied: true,
      guestName: checkInData.guestName,
      phoneNumber: checkInData.phoneNumber,
      nicNumber: checkInData.nicNumber,
      checkOutTime: checkInData.checkOutDate.toISOString(),
      totalAmount,
      paidAmount: checkInData.advancePayment || 0,
      paymentMethod: checkInData.advancePayment ? checkInData.paymentMethod : undefined,
    };
  } catch (error) {
    console.error('Check-in error:', error);
    throw error;
  }
}

/**
 * Check out a guest from a room
 * Records final payment, updates booking status, clears room
 * @param roomId - Room ID
 * @param finalPayment - Optional final payment amount
 * @param paymentMethod - Optional payment method for final payment
 * @returns Promise<UIRoom> - Updated room object
 */
export async function checkOutGuest(
  roomId: string, 
  finalPayment?: number, 
  paymentMethod?: PaymentMethod
): Promise<UIRoom> {
  // Extract room number from ID
  const roomNumber = roomId.replace('room-', '');
  
  // Get current room to verify balance
  const rooms = await getAllRooms();
  const room = rooms.find(r => r.id === roomId);
  
  if (!room) {
    throw new Error(`Room ${roomNumber} not found`);
  }
  
  // Calculate if balance will be settled
  const currentPaid = room.paidAmount || 0;
  const totalAmount = room.totalAmount || 0;
  const newPaidAmount = currentPaid + (finalPayment || 0);
  
  if (newPaidAmount < totalAmount) {
    const remaining = totalAmount - newPaidAmount;
    throw new Error(`Cannot check out with outstanding balance of LKR ${remaining.toLocaleString()}`);
  }
  
  try {
    const response = await fetch('/api/rooms/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        roomNumber,
        finalPayment,
        paymentMethod,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Check-out failed: ${response.status}`);
    }
    
    // Return the cleared room
    return {
      id: roomId,
      number: roomNumber,
      price: room.price,
      amenities: room.amenities || [],
      isOccupied: false,
      guestName: undefined,
      phoneNumber: undefined,
      nicNumber: undefined,
      checkOutTime: undefined,
      totalAmount: undefined,
      paidAmount: undefined,
      paymentMethod: undefined,
    };
  } catch (error) {
    console.error('Check-out error:', error);
    throw error;
  }
}

/**
 * Record a payment for a room booking
 * @param roomId - Room ID
 * @param amount - Payment amount
 * @param method - Payment method (Cash or Bank)
 * @returns Promise<UIRoom> - Updated room object
 */
export async function recordPayment(roomId: string, amount: number, method: PaymentMethod): Promise<UIRoom> {
  // For now, payments are recorded through check-in (advance) and check-out (final)
  // This function is kept for future use if we need mid-stay payments
  throw new Error('Mid-stay payments not implemented yet - use check-in or check-out');
}

/**
 * Get room statistics
 * @param targetDate - Optional date to check room occupancy for (defaults to current date)
 * @returns Promise<{ total: number; occupied: number; available: number }>
 */
export async function getRoomStatistics(targetDate?: Date): Promise<{ total: number; occupied: number; available: number }> {
  const rooms = await getAllRooms(targetDate);
  
  const occupied = rooms.filter(r => r.isOccupied).length;
  const total = rooms.length;
  const available = total - occupied;
  
  return { total, occupied, available };
}

// ============================================================================
// GUEST MANAGEMENT
// ============================================================================

/**
 * Search for guests by name, NIC number, or phone number
 * @param query - Search query string (partial match)
 * @returns Promise<UIGuest[]> - Array of matching guests
 */
export async function findGuestByQuery(query: string): Promise<UIGuest[]> {
  if (!query || query.trim().length < 2) {
    return [];
  }
  
  try {
    const response = await fetch(`/api/guests/search?q=${encodeURIComponent(query)}`);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error searching guests:', error);
    return [];
  }
}

/**
 * Find a guest by exact NIC number match
 * @param nic - NIC number to search
 * @returns Promise<UIGuest | null> - Guest object or null if not found
 */
export async function findGuestByNic(nic: string): Promise<UIGuest | null> {
  try {
    const response = await fetch(`/api/guests/search?q=${encodeURIComponent(nic)}`);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const guests = await response.json();
    const exactMatch = guests.find((guest: UIGuest) => guest.nic_number === nic.trim());
    return exactMatch || null;
  } catch (error) {
    console.error('Error finding guest by NIC:', error);
    return null;
  }
}

/**
 * Create a new guest record
 * @param guestData - Guest data without ID
 * @returns Promise<UIGuest> - Created guest object
 */
export async function createGuest(guestData: Omit<UIGuest, 'id'>): Promise<UIGuest> {
  try {
    const response = await fetch('/api/guests/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(guestData),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error creating guest:', error);
    throw error;
  }
}

/**
 * Get a guest by ID
 * @param id - Guest ID
 * @returns Promise<UIGuest | null> - Guest object or null if not found
 */
export async function getGuestById(id: string): Promise<UIGuest | null> {
  return null;
}

/**
 * Update a guest record
 * @param id - Guest ID
 * @param updates - Partial guest updates
 * @returns Promise<UIGuest> - Updated guest object
 */
export async function updateGuest(id: string, updates: Partial<Omit<UIGuest, 'id'>>): Promise<UIGuest> {
  throw new Error('Update guest not implemented with API yet');
}

// ============================================================================
// EXPENSE MANAGEMENT
// ============================================================================

/**
 * Add a new business expense
 * @param amount - Expense amount in LKR
 * @param category - Expense category (Marketing, Maintenance, Guest Supplies, Utilities, Other)
 * @param description - Optional description of the expense
 * @returns Promise<{ id: string; amount: number; category: string; description: string | null; expenseDate: string; createdAt: string }>
 */
export async function addExpense(amount: number, category: string, description?: string): Promise<{ 
  id: string; 
  amount: number; 
  category: string; 
  description: string | null; 
  expenseDate: string; 
  createdAt: string 
}> {
  try {
    const response = await fetch('/api/admin/expenses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ amount, category, description }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to add expense: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error adding expense:', error);
    throw error;
  }
}

// ============================================================================
// BOOKING MANAGEMENT
// ============================================================================

/**
 * Get upcoming bookings for a specific room
 * @param roomId - Room ID (format: 'room-302')
 * @returns Promise<Array<{ checkInDate: string; checkOutDate: string | null; guestName: string }>>
 */
export async function getUpcomingBookings(roomId: string): Promise<Array<{ checkInDate: string; checkOutDate: string | null; guestName: string }>> {
  try {
    const roomNumber = roomId.replace('room-', '');
    const response = await fetch(`/api/rooms/${roomNumber}/bookings`, { cache: 'no-store' });
    
    if (!response.ok) {
      // If endpoint doesn't exist yet, return empty array
      if (response.status === 404) {
        return [];
      }
      throw new Error(`API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch upcoming bookings:', error);
    return [];
  }
}

/**
 * Get all active bookings for a specific month
 * @param year - Year (e.g., 2025)
 * @param month - Month (1-12)
 * @returns Promise<Array<{ roomNumber: string; checkInDate: string; checkOutDate: string | null; guestName: string; phoneNumber: string }>>
 */
export async function getMonthlyBookings(year: number, month: number): Promise<Array<{ roomNumber: string; checkInDate: string; checkOutDate: string | null; guestName: string; phoneNumber: string }>> {
  try {
    const response = await fetch(`/api/bookings/monthly?year=${year}&month=${month}`, { cache: 'no-store' });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch monthly bookings:', error);
    return [];
  }
}

// ============================================================================
// TRANSACTION HISTORY
// ============================================================================

/**
 * Get complete transaction history with guest and room details
 * Fetches all transactions joined with bookings, guests, and rooms
 * @returns Promise<TransactionHistoryItem[]> - Array of transaction records ordered by date (newest first)
 */
export async function getTransactionHistory(): Promise<TransactionHistoryItem[]> {
  try {
    const response = await fetch('/api/transactions', { cache: 'no-store' });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch transaction history:', error);
    return [];
  }
}
