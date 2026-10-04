ALTER TABLE "bookings" ADD COLUMN "checked_in_at" timestamp;--> statement-breakpoint
-- Backfill: before reservations existed a booking row *was* the arrival - the
-- desk only ever created one for a guest standing at the counter. So every row
-- that predates this column belongs to a guest who has already arrived, and its
-- arrival is its booked check-in date. Leaving them NULL would re-read live
-- stays (and unclosed folios) as un-arrived reservations.
UPDATE "bookings" SET "checked_in_at" = "check_in_date" WHERE "checked_in_at" IS NULL;
