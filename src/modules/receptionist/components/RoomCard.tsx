'use client';

import { Bath, Wind, Maximize, User, Clock, CreditCard, AlertCircle, CheckCircle, CalendarClock, LogIn } from 'lucide-react';
import { Room } from '../../../../types/room';
import { formatHotelDate } from '../../../../lib/hotelDates';

interface RoomCardProps {
  room: Room;
  onClick: () => void;
}

export function RoomCard({ room, onClick }: RoomCardProps) {
  const isLocked = room.id === 'room-301';
  // A folio that was never closed after its stay ended ("Not Checked Out").
  const isOverdue = room.isOverdue === true;
  const overdueDays = room.overdueDays || 0;
  const openFolios = room.openFolios || [];
  // The room is SOLD but empty: its guest holds it for the day being viewed and
  // has not arrived, so the card must never read "Occupied".
  const reservedStay = room.isReserved ? room.reserved : undefined;
  // Reservations that are still waiting for this room (its present guest has not
  // left yet). They cannot be checked in until that guest has gone.
  const waitingArrivals = room.reservationsOnDay || [];

  // Reservation slots are ISO instants; a missing one must not render "Invalid Date".
  const formatSlot = (value: string | null | undefined) =>
    value ? formatHotelDate(new Date(value)) : 'unknown';
  
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
  const amountDue = Math.max(0, (room.totalAmount || 0) - (room.paidAmount || 0));
  // Scheduled departure slot of the folio shown on this card.
  const checkOutDay =
    room.checkOutTime && room.checkOutTime !== 'Long-term'
      ? formatHotelDate(new Date(room.checkOutTime))
      : null;

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
          ${isOverdue ? 'border-[1.5px] border-rose-400 bg-rose-50/70 shadow-[0_0_15px_rgba(244,63,94,0.18)]' :
            room.isDueOut ? 'border-[1.5px] border-amber-300 bg-amber-50/60 shadow-[0_0_15px_rgba(251,191,36,0.15)]' : 
            room.isReserved ? 'border-[1.5px] border-sky-300 bg-sky-50/60 shadow-[0_0_15px_rgba(14,165,233,0.15)]' :
            room.isOccupied ? 'border-rose-100 bg-rose-50/30' : 'border-emerald-100 bg-white'}
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
            <span className={
              isOverdue ? 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide uppercase bg-gradient-to-r from-rose-600 to-rose-400 text-white shadow-sm' :
              room.isDueOut ? 'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide uppercase bg-gradient-to-r from-amber-500 to-orange-400 text-white shadow-sm' :
              room.isReserved ? 'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide uppercase bg-gradient-to-r from-sky-500 to-cyan-400 text-white shadow-sm' :
              room.isOccupied ? 'badge-occupied' : 'badge-available'
            }>
              {isOverdue && <AlertCircle className="w-3.5 h-3.5" />}
              {isOverdue ? 'Not Checked Out' : room.isDueOut ? 'Due Out' : room.isReserved ? 'Reserved' : room.isOccupied ? 'Occupied' : 'Available'}
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
                  {paymentStatus === 'unpaid' && (isOverdue ? `Due: LKR ${amountDue.toLocaleString()}` : 'Unpaid')}
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
                <span className="text-xs text-gray-600">
                  {isOverdue
                    ? `Stay ended ${checkOutDay || room.checkOutTime}`
                    : `Check-out: ${room.checkOutTime}`}
                </span>
              </div>
            )}
            {/* Unclosed folio notice */}
            {isOverdue && (
              <div className="mt-2 flex items-start gap-2 text-xs font-medium text-rose-700">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>
                  Folio never closed
                  {overdueDays > 0 ? ` - ${overdueDays} day${overdueDays > 1 ? 's' : ''} overdue` : ''}.
                  {amountDue > 0 ? ` LKR ${amountDue.toLocaleString()} still due.` : ' Balance settled - ready to check out.'}
                </span>
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

        {/* Reserved: sold, but nobody has arrived. Tapping the card records the
            arrival - the desk only does that when the guest is standing there. */}
        {reservedStay && (
          <div className="mb-4 p-3 bg-white/80 rounded-xl border border-sky-100">
            <div className="flex items-center gap-2 mb-2">
              <User className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-900">{reservedStay.guestName || 'Guest'}</span>
            </div>
            <div className="flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-600">
                Arriving {formatSlot(reservedStay.checkInDate)}
                {reservedStay.checkOutDate ? ` · until ${formatSlot(reservedStay.checkOutDate)}` : ' · long-term'}
              </span>
            </div>
            <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between text-xs">
              <span className="text-gray-500">
                {reservedStay.nights} {reservedStay.nights === 1 ? 'night' : 'nights'}
              </span>
              <span className="font-medium text-gray-700">
                LKR {reservedStay.totalAmount.toLocaleString()}
                {reservedStay.paidAmount > 0
                  ? ` · paid ${reservedStay.paidAmount.toLocaleString()}`
                  : ' · nothing paid yet'}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-2 px-2.5 py-2 rounded-lg bg-sky-50 text-xs font-semibold text-sky-700">
              <LogIn className="w-3.5 h-3.5" />
              Tap this card to check the guest in when they arrive
            </div>
          </div>
        )}

        {/* Sold to somebody else from the day they arrive - but this room still has
            to be vacated first, so those arrivals are only listed here. */}
        {waitingArrivals.length > 0 && (
          <div className="mb-4 p-3 bg-sky-50/80 rounded-xl border border-sky-200">
            <div className="flex items-center gap-2 mb-2">
              <CalendarClock className="w-4 h-4 text-sky-500" />
              <span className="text-xs font-semibold text-sky-800 uppercase tracking-wide">
                {waitingArrivals.length} arrival{waitingArrivals.length > 1 ? 's' : ''} waiting for this room
              </span>
            </div>
            <ul className="space-y-1.5">
              {waitingArrivals.map(arrival => (
                <li key={arrival.bookingId} className="flex justify-between items-center text-xs text-sky-900">
                  <span className="truncate pr-2">
                    {arrival.guestName || 'Guest'} · #{arrival.bookingId}
                  </span>
                  <span className="font-medium whitespace-nowrap">
                    from {formatSlot(arrival.checkInDate)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Further unclosed folios on this room (one folio is settled at a time) */}
        {openFolios.length > 0 && (
          <div className="mb-4 p-3 bg-amber-50/80 rounded-xl border border-amber-200">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-semibold text-amber-800 uppercase tracking-wide">
                {openFolios.length} other unclosed folio{openFolios.length > 1 ? 's' : ''}
              </span>
            </div>
            <ul className="space-y-1.5">
              {openFolios.map(folio => {
                const folioDue = Math.max(0, folio.totalAmount - folio.paidAmount);
                return (
                  <li key={folio.bookingId} className="flex justify-between items-center text-xs text-amber-900">
                    <span className="truncate pr-2">
                      {folio.guestName || 'Guest'} · #{folio.bookingId}
                    </span>
                    <span className="font-medium whitespace-nowrap">
                      {folioDue > 0 ? `LKR ${folioDue.toLocaleString()} due` : 'settled'}
                    </span>
                  </li>
                );
              })}
            </ul>
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
