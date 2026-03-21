// pages/api/transactions/index.ts
// API endpoint for fetching transaction history
// Joins transactions with bookings, guests, and rooms for complete ledger view

import type { NextApiRequest, NextApiResponse } from 'next';
import { db, transactions, bookings, guests, rooms } from '../../../src/db';
import { eq, desc } from 'drizzle-orm';

export interface TransactionHistoryItem {
  transactionId: number;
  amount: number;
  method: string;
  type: string;
  date: Date | null;
  guestName: string;
  guestNic: string;
  roomNumber: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Join transactions → bookings → guests & rooms
    // This gives us a complete view of each transaction with guest and room info
    const results = await db
      .select({
        transactionId: transactions.id,
        amount: transactions.amount,
        method: transactions.paymentMethod,
        type: transactions.paymentType,
        date: transactions.createdAt,
        guestName: guests.name,
        guestNic: guests.nicNumber,
        roomNumber: rooms.number,
      })
      .from(transactions)
      .innerJoin(bookings, eq(transactions.bookingId, bookings.id))
      .innerJoin(guests, eq(bookings.guestId, guests.id))
      .innerJoin(rooms, eq(bookings.roomId, rooms.id))
      .orderBy(desc(transactions.createdAt));

    return res.status(200).json(results);

  } catch (error) {
    console.error('Transaction history error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch transaction history',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
