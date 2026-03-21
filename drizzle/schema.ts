import { pgTable, index, unique, serial, varchar, timestamp, foreignKey, integer, numeric, jsonb, boolean } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const guests = pgTable("guests", {
	id: serial().primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	phoneNumber: varchar("phone_number", { length: 20 }).notNull(),
	nicNumber: varchar("nic_number", { length: 20 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	index("idx_guests_name").using("btree", table.name.asc().nullsLast().op("text_ops")),
	index("idx_guests_nic").using("btree", table.nicNumber.asc().nullsLast().op("text_ops")),
	index("idx_guests_phone").using("btree", table.phoneNumber.asc().nullsLast().op("text_ops")),
	unique("guests_nic_number_key").on(table.nicNumber),
]);

export const bookings = pgTable("bookings", {
	id: serial().primaryKey().notNull(),
	guestId: integer("guest_id").notNull(),
	roomId: integer("room_id").notNull(),
	checkInDate: timestamp("check_in_date", { mode: 'string' }).notNull(),
	checkOutDate: timestamp("check_out_date", { mode: 'string' }),
	totalPrice: integer("total_price").notNull(),
	status: varchar({ length: 50 }).default('active').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	foreignKey({
			columns: [table.guestId],
			foreignColumns: [guests.id],
			name: "bookings_guest_id_fkey"
		}),
	foreignKey({
			columns: [table.roomId],
			foreignColumns: [rooms.id],
			name: "bookings_room_id_fkey"
		}),
]);

export const rooms = pgTable("rooms", {
	id: serial().primaryKey().notNull(),
	number: varchar({ length: 10 }).notNull(),
	price: numeric({ precision: 10, scale:  2 }),
	amenities: jsonb().default([]),
	isOccupied: boolean("is_occupied").default(false),
	checkOutTime: timestamp("check_out_time", { mode: 'string' }),
	guestName: varchar("guest_name", { length: 255 }),
	phoneNumber: varchar("phone_number", { length: 20 }),
	nicNumber: varchar("nic_number", { length: 20 }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	index("idx_rooms_number").using("btree", table.number.asc().nullsLast().op("text_ops")),
	index("idx_rooms_occupied").using("btree", table.isOccupied.asc().nullsLast().op("bool_ops")),
	unique("rooms_number_key").on(table.number),
]);

export const transactions = pgTable("transactions", {
	id: serial().primaryKey().notNull(),
	bookingId: integer("booking_id").notNull(),
	amount: integer().notNull(),
	paymentMethod: varchar("payment_method", { length: 50 }).notNull(),
	paymentType: varchar("payment_type", { length: 50 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	foreignKey({
			columns: [table.bookingId],
			foreignColumns: [bookings.id],
			name: "transactions_booking_id_fkey"
		}),
]);
