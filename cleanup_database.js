// cleanup_database.js
// Script to clean all test data from Neon PostgreSQL database

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  // Simple parsing - just extract the URL
  const lines = envContent.split('\n');
  for (const line of lines) {
    if (line.includes('NEON_DATABASE_URL=')) {
      const parts = line.split('=');
      if (parts.length >= 2) {
        let value = parts.slice(1).join('=').trim();
        // Remove surrounding quotes
        if ((value.startsWith("'") && value.endsWith("'")) || 
            (value.startsWith('"') && value.endsWith('"'))) {
          value = value.slice(1, -1);
        }
        process.env.NEON_DATABASE_URL = value;
        console.log('Loaded NEON_DATABASE_URL from .env.local');
        break;
      }
    }
  }
}

const neonConnectionString = process.env.NEON_DATABASE_URL;

if (!neonConnectionString) {
  console.error('Error: NEON_DATABASE_URL environment variable is not set.');
  console.error('Make sure you have a .env.local file with NEON_DATABASE_URL');
  process.exit(1);
}

const pool = new Pool({
  connectionString: neonConnectionString,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function cleanupDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('Starting database cleanup...');
    
    // Start transaction
    await client.query('BEGIN');
    
    // 1. First, delete all transactions (depends on bookings)
    console.log('Deleting all transactions...');
    const transactionsResult = await client.query('DELETE FROM transactions');
    console.log(`Deleted ${transactionsResult.rowCount} transactions`);
    
    // 2. Delete all bookings (depends on guests and rooms)
    console.log('Deleting all bookings...');
    const bookingsResult = await client.query('DELETE FROM bookings');
    console.log(`Deleted ${bookingsResult.rowCount} bookings`);
    
    // 3. Delete all guests (except sample data we'll re-insert)
    console.log('Deleting all guests...');
    const guestsResult = await client.query('DELETE FROM guests');
    console.log(`Deleted ${guestsResult.rowCount} guests`);
    
    // 4. Reset rooms to default state (clear guest info, mark as unoccupied)
    console.log('Resetting rooms to default state...');
    const roomsResult = await client.query(`
      UPDATE rooms SET 
        is_occupied = false,
        guest_name = NULL,
        phone_number = NULL,
        nic_number = NULL,
        check_out_time = NULL,
        updated_at = CURRENT_TIMESTAMP
    `);
    console.log(`Reset ${roomsResult.rowCount} rooms`);
    
    // 5. Re-insert sample guest data
    console.log('Re-inserting sample guest data...');
    const insertResult = await client.query(`
      INSERT INTO guests (name, phone_number, nic_number) VALUES
      ('John Silva', '0771234567', '199012345678'),
      ('Kumari Perera', '0712345678', '198576543210'),
      ('Ranjith Fernando', '0761122334', '197834567890')
      ON CONFLICT (nic_number) DO NOTHING
    `);
    console.log(`Inserted/updated ${insertResult.rowCount} sample guests`);
    
    // 6. Reset room amenities to default
    console.log('Resetting room amenities...');
    const amenitiesResult = await client.query(`
      UPDATE rooms SET 
        amenities = '[]'::jsonb,
        updated_at = CURRENT_TIMESTAMP
    `);
    console.log(`Reset amenities for ${amenitiesResult.rowCount} rooms`);
    
    // Commit transaction
    await client.query('COMMIT');
    
    console.log('\n✅ Database cleanup completed successfully!');
    
    // 7. Verify cleanup
    console.log('\nVerification:');
    const verification = await client.query(`
      SELECT 'Transactions count:' as table_name, COUNT(*) as count FROM transactions
      UNION ALL
      SELECT 'Bookings count:', COUNT(*) FROM bookings
      UNION ALL
      SELECT 'Guests count:', COUNT(*) FROM guests
      UNION ALL
      SELECT 'Occupied rooms:', COUNT(*) FROM rooms WHERE is_occupied = true
    `);
    
    verification.rows.forEach(row => {
      console.log(`${row.table_name} ${row.count}`);
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error during database cleanup:', error);
    throw error;
  } finally {
    client.release();
  }
}

cleanupDatabase()
  .then(() => {
    console.log('\nCleanup script finished.');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Cleanup script failed:', error);
    process.exit(1);
  });