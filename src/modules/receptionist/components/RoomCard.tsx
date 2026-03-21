'use client';

import { Bath, Wind, Maximize, User, Clock, CreditCard, AlertCircle, CheckCircle } from 'lucide-react';
import { Room } from '../../../../types/room';

interface RoomCardProps {
  room: Room;
  onClick: () => void;
}

export function RoomCard({ room, onClick }: RoomCardProps) {
  const isLocked = room.id === 'room-301';
  
  // Calculate payment status
  const getPaymentStatus = () => {
    if (!room.isOccupied || room.totalAmount === undefined) return null;
    
    const paidAmount = room.paidAmount || 0;
    const totalAmount = room.totalAmount;
    
    if (paidAmount >= totalAmount) return 'paid';
    if (paidAmount > 0) return 'partial';
    return 'unpaid';
  };

  const paymentStatus = getPaymentStatus();
  const amountDue = room.totalAmount && room.paidAmount ? room.totalAmount - room.paidAmount : 0;

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
          <div className="flex flex-col items-end gap-2">
            <span className={room.isOccupied ? 'badge-occupied' : 'badge-available'}>
              {room.isOccupied ? 'Occupied' : 'Available'}
            </span>
            
            {/* Payment Status Badge */}
            {paymentStatus && (
              <div className={`
                inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium
                ${paymentStatus === 'paid' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : ''}
                ${paymentStatus === 'partial' ? 'bg-amber-50 text-amber-700 border border-amber-200' : ''}
                ${paymentStatus === 'unpaid' ? 'bg-rose-50 text-rose-700 border border-rose-200' : ''}
              `}>
                {paymentStatus === 'paid' && <CheckCircle className="w-3.5 h-3.5" />}
                {paymentStatus === 'partial' && <AlertCircle className="w-3.5 h-3.5" />}
                {paymentStatus === 'unpaid' && <CreditCard className="w-3.5 h-3.5" />}
                <span>
                  {paymentStatus === 'paid' && 'Paid'}
                  {paymentStatus === 'partial' && `Due: LKR ${amountDue.toLocaleString()}`}
                  {paymentStatus === 'unpaid' && 'Unpaid'}
                </span>
              </div>
            )}
          </div>
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
            {/* Payment Summary */}
            {room.totalAmount !== undefined && (
              <div className="mt-2 pt-2 border-t border-gray-100">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Total:</span>
                  <span className="font-medium text-gray-700">LKR {room.totalAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Paid:</span>
                  <span className={`font-medium ${(room.paidAmount || 0) >= room.totalAmount ? 'text-emerald-600' : 'text-amber-600'}`}>
                    LKR {(room.paidAmount || 0).toLocaleString()}
                  </span>
                </div>
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
