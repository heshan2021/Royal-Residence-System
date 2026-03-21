import { Wifi, Bath, Wind } from 'lucide-react';

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
  return (
    <button
      onClick={onClick}
      className="w-full text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-lg"
    >
      <div
        className={`glass-card p-5 ${room.isOccupied ? 'ring-1 ring-red-100' : ''}`}
      >
        {/* Room Number and Status */}
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Room {room.number}</h2>
          <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
            room.isOccupied
              ? 'bg-red-100 text-red-700'
              : 'bg-emerald-100 text-emerald-700'
          }`}>
            {room.isOccupied ? 'Occupied' : 'Available'}
          </div>
        </div>

        {/* Price */}
        <div className="mb-4">
          <p className="text-gray-600 text-sm mb-1">Rate</p>
          <p className="text-lg font-semibold text-gray-900">
            {typeof room.price === 'number' ? `${room.price.toLocaleString()} LKR` : room.price}
          </p>
        </div>

        {/* Guest Info (if occupied) */}
        {room.isOccupied && (
          <div className="mb-4 p-3 bg-red-100/50 rounded-lg">
            <p className="text-xs text-gray-600 mb-1">Guest</p>
            <p className="text-sm font-semibold text-gray-900 mb-2">{room.guestName}</p>
            <p className="text-xs text-gray-600 mb-1">Check-out</p>
            <p className="text-sm text-gray-900 font-semibold">{room.checkOutTime}</p>
          </div>
        )}

        {/* Amenities */}
        <div className="flex flex-wrap gap-2">
          {room.amenities.includes('Bathtub') && (
            <div className="flex items-center gap-1 bg-blue-50 border border-blue-200 rounded-md px-2.5 py-1.5">
              <Bath size={14} className="text-blue-600" />
              <span className="text-xs font-medium text-blue-900">Bathtub</span>
            </div>
          )}
          {room.amenities.includes('No Balcony') ? (
            <div className="flex items-center gap-1 bg-orange-50 border border-orange-200 rounded-md px-2.5 py-1.5">
              <Wind size={14} className="text-orange-600" />
              <span className="text-xs font-medium text-orange-900">No Balcony</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 bg-emerald-50 border border-emerald-200 rounded-md px-2.5 py-1.5">
              <Wind size={14} className="text-emerald-600" />
              <span className="text-xs font-medium text-emerald-900">Balcony</span>
            </div>
          )}
          {room.amenities.includes('Large Room') && (
            <div className="flex items-center gap-1 bg-purple-50 border border-purple-200 rounded-md px-2.5 py-1.5">
              <Wifi size={14} className="text-purple-600" />
              <span className="text-xs font-medium text-purple-900">Large</span>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
