CREATE TYPE "public"."expense_category" AS ENUM('Marketing', 'Maintenance', 'Guest Supplies', 'Utilities', 'Other');--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"amount" integer NOT NULL,
	"category" "expense_category" NOT NULL,
	"description" text,
	"expense_date" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "guests" DROP CONSTRAINT "guests_nic_number_key";--> statement-breakpoint
ALTER TABLE "rooms" DROP CONSTRAINT "rooms_number_key";--> statement-breakpoint
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_guest_id_fkey";
--> statement-breakpoint
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_room_id_fkey";
--> statement-breakpoint
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_booking_id_fkey";
--> statement-breakpoint
DROP INDEX "idx_guests_name";--> statement-breakpoint
DROP INDEX "idx_guests_nic";--> statement-breakpoint
DROP INDEX "idx_guests_phone";--> statement-breakpoint
DROP INDEX "idx_rooms_number";--> statement-breakpoint
DROP INDEX "idx_rooms_occupied";--> statement-breakpoint
ALTER TABLE "guests" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "guests" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "status" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "status" SET DEFAULT 'active';--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "rooms" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "rooms" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "payment_method" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "payment_type" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guests" ADD CONSTRAINT "guests_nic_number_unique" UNIQUE("nic_number");--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_number_unique" UNIQUE("number");