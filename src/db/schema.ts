// src/db/schema.ts
// Drizzle ORM Schema Definition for Receptionist Dashboard
// This file defines all database tables matching the actual Neon DB structure

import {
  pgTable,
  serial,
  varchar,
  integer,
  numeric,
  timestamp,
  boolean,
  jsonb,
  pgEnum,
  uuid,
  text,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================================================
// TABLES
// ============================================================================

/**
 * Rooms Table
 * Stores room information, pricing, and current occupancy status
 */
export const rooms = pgTable('rooms', {
  id: serial('id').primaryKey(),
  number: varchar('number', { length: 10 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  description: text('description'),
  size: varchar('size', { length: 50 }),
  image_url: text('image_url'),
  price: numeric('price', { precision: 10, scale: 2 }),
  amenities: jsonb('amenities').$type<string[]>().default([]),
  isOccupied: boolean('is_occupied').default(false),
  checkOutTime: timestamp('check_out_time'),
  guestName: varchar('guest_name', { length: 255 }),
  phoneNumber: varchar('phone_number', { length: 20 }),
  nicNumber: varchar('nic_number', { length: 20 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

/**
 * Guests Table
 * Stores guest information for historical tracking
 */
export const guests = pgTable('guests', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  phoneNumber: varchar('phone_number', { length: 20 }).notNull(),
  nicNumber: varchar('nic_number', { length: 20 }).notNull().unique(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

/**
 * Bookings Table
 * Tracks guest stays with check-in/check-out dates
 * Links guests to rooms for each stay
 */
export const bookings = pgTable('bookings', {
  id: serial('id').primaryKey(),
  guestId: integer('guest_id').notNull().references(() => guests.id),
  roomId: integer('room_id').notNull().references(() => rooms.id),
  checkInDate: timestamp('check_in_date').notNull(),
  checkOutDate: timestamp('check_out_date'),
  totalPrice: integer('total_price').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  createdAt: timestamp('created_at').defaultNow(),
});

/**
 * Transactions Table
 * Records all financial transactions (payments) for accounting purposes
 * Each payment (advance or final) creates a new transaction record
 */
export const transactions = pgTable('transactions', {
  id: serial('id').primaryKey(),
  bookingId: integer('booking_id').notNull().references(() => bookings.id),
  amount: integer('amount').notNull(), // Amount in LKR
  paymentMethod: varchar('payment_method', { length: 20 }).notNull(), // 'Cash' or 'Bank'
  paymentType: varchar('payment_type', { length: 20 }).notNull(), // 'advance' or 'final_settlement'
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================================================
// RELATIONS
// ============================================================================

/**
 * Guest Relations
 * A guest can have many bookings
 */
export const guestsRelations = relations(guests, ({ many }) => ({
  bookings: many(bookings),
}));

/**
 * Room Relations
 * A room can have many bookings over time
 */
export const roomsRelations = relations(rooms, ({ many }) => ({
  bookings: many(bookings),
}));

/**
 * Booking Relations
 * A booking belongs to one guest and one room
 * A booking can have many transactions
 */
export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  guest: one(guests, {
    fields: [bookings.guestId],
    references: [guests.id],
  }),
  room: one(rooms, {
    fields: [bookings.roomId],
    references: [rooms.id],
  }),
  transactions: many(transactions),
}));

/**
 * Transaction Relations
 * A transaction belongs to one booking
 */
export const transactionsRelations = relations(transactions, ({ one }) => ({
  booking: one(bookings, {
    fields: [transactions.bookingId],
    references: [bookings.id],
  }),
}));

// ============================================================================
// TYPE EXPORTS
// ============================================================================

// Inferred types from schema for use in application code
export type Room = typeof rooms.$inferSelect;
export type NewRoom = typeof rooms.$inferInsert;

export type Guest = typeof guests.$inferSelect;
export type NewGuest = typeof guests.$inferInsert;

export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

// Status types
export type BookingStatus = 'active' | 'completed' | 'cancelled';
export type PaymentMethod = 'Cash' | 'Bank';
export type PaymentType = 'advance' | 'final_settlement';

// Expense Category Enum
export const expenseCategoryEnum = pgEnum('expense_category', [
  'Marketing',
  'Maintenance',
  'Guest Supplies',
  'Utilities',
  'Other'
]);

/**
 * Expenses Table
 * Tracks business-wide expenses for accounting and profit calculation
 */
export const expenses = pgTable('expenses', {
  id: uuid('id').primaryKey().defaultRandom(),
  amount: integer('amount').notNull(), // Amount in LKR
  category: expenseCategoryEnum('category').notNull(),
  description: text('description'),
  expenseDate: timestamp('expense_date').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Expense types
export type Expense = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;
export type ExpenseCategory = typeof expenses.$inferSelect.category;
