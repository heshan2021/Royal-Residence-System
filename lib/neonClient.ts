// lib/neonClient.ts
import { Pool } from 'pg';

const neonConnectionString = process.env.NEON_DATABASE_URL!;

export const pool = new Pool({
  connectionString: neonConnectionString,
  ssl: {
    rejectUnauthorized: false, // For Neon, this is often needed
  },
});

// Example query function
export const query = async (text: string, params?: any[]) => {
  const client = await pool.connect();
  try {
    const res = await client.query(text, params);
    return res;
  } finally {
    client.release();
  }
};
