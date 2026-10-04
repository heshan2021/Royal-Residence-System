'use client';

import { useCallback, useEffect, useState } from 'react';
import { Building2, Users, DoorOpen, DollarSign, Plus, Calendar, CalendarClock, LogIn, AlertCircle, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { RoomCard } from './RoomCard';
import { CheckInModal, CheckInData } from './CheckInModal';
import { CheckOutModal } from './CheckOutModal';
import AddExpenseModal from '../../../../app/admin/accounting/AddExpenseModal';
import { Room, CheckOutSubmission, OverlapConflict } from '../../../../types/room';
import { sltToday } from '../../../../lib/hotelDates';
import { 
  getAllRooms, 
  checkInGuest, 
  checkInReservation,
  checkOutGuest, 
  getRoomStatistics,
  calculateAmountDue,
  RoomOverlapError,
  BookingResult
} from '../lib/repository';

interface Statistics {
  total: number;
  occupied: number;
  available: number;
  reserved: number;
}

// What the banner tells the desk after a booking, a reservation or an arrival.
interface Banner {
  kind: 'success' | 'error';
  text: string;
}

// The reserved guest whose arrival the desk is about to record.
interface PendingArrival {
  bookingId: number;
  roomNumber: string;
  guestName: string | null;
}

/** Plain-language summary of a saved booking, including any ended stay. */
function describeBooking(result: BookingResult): string {
  const room = result.room;
  const parts = [
    result.reserved
      ? `Room ${room.number} is reserved for ${room.guestName} - nobody is in the room yet.`
      : `${room.guestName} checked in to room ${room.number}.`,
  ];

  const ended = result.overlapAcknowledged;
  if (ended) {
    const money = [
      ended.refunded > 0 ? `LKR ${ended.refunded.toLocaleString()} refunded` : null,
      ended.outstandingBalance > 0 ? `LKR ${ended.outstandingBalance.toLocaleString()} still due` : 'nothing due',
    ]
      .filter(Boolean)
      .join(', ');
    parts.push(
      `${ended.guestName || 'The previous guest'} was checked out early: the stay was re-priced for ` +
        `${ended.nights} of ${ended.bookedNights} booked night(s), ${money}. Their folio stays open ` +
        `until it is settled.`
    );
  }

  return parts.join(' ');
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
  const [loadFailed, setLoadFailed] = useState(false);
  // Reservation flow: the clash that stopped the last attempt, the server's own
  // reason for it, and the outcome the desk must be told about.
  const [overlap, setOverlap] = useState<OverlapConflict | null>(null);
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [banner, setBanner] = useState<Banner | null>(null);
  // The reserved guest whose arrival the desk has asked to record, but not yet
  // confirmed. A tap on a reserved card only proposes the check-in.
  const [pendingArrival, setPendingArrival] = useState<PendingArrival | null>(null);

  const loadRooms = useCallback(async () => {
    setIsLoading(true);
    try {
      const roomsData = await getAllRooms(selectedDate ? new Date(selectedDate) : undefined);
      const stats = await getRoomStatistics(selectedDate ? new Date(selectedDate) : undefined);
      // A failed refresh must never blank the board: an empty grid reads as "all the
      // bookings vanished" to a receptionist mid-shift. `getAllRooms` swallows fetch
      // errors and resolves to [], so only a real answer replaces what is on screen.
      if (roomsData.length === 0) {
        console.error('Room refresh returned no rooms; keeping the last known grid.');
        setLoadFailed(true);
        return;
      }
      setRooms(roomsData);
      setStatistics(stats);
      setLoadFailed(false);
    } catch (error) {
      console.error('Failed to load rooms:', error);
      setLoadFailed(true);
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

  // The guest of a reservation has arrived, and the desk has confirmed it.
  // Nothing but the arrival is recorded: the room, the dates and the money were
  // fixed when the room was held, so the folio is settled at check-out as usual.
  const handleReservationArrival = useCallback(async (pending: PendingArrival) => {
    setIsSubmitting(true);
    setBanner(null);
    try {
      const message = await checkInReservation(pending.bookingId);
      // Re-read the grid: the rooms.* cache and this card both change on arrival.
      await loadRooms();
      setBanner({ kind: 'success', text: message });
    } catch (error) {
      console.error('Failed to check the reservation in:', error);
      // The API's own reason (the room is still held, the arrival day is in the
      // future) is the most useful thing to show here.
      setBanner({
        kind: 'error',
        text: error instanceof Error ? error.message : 'Failed to check the reservation in.',
      });
    } finally {
      setPendingArrival(null);
      setIsSubmitting(false);
    }
  }, [loadRooms]);

  const handleRoomClick = useCallback((room: Room) => {
    if (room.id === 'room-301') return;

    // A reserved room has exactly one job: record the guest's arrival. The desk
    // is asked first, so a stray tap can never check in somebody who is not here.
    if (room.isReserved && room.reserved) {
      setBanner(null);
      setPendingArrival({
        bookingId: room.reserved.bookingId,
        roomNumber: room.number,
        guestName: room.reserved.guestName,
      });
      return;
    }
    
    setSelectedRoom(room);
    setOverlap(null);
    setCheckInError(null);
    if (room.isDueOut || room.isOccupied) {
      setModalType('checkout');
    } else {
      setModalType('checkin');
    }
  }, []);

  const handleCheckIn = useCallback(async (data: CheckInData) => {
    if (!selectedRoom) return;
    setIsSubmitting(true);
    setCheckInError(null);
    try {
      const result = await checkInGuest(selectedRoom.id, data);
      // Reload rooms with the current selected date to reflect the changes
      await loadRooms();
      setBanner({ kind: 'success', text: describeBooking(result) });
      setModalType(null);
      setSelectedRoom(null);
      setOverlap(null);
    } catch (error) {
      console.error('Failed to check in guest:', error);
      if (error instanceof RoomOverlapError) {
        // The room is taken by a stay that already exists: the modal shows the
        // clash so the desk can decide, on the spot, whether to overrule it. The
        // message is kept too - when the API refuses the acknowledgement (the
        // blocking guest has not arrived, or the stay begins later), the modal
        // has no confirmation card to show and falls back to this reason.
        setOverlap(error.overlap);
        setCheckInError(error.message);
      } else {
        // Anything else is the server's own reason (a sold-out night, a past
        // date, a booking that no longer exists).
        setCheckInError(error instanceof Error ? error.message : 'Failed to save the booking. Please try again.');
      }
      // The modal stays open with the guest's details intact, so a clash never
      // costs the desk the form it just filled in.
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedRoom, loadRooms]);

  const handleCheckOut = useCallback(async (submission: CheckOutSubmission) => {
    if (!selectedRoom) return;
    try {
      await checkOutGuest(selectedRoom.id, {
        ...submission,
        // Close the folio this card is showing. An overdue folio (a stay that
        // already ended) must not be confused with whatever covers today.
        bookingId: selectedRoom.bookingId,
        // Resolve the booking that covers the day the receptionist is viewing.
        date: selectedDate ? new Date(selectedDate) : undefined,
      });
      // Re-read the whole grid from the server. Patching the local map was unsafe:
      // the check-out may release one folio while another is still open on the room.
      await loadRooms();
      setModalType(null);
      setSelectedRoom(null);
    } catch (error) {
      console.error('Failed to check out guest:', error);
      // Let the modal render the server's reason (e.g. a balance that must be
      // collected first) and re-enable its button.
      throw error instanceof Error ? error : new Error('Failed to check out guest');
    }
  }, [selectedRoom, selectedDate, loadRooms]);

  // Only a *first* load may take over the screen. Every later refresh keeps the
  // board mounted, so a slow or hanging request can no longer make every room
  // disappear behind a spinner (which reads as "the bookings are gone").
  if (isLoading && rooms.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-900 mx-auto"></div>
          <p className="mt-4 text-sm font-medium text-slate-500 uppercase tracking-wide">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  // Sri Lankan calendar date, so the picker does not flip a day between 00:00 and 05:30 SLT.
  const today = sltToday();

  return (
    <>
      {/* Refresh failure: the board still shows its last known state, and says so. */}
      {loadFailed && (
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-amber-50 border border-amber-200 rounded-2xl px-6 py-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-sm font-medium text-amber-900">
              Could not refresh the room list — showing the last known state. Check the connection, then retry.
            </p>
          </div>
          <button
            onClick={loadRooms}
            disabled={isLoading}
            className="shrink-0 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-60
                     text-white rounded-xl text-sm font-medium transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* What the last booking / arrival did - including a stay ended early. */}
      {banner && (
        <div className={`mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl px-6 py-4 border ${
          banner.kind === 'success' ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'
        }`}>
          <div className="flex items-start gap-3">
            {banner.kind === 'success' ? (
              <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" />
            )}
            <p className={`text-sm font-medium ${banner.kind === 'success' ? 'text-emerald-900' : 'text-rose-800'}`}>
              {banner.text}
            </p>
          </div>
          <button
            onClick={() => setBanner(null)}
            className="shrink-0 text-xs font-black uppercase tracking-wide text-slate-500 hover:text-slate-800 transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* A tap on a reserved room only asks: the arrival is recorded once the desk
          confirms the guest is actually at the desk. */}
      {pendingArrival && (
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-sky-50 border border-sky-200 rounded-2xl px-6 py-4">
          <div className="flex items-start gap-3">
            <LogIn className="w-5 h-5 text-sky-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-sky-900">
                Check {pendingArrival.guestName || 'the reserved guest'} in to room {pendingArrival.roomNumber}?
              </p>
              <p className="text-xs text-sky-700 mt-0.5">
                The room is already sold for them — this only records that they have arrived.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setPendingArrival(null)}
              disabled={isSubmitting}
              className="px-4 py-2 bg-white hover:bg-slate-50 disabled:opacity-60 text-slate-700 border border-slate-200 rounded-xl text-sm font-medium transition-colors"
            >
              Not yet
            </button>
            <button
              onClick={() => handleReservationArrival(pendingArrival)}
              disabled={isSubmitting}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white rounded-xl text-sm font-medium transition-colors"
            >
              {isSubmitting ? 'Checking in…' : 'Check In'}
            </button>
          </div>
        </div>
      )}

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
                  min={today}
                />
                {selectedDate !== today && (
                  <button
                    onClick={() => {
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
            {selectedDate !== today && (
              <div className="text-sm text-amber-700 bg-amber-50 px-4 py-2.5 rounded-lg">
                <span>
                  Viewing: {new Date(selectedDate).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric', 
                    year: 'numeric',
                    timeZone: 'Asia/Colombo'
                  })}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- STATS SECTION: REWRITTEN FOR HERO IMPACT --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
        
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

        {/* Reserved: sold, but the guest has not arrived. Counted apart from
            Available, because the room cannot be given to anybody else. */}
        <div className="bg-white/80 backdrop-blur-xl border border-slate-200 rounded-2xl p-10 flex items-center justify-between shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden">
           <div className="absolute top-0 right-0 w-2 h-full bg-sky-500/20" />
          <div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Reserved</p>
            <p className="text-6xl font-bold text-sky-600 tabular-nums leading-none">{statistics.reserved}</p>
          </div>
          <div className="bg-sky-50 p-5 rounded-2xl">
            <CalendarClock className="w-10 h-10 text-sky-500" />
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
          overlap={overlap}
          errorMessage={checkInError}
          isSubmitting={isSubmitting}
          onConfirm={handleCheckIn}
          onClose={() => { setModalType(null); setSelectedRoom(null); setOverlap(null); setCheckInError(null); }}
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
          isOverdue={selectedRoom.isOverdue}
          overdueDays={selectedRoom.overdueDays}
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