'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getMonthlyBookings } from '../lib/repository';

interface Booking {
  roomNumber: string;
  checkInDate: string;
  checkOutDate: string | null;
  guestName: string;
  phoneNumber: string;
}

interface CalendarViewProps {
  targetDate: Date;
  initialBookings: Booking[];
}

export default function CalendarView({ targetDate, initialBookings }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState<Date>(targetDate);
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [isLoading, setIsLoading] = useState(false); // Start as false since we have initial data
  const [rooms, setRooms] = useState<string[]>([]);

  // Get all room numbers (301, 302, 303, 201, 202, 203, 101)
  const allRooms = ['301', '302', '303', '201', '202', '203', '101'];

  // Initialize rooms from initialBookings
  useEffect(() => {
    const bookedRooms = [...new Set(initialBookings.map(b => b.roomNumber))];
    const allDisplayRooms = [...new Set([...allRooms, ...bookedRooms])].sort((a, b) => {
      const floorA = parseInt(a.charAt(0));
      const floorB = parseInt(b.charAt(0));
      if (floorA !== floorB) return floorB - floorA; // Higher floors first
      return parseInt(a) - parseInt(b);
    });
    setRooms(allDisplayRooms);
  }, [initialBookings]);

  const loadBookings = useCallback(async () => {
    setIsLoading(true);
    try {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth() + 1; // JavaScript months are 0-indexed
      
      const monthlyBookings = await getMonthlyBookings(year, month);
      setBookings(monthlyBookings);
      
      // Extract unique room numbers from bookings
      const bookedRooms = [...new Set(monthlyBookings.map(b => b.roomNumber))];
      // Combine with all rooms to ensure all are shown
      const allDisplayRooms = [...new Set([...allRooms, ...bookedRooms])].sort((a, b) => {
        // Sort by floor then room number
        const floorA = parseInt(a.charAt(0));
        const floorB = parseInt(b.charAt(0));
        if (floorA !== floorB) return floorB - floorA; // Higher floors first
        return parseInt(a) - parseInt(b);
      });
      setRooms(allDisplayRooms);
    } catch (error) {
      console.error('Failed to load monthly bookings:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentMonth]);

  // Only load bookings when month changes (not on initial render)
  useEffect(() => {
    // Don't load if we're already on the initial month
    const isInitialMonth = 
      currentMonth.getFullYear() === targetDate.getFullYear() && 
      currentMonth.getMonth() === targetDate.getMonth();
    
    if (!isInitialMonth) {
      loadBookings();
    }
  }, [currentMonth, targetDate, loadBookings]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      return newDate;
    });
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month + 1, 0).getDate();
  };

  const getDayName = (dayIndex: number) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), dayIndex + 1);
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };

  const isDateBooked = (roomNumber: string, day: number): boolean => {
    const targetDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    
    return bookings.some(booking => {
      if (booking.roomNumber !== roomNumber) return false;
      
      const checkInDate = new Date(booking.checkInDate);
      const checkOutDate = booking.checkOutDate ? new Date(booking.checkOutDate) : null;
      
      // Check if target date is within booking range
      const isAfterOrOnCheckIn = targetDate >= checkInDate;
      const isBeforeOrOnCheckOut = !checkOutDate || targetDate <= checkOutDate;
      
      return isAfterOrOnCheckIn && isBeforeOrOnCheckOut;
    });
  };

  const getBookingForDate = (roomNumber: string, day: number): Booking | undefined => {
    const targetDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    
    return bookings.find(booking => {
      if (booking.roomNumber !== roomNumber) return false;
      
      const checkInDate = new Date(booking.checkInDate);
      const checkOutDate = booking.checkOutDate ? new Date(booking.checkOutDate) : null;
      
      const isAfterOrOnCheckIn = targetDate >= checkInDate;
      const isBeforeOrOnCheckOut = !checkOutDate || targetDate <= checkOutDate;
      
      return isAfterOrOnCheckIn && isBeforeOrOnCheckOut;
    });
  };

  const daysInMonth = getDaysInMonth(currentMonth);
  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600 mx-auto"></div>
          <p className="mt-4 text-sm font-medium text-slate-500">Loading calendar data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/80 backdrop-blur-xl border border-slate-200 rounded-2xl p-6 shadow-sm">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigateMonth('prev')}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ChevronLeft size={20} className="text-slate-600" />
          </button>
          <h2 className="text-xl font-semibold text-slate-900">{monthName}</h2>
          <button
            onClick={() => navigateMonth('next')}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ChevronRight size={20} className="text-slate-600" />
          </button>
        </div>
        <div className="text-sm text-slate-500">
          {bookings.length} active booking{bookings.length !== 1 ? 's' : ''} this month
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="overflow-x-auto">
        <div 
          className="grid gap-px bg-slate-200"
          style={{
            gridTemplateColumns: `auto repeat(${daysInMonth}, minmax(40px, 1fr))`,
          }}
        >
          {/* Header Row - Room Labels */}
          <div className="bg-white p-3 border-r border-slate-200">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Room</div>
          </div>
          
          {/* Date Headers */}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => (
            <div 
              key={day} 
              className="bg-white p-2 text-center border-r border-slate-200"
            >
              <div className="text-xs font-medium text-slate-900">{day}</div>
              <div className="text-xs text-slate-500">{getDayName(day - 1)}</div>
            </div>
          ))}

          {/* Room Rows */}
          {rooms.map(roomNumber => (
            <div key={roomNumber} className="contents">
              {/* Room Label */}
              <div className="bg-white p-3 border-t border-r border-slate-200 flex items-center justify-center">
                <div className="text-sm font-medium text-slate-900">Room {roomNumber}</div>
              </div>
              
              {/* Date Cells */}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                const isBooked = isDateBooked(roomNumber, day);
                const booking = getBookingForDate(roomNumber, day);
                
                return (
                  <div 
                    key={`${roomNumber}-${day}`}
                    className={`border-t border-r border-slate-200 p-1 min-h-[60px] relative group ${
                      isBooked 
                        ? 'bg-emerald-50/80 border-emerald-200' 
                        : 'bg-white hover:bg-slate-50'
                    }`}
                  >
                    {isBooked && booking && (
                      <>
                        <div className="h-full flex flex-col justify-center p-2 rounded-lg bg-emerald-100/80 border border-emerald-200">
                          <div className="text-xs font-medium text-emerald-800 truncate">
                            {booking.guestName}
                          </div>
                          <div className="text-[10px] text-emerald-600 mt-1">
                            {new Date(booking.checkInDate).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric' 
                            })}
                            {booking.checkOutDate && (
                              <>
                                {' - '}
                                {new Date(booking.checkOutDate).toLocaleDateString('en-US', { 
                                  month: 'short', 
                                  day: 'numeric' 
                                })}
                              </>
                            )}
                          </div>
                        </div>
                        {/* Tooltip on hover */}
                        <div className="absolute z-10 invisible group-hover:visible bg-slate-900 text-white text-xs rounded-lg py-2 px-3 -top-16 left-1/2 transform -translate-x-1/2 whitespace-nowrap min-w-[200px]">
                          <div className="font-medium">Booked by {booking.guestName}</div>
                          <div className="text-slate-300 mt-1">
                            📞 {booking.phoneNumber}
                          </div>
                          <div className="text-slate-300 mt-1">
                            {new Date(booking.checkInDate).toLocaleDateString('en-US', { 
                              weekday: 'short',
                              month: 'short', 
                              day: 'numeric',
                              year: 'numeric'
                            })}
                            {booking.checkOutDate && (
                              <>
                                {' to '}
                                {new Date(booking.checkOutDate).toLocaleDateString('en-US', { 
                                  weekday: 'short',
                                  month: 'short', 
                                  day: 'numeric',
                                  year: 'numeric'
                                })}
                              </>
                            )}
                          </div>
                          <div className="absolute bottom-[-6px] left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-slate-900"></div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-8 pt-6 border-t border-slate-200">
        <div className="flex items-center justify-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-emerald-100/80 border border-emerald-200"></div>
            <span className="text-sm text-slate-600">Booked</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-white border border-slate-300"></div>
            <span className="text-sm text-slate-600">Available</span>
          </div>
        </div>
        <p className="text-center text-sm text-slate-500 mt-4">
          Hover over booked cells to see guest details. This view is read-only.
        </p>
      </div>
    </div>
  );
}