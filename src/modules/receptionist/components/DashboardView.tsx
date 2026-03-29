'use client';

import { useCallback, useEffect, useState } from 'react';
import { Building2, Users, DoorOpen, DollarSign, Plus, Calendar } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { RoomCard } from './RoomCard';
import { CheckInModal, CheckInData } from './CheckInModal';
import { CheckOutModal } from './CheckOutModal';
import AddExpenseModal from '../../../../app/admin/accounting/AddExpenseModal';
import { Room } from '../../../../types/room';
import { 
  getAllRooms, 
  checkInGuest, 
  checkOutGuest, 
  getRoomStatistics,
  calculateAmountDue
} from '../lib/repository';

interface Statistics {
  total: number;
  occupied: number;
  available: number;
}

interface DashboardViewProps {
  targetDate: Date;
  selectedDate: string;
  onDateChange: (date: string) => void;
  initialRooms: Room[];
  initialStatistics: Statistics;
}

export default function DashboardView({ targetDate, selectedDate, onDateChange, initialRooms, initialStatistics }: DashboardViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rooms, setRooms] = useState<Room[]>(initialRooms);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [modalType, setModalType] = useState<'checkin' | 'checkout' | null>(null);
  const [isLoading, setIsLoading] = useState(false); // Start as false since we have initial data
  const [statistics, setStatistics] = useState(initialStatistics);
  const [showExpenseModal, setShowExpenseModal] = useState(false);

  const loadRooms = useCallback(async () => {
    setIsLoading(true);
    try {
      const roomsData = await getAllRooms(selectedDate ? new Date(selectedDate) : undefined);
      const stats = await getRoomStatistics(selectedDate ? new Date(selectedDate) : undefined);
      setRooms(roomsData);
      setStatistics(stats);
    } catch (error) {
      console.error('Failed to load rooms:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    onDateChange(newDate);
    
    // Update URL with new date parameter
    const params = new URLSearchParams(searchParams?.toString() || '');
    if (newDate) {
      params.set('date', newDate);
    } else {
      params.delete('date');
    }
    router.push(`?${params.toString()}`);
  };

  const handleRoomClick = useCallback((room: Room) => {
    if (room.id === 'room-301') return;
    
    setSelectedRoom(room);
    if (room.isDueOut || room.isOccupied) {
      setModalType('checkout');
    } else {
      setModalType('checkin');
    }
  }, []);

  const handleCheckIn = useCallback(async (data: CheckInData) => {
    if (!selectedRoom) return;
    try {
      const updatedRoom = await checkInGuest(selectedRoom.id, data);
      // Reload rooms with the current selected date to reflect the changes
      await loadRooms();
      setModalType(null);
      setSelectedRoom(null);
    } catch (error) {
      console.error('Failed to check in guest:', error);
      alert('Failed to check in guest. Please try again.');
    }
  }, [selectedRoom, loadRooms]);

  const handleCheckOut = useCallback(async (finalPayment?: number, paymentMethod?: 'Cash' | 'Bank') => {
    if (!selectedRoom) return;
    try {
      const updatedRoom = await checkOutGuest(selectedRoom.id, finalPayment, paymentMethod);
      setRooms(prevRooms => prevRooms.map(room => room.id === selectedRoom.id ? updatedRoom : room));
      const stats = await getRoomStatistics();
      setStatistics(stats);
      setModalType(null);
      setSelectedRoom(null);
    } catch (error) {
      console.error('Failed to check out guest:', error);
      alert(error instanceof Error ? error.message : 'Failed to check out guest. Please try again.');
    }
  }, [selectedRoom]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-900 mx-auto"></div>
          <p className="mt-4 text-sm font-medium text-slate-500 uppercase tracking-wide">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Date Picker - Minimalistic Time Machine */}
      <div className="mb-10">
        <div className="bg-white/80 backdrop-blur-xl border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-50 p-3 rounded-xl">
                <Calendar className="w-6 h-6 text-emerald-600" />
              </div>
              <div className="flex items-center gap-3">
                <label htmlFor="date-picker" className="text-sm font-medium text-slate-700">
                  View Date:
                </label>
                <input
                  type="date"
                  id="date-picker"
                  value={selectedDate}
                  onChange={handleDateChange}
                  className="px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 
                           focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent
                           shadow-sm hover:border-slate-400 transition-colors"
                  min={new Date().toISOString().split('T')[0]}
                />
                {selectedDate !== new Date().toISOString().split('T')[0] && (
                  <button
                    onClick={() => {
                      const today = new Date().toISOString().split('T')[0];
                      onDateChange(today);
                      const params = new URLSearchParams(searchParams?.toString() || '');
                      params.delete('date');
                      router.push(`?${params.toString()}`);
                    }}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 
                             rounded-xl text-sm font-medium transition-colors"
                  >
                    Today
                  </button>
                )}
              </div>
            </div>
            {selectedDate !== new Date().toISOString().split('T')[0] && (
              <div className="text-sm text-amber-700 bg-amber-50 px-4 py-2.5 rounded-lg">
                <span>
                  Viewing: {new Date(selectedDate).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric', 
                    year: 'numeric' 
                  })}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- STATS SECTION: REWRITTEN FOR HERO IMPACT --- */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-16">
        
        {/* Total Rooms */}
        <div className="bg-white/80 backdrop-blur-xl border border-slate-200 rounded-2xl p-10 flex items-center justify-between shadow-sm hover:shadow-md transition-all duration-300">
          <div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Total Rooms</p>
            <p className="text-6xl font-bold text-slate-800 tabular-nums leading-none">{statistics.total}</p>
          </div>
          <div className="bg-slate-50 p-5 rounded-2xl">
            <Building2 className="w-10 h-10 text-slate-400" />
          </div>
        </div>

        {/* Available */}
        <div className="bg-white/80 backdrop-blur-xl border border-slate-200 rounded-2xl p-10 flex items-center justify-between shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden">
           <div className="absolute top-0 right-0 w-2 h-full bg-emerald-500/20" />
          <div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Available</p>
            <p className="text-6xl font-bold text-emerald-600 tabular-nums leading-none">{statistics.available}</p>
          </div>
          <div className="bg-emerald-50 p-5 rounded-2xl">
            <DoorOpen className="w-10 h-10 text-emerald-500" />
          </div>
        </div>

        {/* Occupied */}
        <div className="bg-white/80 backdrop-blur-xl border border-slate-200 rounded-2xl p-10 flex items-center justify-between shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden">
           <div className="absolute top-0 right-0 w-2 h-full bg-rose-500/20" />
          <div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Occupied</p>
            <p className="text-6xl font-bold text-rose-600 tabular-nums leading-none">{statistics.occupied}</p>
          </div>
          <div className="bg-rose-50 p-5 rounded-2xl">
            <Users className="w-10 h-10 text-rose-500" />
          </div>
        </div>
      </div>

      {/* Rooms Section */}
      <div className="flex flex-col gap-10">
        
        {/* Floor 3 */}
        <div>
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-4">
            Floor 3 <span className="h-px w-full bg-slate-200 flex-1"></span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {rooms.filter(r => r.number.startsWith('3')).map(room => (
              <RoomCard key={room.id} room={room} onClick={() => handleRoomClick(room)} />
            ))}
          </div>
        </div>

        {/* Floor 2 */}
        <div>
           <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-4">
            Floor 2 <span className="h-px w-full bg-slate-200 flex-1"></span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {rooms.filter(r => r.number.startsWith('2')).map(room => (
              <RoomCard key={room.id} room={room} onClick={() => handleRoomClick(room)} />
            ))}
          </div>
        </div>

        {/* Floor 1 */}
        <div>
           <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-4">
            Floor 1 <span className="h-px w-full bg-slate-200 flex-1"></span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {rooms.filter(r => r.number === '101').map(room => (
              <RoomCard key={room.id} room={room} onClick={() => handleRoomClick(room)} />
            ))}
          </div>
        </div>

      </div>

      {/* Check-In Modal */}
      {modalType === 'checkin' && selectedRoom && (
        <CheckInModal
          room={selectedRoom.number}
          roomPrice={typeof selectedRoom.price === 'number' ? selectedRoom.price : 0}
          targetDate={new Date(selectedDate)}
          onConfirm={handleCheckIn}
          onClose={() => { setModalType(null); setSelectedRoom(null); }}
        />
      )}

      {/* Check-Out Modal */}
      {modalType === 'checkout' && selectedRoom && selectedRoom.guestName && (
        <CheckOutModal
          room={selectedRoom.number}
          guestName={selectedRoom.guestName}
          phoneNumber={selectedRoom.phoneNumber || ''}
          nicNumber={selectedRoom.nicNumber || ''}
          checkOutTime={selectedRoom.checkOutTime || ''}
          totalAmount={selectedRoom.totalAmount}
          paidAmount={selectedRoom.paidAmount}
          isDueOut={selectedRoom.isDueOut}
          onSwitchToCheckIn={() => setModalType('checkin')}
          onConfirm={handleCheckOut}
          onClose={() => { setModalType(null); setSelectedRoom(null); }}
        />
      )}

      {/* Add Expense Modal */}
      <AddExpenseModal
        isOpen={showExpenseModal}
        onClose={() => setShowExpenseModal(false)}
        onExpenseAdded={() => {
          // Expenses added from receptionist dashboard don't need to refresh room data
          // But we could show a toast notification here if desired
        }}
      />
    </>
  );
}