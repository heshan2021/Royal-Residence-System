'use client';

import { useState } from 'react';
import { DollarSign, Plus } from 'lucide-react';
import Link from 'next/link';
import DashboardView from './components/DashboardView';
import CalendarView from './components/CalendarView';
import ViewToggle from './components/ViewToggle';
import AddExpenseModal from '../../../app/admin/accounting/AddExpenseModal';
import { Room } from '../../../types/room';

// Type definitions for initial data (must match app/page.tsx)
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

interface ReceptionistDashboardProps {
  targetDate: Date;
  initialData: InitialData;
}

export default function ReceptionistDashboard({ targetDate, initialData }: ReceptionistDashboardProps) {
  const [view, setView] = useState<'dashboard' | 'calendar'>('dashboard');
  const [selectedDate, setSelectedDate] = useState<string>(
    targetDate.toISOString().split('T')[0]
  );
  const [showExpenseModal, setShowExpenseModal] = useState(false);

  return (
    <div className="min-h-screen w-full bg-slate-50 flex justify-center">
      
      <main className="w-full max-w-[1400px] px-10 sm:px-14 lg:px-20 py-12">
        
        {/* Header */}
        <header className="mb-12 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Royal Residence</h1>
            <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mt-1">Receptionist Dashboard</p>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <ViewToggle view={view} onViewChange={setView} />
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowExpenseModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 
                         text-white rounded-lg transition-all duration-200"
              >
                <Plus size={18} />
                <span className="text-sm font-medium">Add Expense</span>
              </button>
              <Link
                href="/admin/accounting"
                className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 
                         border border-slate-200 rounded-lg text-slate-700 transition-all duration-200"
              >
                <DollarSign size={18} />
                <span className="text-sm font-medium">Accounting</span>
              </Link>
              <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-slate-500 uppercase tracking-wider bg-white px-4 py-2 rounded-full shadow-sm border border-slate-200">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                <span>Live System</span>
              </div>
            </div>
          </div>
        </header>

        {/* OPTIMIZED: Render BOTH views simultaneously with CSS hiding for 0ms toggle latency */}
        {/* Dashboard View - shown when view === 'dashboard' */}
        <div className={view === 'dashboard' ? 'block' : 'hidden'}>
          <DashboardView 
            targetDate={targetDate} 
            selectedDate={selectedDate} 
            onDateChange={setSelectedDate}
            initialRooms={initialData.rooms}
            initialStatistics={initialData.statistics}
          />
        </div>

        {/* Calendar View - shown when view === 'calendar' */}
        <div className={view === 'calendar' ? 'block' : 'hidden'}>
          <CalendarView 
            targetDate={targetDate}
            initialBookings={initialData.monthlyBookings}
          />
        </div>

      </main>

      {/* Add Expense Modal */}
      <AddExpenseModal
        isOpen={showExpenseModal}
        onClose={() => setShowExpenseModal(false)}
        onExpenseAdded={() => {
          // Expenses added from receptionist dashboard don't need to refresh room data
          // But we could show a toast notification here if desired
        }}
      />
    </div>
  );
}
