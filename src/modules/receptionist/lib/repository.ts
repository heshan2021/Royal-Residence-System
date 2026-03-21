// src/modules/receptionist/lib/repository.ts
// Repository Pattern implementation for Receptionist Module
// This file contains all database interactions for the receptionist module
// UI components should only call these functions, never import Drizzle/SQL directly

import { Room, PaymentMethod } from '../../../../types/room';
import { CheckInData } from '../components/CheckInModal';

// Mock database - in production, this would connect to Neon DB (Postgres) via Drizzle
// When migrating to Oracle VPS, only this file needs to be rewritten

const mockRooms: Room[] = [
  {
    id: 'room-301',
    number: '301',
    price: 'N/A',
    amenities: ['Family Friend'],
    isOccupied: true,
    checkOutTime: 'Long-term',
    guestName: 'Family Friend',
    phoneNumber: 'N/A',
    nicNumber: 'N/A',
  },
  { id: 'room-302', number: '302', price: 5000, amenities: ['No Balcony'], isOccupied: false },
  { id: 'room-303', number: '303', price: 5500, amenities: ['Balcony'], isOccupied: false },
  { id: 'room-201', number: '201', price: 6000, amenities: ['Large Room', 'Bathtub', 'Balcony'], isOccupied: false },
  { id: 'room-202', number: '202', price: 5000, amenities: ['No Balcony'], isOccupied: false },
  { id: 'room-203', number: '203', price: 5500, amenities: ['Balcony'], isOccupied: false },
  { id: 'room-101', number: '101', price: 4500, amenities: ['No Balcony'], isOccupied: false },
];

// In-memory storage for demo purposes
// In production, this would be replaced with actual database calls
let rooms: Room[] = [...mockRooms];

/**
 * Get all rooms
 * @returns Promise<Room[]> - Array of all rooms
 */
export async function getAllRooms(): Promise<Room[]> {
  // Simulate database delay
  await new Promise(resolve => setTimeout(resolve, 50));
  return [...rooms];
}

/**
 * Get room by ID
 * @param id - Room ID
 * @returns Promise<Room | null> - Room object or null if not found
 */
export async function getRoomById(id: string): Promise<Room | null> {
  await new Promise(resolve => setTimeout(resolve, 30));
  const room = rooms.find(r => r.id === id);
  return room ? { ...room } : null;
}

/**
 * Calculate amount due for a room
 * @param room - Room object
 * @returns number - Amount due (totalAmount - paidAmount)
 */
export function calculateAmountDue(room: Room): number {
  const totalAmount = room.totalAmount || 0;
  const paidAmount = room.paidAmount || 0;
  return Math.max(0, totalAmount - paidAmount);
}

/**
 * Get payment status for a room
 * @param room - Room object
 * @returns 'paid' | 'partial' | 'unpaid' | null
 */
export function getPaymentStatus(room: Room): 'paid' | 'partial' | 'unpaid' | null {
  if (!room.isOccupied || room.totalAmount === undefined) return null;
  
  const paidAmount = room.paidAmount || 0;
  const totalAmount = room.totalAmount;
  
  if (paidAmount >= totalAmount) return 'paid';
  if (paidAmount > 0) return 'partial';
  return 'unpaid';
}

/**
 * Check in a guest to a room
 * @param roomId - Room ID
 * @param checkInData - Check-in data from form
 * @returns Promise<Room> - Updated room object
 */
export async function checkInGuest(roomId: string, checkInData: CheckInData): Promise<Room> {
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const roomIndex = rooms.findIndex(r => r.id === roomId);
  if (roomIndex === -1) {
    throw new Error(`Room with ID ${roomId} not found`);
  }
  
  // Calculate total amount based on room price and days
  const roomPrice = typeof rooms[roomIndex].price === 'number' ? rooms[roomIndex].price : 0;
  const totalAmount = roomPrice * (checkInData.days || 1);
  const paidAmount = checkInData.advancePayment || 0;
  
  // Update room with guest information and payment details
  const updatedRoom: Room = {
    ...rooms[roomIndex],
    isOccupied: true,
    guestName: checkInData.guestName,
    phoneNumber: checkInData.phoneNumber,
    nicNumber: checkInData.nicNumber,
    checkOutTime: checkInData.checkOutTime,
    totalAmount,
    paidAmount,
    paymentMethod: paidAmount > 0 ? checkInData.paymentMethod : undefined,
  };
  
  rooms[roomIndex] = updatedRoom;
  return { ...updatedRoom };
}

/**
 * Record a payment for a room booking
 * @param roomId - Room ID
 * @param amount - Payment amount
 * @param method - Payment method (Cash or Bank)
 * @returns Promise<Room> - Updated room object
 */
export async function recordPayment(roomId: string, amount: number, method: PaymentMethod): Promise<Room> {
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const roomIndex = rooms.findIndex(r => r.id === roomId);
  if (roomIndex === -1) {
    throw new Error(`Room with ID ${roomId} not found`);
  }
  
  const room = rooms[roomIndex];
  if (!room.isOccupied) {
    throw new Error('Cannot record payment for unoccupied room');
  }
  
  const currentPaid = room.paidAmount || 0;
  const newPaidAmount = currentPaid + amount;
  
  const updatedRoom: Room = {
    ...room,
    paidAmount: newPaidAmount,
    paymentMethod: method,
  };
  
  rooms[roomIndex] = updatedRoom;
  return { ...updatedRoom };
}

/**
 * Check out a guest from a room
 * @param roomId - Room ID
 * @param finalPayment - Optional final payment amount
 * @param paymentMethod - Optional payment method for final payment
 * @returns Promise<Room> - Updated room object
 */
export async function checkOutGuest(
  roomId: string, 
  finalPayment?: number, 
  paymentMethod?: PaymentMethod
): Promise<Room> {
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const roomIndex = rooms.findIndex(r => r.id === roomId);
  if (roomIndex === -1) {
    throw new Error(`Room with ID ${roomId} not found`);
  }
  
  const room = rooms[roomIndex];
  
  // If there's a final payment, record it first
  if (finalPayment && finalPayment > 0 && paymentMethod) {
    const currentPaid = room.paidAmount || 0;
    room.paidAmount = currentPaid + finalPayment;
    room.paymentMethod = paymentMethod;
  }
  
  // Verify balance is settled
  const amountDue = calculateAmountDue(room);
  if (amountDue > 0) {
    throw new Error(`Cannot check out with outstanding balance of LKR ${amountDue.toLocaleString()}`);
  }
  
  // Clear guest information and payment details
  const updatedRoom: Room = {
    ...rooms[roomIndex],
    isOccupied: false,
    guestName: undefined,
    phoneNumber: undefined,
    nicNumber: undefined,
    checkOutTime: undefined,
    totalAmount: undefined,
    paidAmount: undefined,
    paymentMethod: undefined,
  };
  
  rooms[roomIndex] = updatedRoom;
  return { ...updatedRoom };
}

/**
 * Get room statistics
 * @returns Promise<{ total: number; occupied: number; available: number }>
 */
export async function getRoomStatistics(): Promise<{ total: number; occupied: number; available: number }> {
  await new Promise(resolve => setTimeout(resolve, 20));
  
  const occupied = rooms.filter(r => r.isOccupied).length;
  const total = rooms.length;
  const available = total - occupied;
  
  return { total, occupied, available };
}

/**
 * Reset rooms to initial state (for testing/demo purposes)
 * @returns Promise<void>
 */
export async function resetRooms(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 50));
  rooms = [...mockRooms];
}

/**
 * Update room information
 * @param roomId - Room ID
 * @param updates - Partial room updates
 * @returns Promise<Room> - Updated room object
 */
export async function updateRoom(roomId: string, updates: Partial<Room>): Promise<Room> {
  await new Promise(resolve => setTimeout(resolve, 80));
  
  const roomIndex = rooms.findIndex(r => r.id === roomId);
  if (roomIndex === -1) {
    throw new Error(`Room with ID ${roomId} not found`);
  }
  
  const updatedRoom: Room = {
    ...rooms[roomIndex],
    ...updates,
  };
  
  rooms[roomIndex] = updatedRoom;
  return { ...updatedRoom };
}
