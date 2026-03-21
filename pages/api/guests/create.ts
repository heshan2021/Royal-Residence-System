import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../lib/neonClient';

interface GuestData {
  name: string;
  phone_number: string;
  nic_number: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, phone_number, nic_number }: GuestData = req.body;

    // Validate required fields
    if (!name || !phone_number || !nic_number) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if guest already exists by NIC
    const existingResult = await query(
      'SELECT id, name, phone_number, nic_number FROM guests WHERE nic_number = $1',
      [nic_number.trim()]
    );

    if (existingResult.rows.length > 0) {
      // Return existing guest
      const existingGuest = existingResult.rows[0];
      return res.status(200).json({
        id: existingGuest.id.toString(),
        name: existingGuest.name,
        phone_number: existingGuest.phone_number,
        nic_number: existingGuest.nic_number,
      });
    }

    // Create new guest
    const result = await query(
      'INSERT INTO guests (name, phone_number, nic_number) VALUES ($1, $2, $3) RETURNING id, name, phone_number, nic_number',
      [name.trim(), phone_number.trim(), nic_number.trim()]
    );

    const newGuest = result.rows[0];
    
    return res.status(201).json({
      id: newGuest.id.toString(),
      name: newGuest.name,
      phone_number: newGuest.phone_number,
      nic_number: newGuest.nic_number,
    });
  } catch (error: any) {
    console.error('Database error in guests/create:', error);
    
    // Handle unique constraint violation
    if (error.code === '23505') { // PostgreSQL unique violation
      return res.status(409).json({ error: 'Guest with this NIC already exists' });
    }
    
    return res.status(500).json({ error: 'Database error' });
  }
}