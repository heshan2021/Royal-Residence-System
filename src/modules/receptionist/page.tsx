'use client';

import { useCallback, useEffect, useState } from 'react';
import { Building2, Users, DoorOpen, DollarSign } from 'lucide-react';
import Link from 'next/link';
import { RoomCard } from './components/RoomCard';
import { CheckInModal, CheckInData } from './components/CheckInModal';
import { CheckOutModal } from './components/CheckOutModal';
import { Room } from '../../../types/room';
import { 
  getAllRooms, 
  checkInGuest, 
  checkOutGuest, 
  getRoomStatistics,
  calculateAmountDue
} from './lib/repository';

export default function ReceptionistDashboard() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [modalType, setModalType] = useState<'checkin' | 'checkout' | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statistics, setStatistics] = useState({ total: 0, occupied: 0, available: 0 });

  useEffect(() => {
    loadRooms();
  }, []);

  const loadRooms = async () => {
    setIsLoading(true);
    try {
      const roomsData = await getAllRooms();
      const stats = await getRoomStatistics();
      setRooms(roomsData);
      setStatistics(stats);
    } catch (error) {
      console.error('Failed to load rooms:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoomClick = useCallback((room: Room) => {
    if (room.id === 'room-301') return;
    
    setSelectedRoom(room);
    if (room.isOccupied) {
      setModalType('checkout');
    } else {
      setModalType('checkin');
    }
  }, []);

  const handleCheckIn = useCallback(async (data: CheckInData) => {
    if (!selectedRoom) return;
    try {
      const updatedRoom = await checkInGuest(selectedRoom.id, data);
      setRooms(prevRooms => prevRooms.map(room => room.id === selectedRoom.id ? updatedRoom : room));
      const stats = await getRoomStatistics();
      setStatistics(stats);
      setModalType(null);
      setSelectedRoom(null);
    } catch (error) {
      console.error('Failed to check in guest:', error);
      alert('Failed to check in guest. Please try again.');
    }
  }, [selectedRoom]);

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
    <div className="min-h-screen w-full bg-slate-50 flex justify-center">
      
      <main className="w-full max-w-[1400px] px-10 sm:px-14 lg:px-20 py-12">
        
        {/* Header */}
        <header className="mb-12 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Royal Residence</h1>
            <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mt-1">Receptionist Dashboard</p>
          </div>
          <div className="flex items-center gap-4">
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
        </header>

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
      </main>

      {/* Check-In Modal */}
      {modalType === 'checkin' && selectedRoom && (
        <CheckInModal
          room={selectedRoom.number}
          roomPrice={typeof selectedRoom.price === 'number' ? selectedRoom.price : 0}
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
          onConfirm={handleCheckOut}
          onClose={() => { setModalType(null); setSelectedRoom(null); }}
        />
      )}
    </div>
  );
}
