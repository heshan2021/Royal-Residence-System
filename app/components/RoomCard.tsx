'use client';

import { Bath, Wind, Maximize, User, Clock } from 'lucide-react';

interface Room {
  id: string;
  number: string;
  price: number | string;
  amenities: string[];
  isOccupied: boolean;
  checkOutTime?: string;
  guestName?: string;
}

interface RoomCardProps {
  room: Room;
  onClick: () => void;
}

export function RoomCard({ room, onClick }: RoomCardProps) {
  const isLocked = room.id === 'room-301';
  
  return (
    <button
      onClick={onClick}
      disabled={isLocked}
      className={`
        w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 rounded-2xl
        ${isLocked ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}
      `}
    >
      <div
        className={`
          glass-card p-5 h-full
          ${room.isOccupied ? 'border-rose-100 bg-rose-50/30' : 'border-emerald-100 bg-white'}
          ${!isLocked ? 'hover:shadow-lg hover:scale-[1.02]' : ''}
          transition-all duration-200
        `}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">
              {room.number}
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {typeof room.price === 'number' 
                ? `LKR ${room.price.toLocaleString()}/night` 
                : room.price
              }
            </p>
          </div>
          <span className={room.isOccupied ? 'badge-occupied' : 'badge-available'}>
            {room.isOccupied ? 'Occupied' : 'Available'}
          </span>
        </div>

        {/* Guest Info (if occupied) */}
        {room.isOccupied && room.guestName && (
          <div className="mb-4 p-3 bg-white/80 rounded-xl border border-rose-100">
            <div className="flex items-center gap-2 mb-2">
              <User className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-900">{room.guestName}</span>
            </div>
            {room.checkOutTime && (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <span className="text-xs text-gray-600">Check-out: {room.checkOutTime}</span>
              </div>
            )}
          </div>
        )}

        {/* Amenities */}
        <div className="flex flex-wrap gap-2">
          {room.amenities.includes('Large Room') && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-violet-50 text-violet-700 rounded-lg text-xs font-medium">
              <Maximize className="w-3.5 h-3.5" />
              Large
            </div>
          )}
          {room.amenities.includes('Bathtub') && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium">
              <Bath className="w-3.5 h-3.5" />
              Bathtub
            </div>
          )}
          {room.amenities.includes('Balcony') && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-medium">
              <Wind className="w-3.5 h-3.5" />
              Balcony
            </div>
          )}
          {room.amenities.includes('No Balcony') && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium">
              <Wind className="w-3.5 h-3.5" />
              No Balcony
            </div>
          )}
          {room.amenities.includes('Family Friend') && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-xs font-medium">
              <User className="w-3.5 h-3.5" />
              Reserved
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
