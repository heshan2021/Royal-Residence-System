ALTER TABLE "rooms" ADD COLUMN "name" varchar(255);--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "size" varchar(50);--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "image_url" text;