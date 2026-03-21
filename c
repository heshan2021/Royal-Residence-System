'use client';

import { useCallback, useState } from 'react';
import { RoomCard } from './components/RoomCard';
import { CheckInModal, CheckInData } from './components/CheckInModal';
import { CheckOutModal } from './components/CheckOutModal';
import { Building2, Users, DoorOpen } from 'lucide-react';

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
    if (room.id === 'room-301') return;
    
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
    <main className="min-h-screen">
      {/* Header */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">
                Royal Residence
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Receptionist Dashboard
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-sm text-gray-500">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span>Live</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-12">
        {/* Stats Section */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-16">
          {/* Total Rooms */}
          <div className="stats-card group">
            <div className="flex items-start justify-between">
              <div>
                <p className="stats-label">Total Rooms</p>
                <p className="stats-value">{rooms.length}</p>
              </div>
              <div className="p-2.5 bg-gray-50 rounded-xl group-hover:bg-gray-100 transition-colors">
                <Building2 className="w-5 h-5 text-gray-400" />
              </div>
            </div>
          </div>

          {/* Available */}
          <div className="stats-card group">
            <div className="flex items-start justify-between">
              <div>
                <p className="stats-label">Available</p>
                <p className="stats-value text-emerald-600">{availableCount}</p>
              </div>
              <div className="p-2.5 bg-emerald-50 rounded-xl group-hover:bg-emerald-100 transition-colors">
                <DoorOpen className="w-5 h-5 text-emerald-500" />
              </div>
            </div>
          </div>

          {/* Occupied */}
          <div className="stats-card group">
            <div className="flex items-start justify-between">
              <div>
                <p className="stats-label">Occupied</p>
                <p className="stats-value text-rose-600">{occupiedCount}</p>
              </div>
              <div className="p-2.5 bg-rose-50 rounded-xl group-hover:bg-rose-100 transition-colors">
                <Users className="w-5 h-5 text-rose-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Rooms Section */}
        <div className="space-y-12">
          {/* Floor 3 */}
          <section>
            <div className="flex items-center gap-4 mb-6">
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
                Floor 3
              </h2>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-y-10 gap-x-6">
              {rooms.filter(r => r.number.startsWith('3')).map(room => (
                <RoomCard
                  key={room.id}
                  room={room}
                  onClick={() => handleRoomClick(room)}
                />
              ))}
            </div>
          </section>

          {/* Floor 2 */}
          <section>
            <div className="flex items-center gap-4 mb-6">
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
                Floor 2
              </h2>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-y-10 gap-x-6">
              {rooms.filter(r => r.number.startsWith('2')).map(room => (
                <RoomCard
                  key={room.id}
                  room={room}
                  onClick={() => handleRoomClick(room)}
                />
              ))}
            </div>
          </section>

          {/* Floor 1 */}
          <section>
            <div className="flex items-center gap-4 mb-6">
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
                Floor 1
              </h2>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-y-10 gap-x-6">
              {rooms.filter(r => r.number === '101').map(room => (
                <RoomCard
                  key={room.id}
                  room={room}
                  onClick={() => handleRoomClick(room)}
                />
              ))}
            </div>
          </section>
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
