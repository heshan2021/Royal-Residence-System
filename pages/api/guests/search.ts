import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../lib/neonClient';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { q } = req.query;

  if (!q || typeof q !== 'string' || q.trim().length < 2) {
    return res.status(200).json([]);
  }

  try {
    const searchQuery = `%${q.toLowerCase().trim()}%`;
    
    const result = await query(
      `SELECT id, name, phone_number, nic_number FROM guests 
       WHERE LOWER(name) LIKE $1 
          OR LOWER(nic_number) LIKE $1 
          OR LOWER(phone_number) LIKE $1 
       ORDER BY name LIMIT 5`,
      [searchQuery]
    );
    
    const guests = result.rows.map(row => ({
      id: row.id.toString(),
      name: row.name,
      phone_number: row.phone_number,
      nic_number: row.nic_number,
    }));
    
    return res.status(200).json(guests);
  } catch (error) {
    console.error('Database error in guests/search:', error);
    return res.status(500).json({ error: 'Database error' });
  }
}