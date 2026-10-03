# Database Management - Royal Residence Dashboard

## 🗃️ Database Overview

The system uses **Neon PostgreSQL** with **Drizzle ORM** for data persistence.

### Environment Variables Required
Create `.env.local` with:
```
NEON_DATABASE_URL=your_neon_connection_string
```

---

## 📊 Database Schema

### Tables

**`rooms`** - Room details, pricing, amenities, occupancy status
- `id` (serial, primary key)
- `number` (varchar, unique) - e.g., "101", "201"
- `price` (numeric) - Price per night in LKR
- `amenities` (jsonb) - Array of feature strings
- `isOccupied` (boolean)
- `guestName`, `phoneNumber`, `nicNumber` (varchar) - Current guest info
- `checkOutTime` (timestamp)

**`guests`** - Guest information
- `id` (serial, primary key)
- `name` (varchar)
- `phoneNumber` (varchar)
- `nicNumber` (varchar, unique)

**`bookings`** - Check-in/check-out records
- `id` (serial, primary key)
- `guestId` (foreign key → guests)
- `roomId` (foreign key → rooms)
- `checkInDate`, `checkOutDate` (timestamp)
- `totalPrice` (integer) - **net** amount the guest is charged (see Discounts below)
- `status` (varchar) - 'active' | 'completed' | 'cancelled'
- `discountAmount` (integer, default 0) - concession granted at check-out, in LKR
- `discountReason` (varchar 255) - why it was granted (required whenever the amount > 0)
- `discountAppliedAt` (timestamp) - when the concession was recorded (null = none)

**`transactions`** - Payment records
- `id` (serial, primary key)
- `bookingId` (foreign key → bookings)
- `amount` (integer) - Amount in LKR
- `paymentMethod` (varchar) - 'Cash' | 'Bank'
- `paymentType` (varchar) - 'advance' | 'final_settlement' | 'refund'

---

## 💸 Discounts (concessions at check-out)

A receptionist may knock money off a stay while settling the folio - a student
rate, a night where no cheaper room was free, a repeating customer, goodwill.
Rules enforced by `lib/discounts.ts` (shared by the API route and the modal):

- A discount **requires a reason**; the amount can never exceed what the folio
  still owes *after* the final payment.
- A discount only **forgives debt** - it never refunds cash. An over-payment
  stays a `refund` transaction (early departure), unchanged by this feature.
- `bookings.totalPrice` stores the **NET** (discounted) figure, so
  `SUM(transactions.amount)` still equals what the guest actually paid and every
  existing balance/revenue calculation keeps working. The folio's original price
  is therefore `totalPrice + discountAmount`.

The monthly accounting report (`/api/admin/monthly-report`) exports a
**DISCOUNT LEDGER** (date, folio, guest, room, gross, discount, net, reason)
plus "Total Discounts Given" / "Discounted Folios" lines so every rupee given
away is auditable.

---

## 🔄 Database Recovery / Seed Data

### ⚠️ IMPORTANT: If the database is ever wiped

Run the seed script to restore all baseline data:

```bash
npm run db:seed
```

This command will:
1. Clear any existing data (safe for recovery)
2. Insert all 7 rooms with correct pricing and amenities
3. Create the "Family Friend" guest record
4. Create the active booking for Room 301
5. Mark Room 301 as occupied

---

## 📋 Baseline Room Data (PERMANENT REFERENCE)

**This data must be preserved. If lost, re-run `npm run db:seed`**

| Room | Price (LKR/night) | Amenities | Default Status |
|------|-------------------|-----------|----------------|
| 101 | 4,500 | No Balcony | Available |
| 201 | 6,000 | Large Room, Bathtub, Balcony | Available |
| 202 | 5,000 | No Balcony | Available |
| 203 | 5,500 | Balcony | Available |
| **301** | **5,000** | **Family Friend** | **OCCUPIED** |
| 302 | 5,000 | No Balcony | Available |
| 303 | 5,500 | Balcony | Available |

### Room 301 - Long-term Guest Details
- **Guest Name**: Family Friend
- **Phone**: N/A
- **NIC Number**: LONGTERM001
- **Check-out**: Long-term (null/no expiration)
- **UI Behavior**: Non-interactive, permanently locked

---

## 🛠️ Drizzle Commands

```bash
# Seed the database with baseline data
npm run db:seed

# Generate migrations (if schema changes)
npx drizzle-kit generate

# Push schema directly to database
npx drizzle-kit push

# Open Drizzle Studio (database browser)
npx drizzle-kit studio
```

---

## 📁 File Locations

| File | Purpose |
|------|---------|
| `src/db/schema.ts` | Database schema definitions |
| `src/db/index.ts` | Drizzle client connection |
| `src/db/seed.ts` | **Baseline data seed script** |
| `drizzle.config.ts` | Drizzle configuration |
| `drizzle/` | Generated migrations |

---

## 🚨 Troubleshooting

### "NEON_DATABASE_URL not found"
- Ensure `.env.local` exists with the connection string
- The seed script loads from `.env.local`, not `.env`

### "ECONNREFUSED" error
- Check if Neon database is active/awake
- Verify connection string is correct
- Neon free tier databases may sleep after inactivity

### Data appears incorrect after refresh
- Room 301 should show as OCCUPIED with "Family Friend"
- If not, run `npm run db:seed` to restore
- Check API route `/api/rooms` is returning correct data

---

**Last Updated**: March 2026

**Seed Script Location**: `src/db/seed.ts`
