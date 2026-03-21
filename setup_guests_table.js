const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Read the database URL from .env.local
const envContent = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf8');
const match = envContent.match(/NEON_DATABASE_URL='([^']+)'/);
const connectionString = match ? match[1] : process.env.NEON_DATABASE_URL;

if (!connectionString) {
  console.error('Error: NEON_DATABASE_URL not found in .env.local or environment variables');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function setupGuestsTable() {
  const client = await pool.connect();
  
  try {
    console.log('Connecting to Neon database...');
    
    // Read the SQL file
    const sql = fs.readFileSync(path.join(__dirname, 'create_guests_table.sql'), 'utf8');
    
    console.log('Creating guests table...');
    const result = await client.query(sql);
    
    if (result.rows && result.rows[0] && result.rows[0].message) {
      console.log('✅', result.rows[0].message);
    } else {
      console.log('✅ Guests table created successfully');
    }
    
    // Verify the table exists
    const verifyResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'guests'
    `);
    
    if (verifyResult.rows.length > 0) {
      console.log('✅ Verified: guests table exists in the database');
      
      // Count guests
      const countResult = await client.query('SELECT COUNT(*) as count FROM guests');
      console.log(`📊 Total guests in database: ${countResult.rows[0].count}`);
    } else {
      console.log('❌ Warning: guests table not found after creation');
    }
    
  } catch (error) {
    console.error('❌ Error creating guests table:', error.message);
    if (error.code === '23505') {
      console.log('Note: Some guests may already exist (unique constraint violation)');
    }
  } finally {
    client.release();
    await pool.end();
  }
}

setupGuestsTable().catch(console.error);