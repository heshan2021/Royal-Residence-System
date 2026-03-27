// src/db/seed.ts
// Database Seed Script for Receptionist Dashboard
// Populates the Neon database with baseline rooms, features, and long-term guest data
//
// Run with: npm run db:seed

import * as dotenv from 'dotenv';
// Load from .env.local (same as drizzle.config.ts)
dotenv.config({ path: '.env.local' });

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { rooms, guests, bookings } from './schema';
import { eq } from 'drizzle-orm';

async function seed() {
  console.log('🌱 Starting database seed...\n');
  console.log('📍 Using NEXT_PUBLIC_NEON_DATABASE_URL:', process.env.NEXT_PUBLIC_NEON_DATABASE_URL ? 'Found' : 'NOT FOUND');

  if (!process.env.NEXT_PUBLIC_NEON_DATABASE_URL) {
    throw new Error('NEXT_PUBLIC_NEON_DATABASE_URL not found in .env.local');
  }

  // Create database connection
  const pool = new Pool({
    connectionString: process.env.NEXT_PUBLIC_NEON_DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  const db = drizzle(pool);

  try {
    // ========================================================================
    // STEP 1: Clear existing data (in correct order due to foreign keys)
    // ========================================================================
    console.log('🗑️  Clearing existing data...');
    // Delete in correct order due to foreign key constraints
    // First delete transactions (references bookings)
    // Then delete bookings (references guests and rooms)
    // Then delete guests and rooms
    const { transactions } = await import('./schema');
    await db.delete(transactions);
    await db.delete(bookings);
    await db.delete(guests);
    await db.delete(rooms);
    console.log('✅ Existing data cleared.\n');

    // ========================================================================
    // STEP 2: Insert all 7 rooms
    // ========================================================================
    console.log('🏨 Inserting rooms...');

    // Calculate dates for Room 301's long-term booking
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const roomsData = [
      {
        number: '101',
        price: '4500.00',
        amenities: ['No Balcony'],
        isOccupied: false,
      },
      {
        number: '201',
        price: '6000.00',
        amenities: ['Large Room', 'Bathtub', 'Balcony'],
        isOccupied: false,
      },
      {
        number: '202',
        price: '5000.00',
        amenities: ['No Balcony'],
        isOccupied: false,
      },
      {
        number: '203',
        price: '5500.00',
        amenities: ['Balcony'],
        isOccupied: false,
      },
      {
        number: '301',
        price: '5000.00',
        amenities: ['Family Friend'],
        isOccupied: true,
        guestName: 'Family Friend',
        phoneNumber: 'N/A',
        nicNumber: 'LONGTERM001',
        checkOutTime: null, // Long-term stay - no check-out date
      },
      {
        number: '302',
        price: '5000.00',
        amenities: ['No Balcony'],
        isOccupied: false,
      },
      {
        number: '303',
        price: '5500.00',
        amenities: ['Balcony'],
        isOccupied: false,
      },
    ];

    const insertedRooms = await db.insert(rooms).values(roomsData).returning();
    console.log(`✅ Inserted ${insertedRooms.length} rooms.\n`);

    // Log room details
    for (const room of insertedRooms) {
      const status = room.isOccupied ? '🔴 OCCUPIED' : '🟢 AVAILABLE';
      console.log(`   Room ${room.number}: ${room.price} LKR/night, Features: ${JSON.stringify(room.amenities)} ${status}`);
    }
    console.log('');

    // ========================================================================
    // STEP 3: Insert long-term guest for Room 301
    // ========================================================================
    console.log('👤 Inserting long-term guest...');

    const [longTermGuest] = await db.insert(guests).values({
      name: 'Family Friend',
      phoneNumber: 'N/A',
      nicNumber: 'LONGTERM001',
    }).returning();

    console.log(`✅ Inserted guest: ${longTermGuest.name} (NIC: ${longTermGuest.nicNumber})\n`);

    // ========================================================================
    // STEP 4: Create booking for Room 301 (long-term stay)
    // ========================================================================
    console.log('📋 Creating long-term booking for Room 301...');

    // Find Room 301
    const room301 = insertedRooms.find(r => r.number === '301');
    if (!room301) {
      throw new Error('Room 301 not found!');
    }

    const [longTermBooking] = await db.insert(bookings).values({
      guestId: longTermGuest.id,
      roomId: room301.id,
      checkInDate: thirtyDaysAgo,
      checkOutDate: null, // Long-term - no set check-out
      totalPrice: 0,
      status: 'active',
    }).returning();

    console.log(`✅ Created booking #${longTermBooking.id} for Room 301`);
    console.log(`   Check-in: ${thirtyDaysAgo.toLocaleDateString()}`);
    console.log(`   Check-out: Long-term (no date set)`);
    console.log(`   Status: ${longTermBooking.status}\n`);

    // ========================================================================
    // SUMMARY
    // ========================================================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🎉 DATABASE SEED COMPLETED SUCCESSFULLY!');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log('Summary:');
    console.log('  • 7 rooms inserted');
    console.log('  • 1 long-term guest created (Family Friend)');
    console.log('  • Room 301 is OCCUPIED by Family Friend');
    console.log('');

  } catch (error) {
    console.error('❌ Error during seed:', error);
    throw error;
  } finally {
    await pool.end();
    console.log('🔌 Database connection closed.');
  }
}

// Run the seed
seed()
  .then(() => {
    console.log('\n✨ Seed script finished.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Seed script failed:', error);
    process.exit(1);
  });
