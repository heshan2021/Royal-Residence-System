ALTER TABLE "bookings" ADD COLUMN "discount_amount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "discount_reason" varchar(255);--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "discount_applied_at" timestamp;