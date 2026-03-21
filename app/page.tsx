'use client';

import { useCallback, useState } from 'react';
import { RoomCard } from './components/RoomCard';
import { CheckInModal, CheckInData } from './components/CheckInModal';
import { CheckOutModal } from './components/CheckOutModal';

interface Room {
  id: string;
  number: string;
  price: number | string;
  amenities: string[];
  isOccupied: boolean;
  checkOutTime?: string;
  guestName?: string;
  phoneNumber?: string;
  nicNumber?: string;
}

const INITIAL_ROOMS: Room[] = [
  {
    id: 'room-301',
    number: '301',
    price: 'N/A',
    amenities: ['Family Friend'],
    isOccupied: true,
    checkOutTime: 'Long-term',
    guestName: 'Family Friend',
    phoneNumber: 'N/A',
    nicNumber: 'N/A',
  },
  { id: 'room-302', number: '302', price: 5000, amenities: ['No Balcony'], isOccupied: false },
  { id: 'room-303', number: '303', price: 5500, amenities: ['Balcony'], isOccupied: false },
  { id: 'room-201', number: '201', price: 6000, amenities: ['Large Room', 'Bathtub', 'Balcony'], isOccupied: false },
  { id: 'room-202', number: '202', price: 5000, amenities: ['No Balcony'], isOccupied: false },
  { id: 'room-203', number: '203', price: 5500, amenities: ['Balcony'], isOccupied: false },
  { id: 'room-101', number: '101', price: 4500, amenities: ['No Balcony'], isOccupied: false },
];

export default function Dashboard() {
  const [rooms, setRooms] = useState<Room[]>(INITIAL_ROOMS);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [modalType, setModalType] = useState<'checkin' | 'checkout' | null>(null);

  const handleRoomClick = useCallback((room: Room) => {
    if (room.id === 'room-301') return; // Prevent interaction with permanent room
    
    setSelectedRoom(room);
    if (room.isOccupied) {
      setModalType('checkout');
    } else {
      setModalType('checkin');
    }
  }, []);

  const handleCheckIn = useCallback(
    (data: CheckInData) => {
      if (!selectedRoom) return;

      setRooms((prevRooms) =>
        prevRooms.map((room) =>
          room.id === selectedRoom.id
            ? {
                ...room,
                isOccupied: true,
                guestName: data.guestName,
                phoneNumber: data.phoneNumber,
                nicNumber: data.nicNumber,
                checkOutTime: data.checkOutTime,
              }
            : room
        )
      );

      setModalType(null);
      setSelectedRoom(null);
    },
    [selectedRoom]
  );

  const handleCheckOut = useCallback(() => {
    if (!selectedRoom) return;

    setRooms((prevRooms) =>
      prevRooms.map((room) =>
        room.id === selectedRoom.id
          ? {
              ...room,
              isOccupied: false,
              guestName: undefined,
              phoneNumber: undefined,
              nicNumber: undefined,
              checkOutTime: undefined,
            }
          : room
      )
    );

    setModalType(null);
    setSelectedRoom(null);
  }, [selectedRoom]);

  const occupiedCount = rooms.filter((r) => r.isOccupied).length;
  const availableCount = rooms.length - occupiedCount;

  return (
    <main className="main-content min-h-screen p-6 md:p-8 lg:p-12">
      {/* Sleek Minimalist Header (no logo) */}
      <div className="flex flex-col justify-center mb-8">
        <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 leading-tight mb-0.5">Royal Residence</h1>
        <p className="text-slate-500 text-xs md:text-sm font-medium tracking-wide uppercase leading-tight">Receptionist Dashboard</p>
      </div>

      {/* Refined Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {/* Total Rooms */}
        <div className="p-6 flex flex-col justify-center bg-white border border-gray-200 rounded-xl shadow-sm">
            <p className="text-slate-400 text-sm font-semibold tracking-wider uppercase mb-1">Total Rooms</p>
            <p className="text-3xl md:text-4xl font-light text-slate-800 break-words">{rooms.length}</p>
        </div>

        {/* Available Rooms */}
        <div className="p-6 flex flex-col justify-center relative overflow-hidden bg-white border border-gray-200 rounded-xl shadow-sm">
          <div className="absolute top-6 right-6 w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            <p className="text-slate-400 text-sm font-semibold tracking-wider uppercase mb-1">Available</p>
            <p className="text-3xl md:text-4xl font-light text-slate-800 break-words">{availableCount}</p>
        </div>

        {/* Occupied Rooms */}
        <div className="p-6 flex flex-col justify-center relative overflow-hidden bg-white border border-gray-200 rounded-xl shadow-sm">
           <div className="absolute top-6 right-6 w-2 h-2 bg-rose-400 rounded-full shadow-[0_0_8px_rgba(251,113,133,0.8)]" />
           <p className="text-slate-400 text-sm font-semibold tracking-wider uppercase mb-1">Occupied</p>
           <p className="text-3xl md:text-4xl font-light text-slate-800 break-words">{occupiedCount}</p>
        </div>
      </div>

      {/* Rooms Grid: 3xx top, 2xx middle, 101 bottom */}
      <div className="space-y-8">
        {/* Top row: 3xx */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 auto-rows-max">
          {rooms.filter(r => r.number.startsWith('3')).map(room => (
            <RoomCard
              key={room.id}
              room={room}
              onClick={() => handleRoomClick(room)}
            />
          ))}
        </div>
        {/* Middle row: 2xx */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 auto-rows-max">
          {rooms.filter(r => r.number.startsWith('2')).map(room => (
            <RoomCard
              key={room.id}
              room={room}
              onClick={() => handleRoomClick(room)}
            />
          ))}
        </div>
        {/* Bottom row: 101 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 auto-rows-max">
          {rooms.filter(r => r.number === '101').map(room => (
            <RoomCard
              key={room.id}
              room={room}
              onClick={() => handleRoomClick(room)}
            />
          ))}
        </div>
      </div>

      {/* Check-In Modal */}
      {modalType === 'checkin' && selectedRoom && (
        <CheckInModal
          room={selectedRoom.number}
          onConfirm={handleCheckIn}
          onClose={() => {
            setModalType(null);
            setSelectedRoom(null);
          }}
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
          onConfirm={handleCheckOut}
          onClose={() => {
            setModalType(null);
            setSelectedRoom(null);
          }}
        />
      )}
    </main>
  );
}
