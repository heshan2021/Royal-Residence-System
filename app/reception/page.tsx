// Main app page that imports the Receptionist Module
// This follows the feature-driven architecture where each module is self-contained

// Force dynamic rendering - disable Vercel static generation and caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import ReceptionistDashboard from '../../src/modules/receptionist/page';
import { Suspense } from 'react';
import { Room } from '../../types/room';

// Type definitions for initial data
interface Booking {
  roomNumber: string;
  checkInDate: string;
  checkOutDate: string | null;
  guestName: string;
  phoneNumber: string;
}

interface Statistics {
  total: number;
  occupied: number;
  available: number;
}

export interface InitialData {
  rooms: Room[];
  statistics: Statistics;
  monthlyBookings: Booking[];
}

// Server-side data fetching function
async function fetchInitialData(targetDate: Date): Promise<InitialData> {
  // Get base URL for API calls (server-side)
  // On Vercel, we can use relative URLs for internal API calls
  // For server-side fetching within the same app, we should use the internal host
  const isVercel = process.env.VERCEL === '1';
  let baseUrl: string;
  
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  } else if (isVercel) {
    // On Vercel, use the Vercel URL or default to relative URL
    baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '';
  } else {
    baseUrl = 'http://localhost:3000';
  }
  
  const dateStr = targetDate.toISOString().split('T')[0];
  const year = targetDate.getFullYear();
  const month = targetDate.getMonth() + 1; // JavaScript months are 0-indexed
  
  try {
    // Construct API URLs - use relative URLs if baseUrl is empty (Vercel internal calls)
    const roomsUrl = baseUrl ? `${baseUrl}/api/rooms?date=${dateStr}` : `/api/rooms?date=${dateStr}`;
    const bookingsUrl = baseUrl ? `${baseUrl}/api/bookings/monthly?year=${year}&month=${month}` : `/api/bookings/monthly?year=${year}&month=${month}`;
    
    // Fetch rooms and monthly bookings in parallel
    const [roomsResponse, bookingsResponse] = await Promise.all([
      fetch(roomsUrl, { 
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' }
      }),
      fetch(bookingsUrl, { 
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' }
      })
    ]);
    
    let rooms: Room[] = [];
    let monthlyBookings: Booking[] = [];
    
    if (roomsResponse.ok) {
      rooms = await roomsResponse.json();
    } else {
      console.error('Failed to fetch rooms:', roomsResponse.status);
    }
    
    if (bookingsResponse.ok) {
      monthlyBookings = await bookingsResponse.json();
    } else {
      console.error('Failed to fetch monthly bookings:', bookingsResponse.status);
    }
    
    // Calculate statistics from rooms data
    const occupied = rooms.filter(r => r.isOccupied).length;
    const total = rooms.length;
    const available = total - occupied;
    
    const statistics: Statistics = { total, occupied, available };
    
    return { rooms, statistics, monthlyBookings };
  } catch (error) {
    console.error('Error fetching initial data:', error);
    // Return empty data on error - client will handle loading states
    return {
      rooms: [],
      statistics: { total: 0, occupied: 0, available: 0 },
      monthlyBookings: []
    };
  }
}

// Server component that reads URL search parameters
export default async function ReceptionPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Await the searchParams promise (Next.js 15+ compatibility)
  const params = await searchParams;
  
  // Parse date from URL search parameters (format: YYYY-MM-DD)
  const dateParam = params?.date;
  let targetDate: Date;
  
  if (dateParam && typeof dateParam === 'string') {
    const parsedDate = new Date(dateParam);
    if (!isNaN(parsedDate.getTime())) {
      targetDate = parsedDate;
    } else {
      targetDate = new Date();
    }
  } else {
    targetDate = new Date();
  }

  // Fetch all data server-side for instant view switching
  const initialData = await fetchInitialData(targetDate);

  return (
    <Suspense fallback={<div>Loading dashboard...</div>}>
      <ReceptionistDashboard targetDate={targetDate} initialData={initialData} />
    </Suspense>
  );
}
