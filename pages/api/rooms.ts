// Example usage of Neon client in an API route
import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../lib/neonClient';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Example: Fetch all rooms from a 'rooms' table
    const result = await query('SELECT * FROM rooms');
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Database error' });
  }
}
