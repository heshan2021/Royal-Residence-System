import { relations } from "drizzle-orm/relations";
import { guests, bookings, rooms, transactions } from "./schema";

export const bookingsRelations = relations(bookings, ({one, many}) => ({
	guest: one(guests, {
		fields: [bookings.guestId],
		references: [guests.id]
	}),
	room: one(rooms, {
		fields: [bookings.roomId],
		references: [rooms.id]
	}),
	transactions: many(transactions),
}));

export const guestsRelations = relations(guests, ({many}) => ({
	bookings: many(bookings),
}));

export const roomsRelations = relations(rooms, ({many}) => ({
	bookings: many(bookings),
}));

export const transactionsRelations = relations(transactions, ({one}) => ({
	booking: one(bookings, {
		fields: [transactions.bookingId],
		references: [bookings.id]
	}),
}));