'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
  isActive?: boolean;
}

export default function CalendarView({ targetDate, initialBookings, isActive }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState<Date>(targetDate);
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [isLoading, setIsLoading] = useState(false); // Start as false since we have initial data
  const [rooms, setRooms] = useState<string[]>([]);
  const [tooltip, setTooltip] = useState<{ booking: Booking; x: number; y: number } | null>(null);

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

  const isFirstRender = useRef(true);

  // Load bookings when month changes or when the calendar view becomes active
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      // If the server returned 0 bookings, the Vercel server-to-server fetch might have failed.
      // Try one client-side fetch as a fallback.
      if (initialBookings.length === 0) {
        loadBookings();
      }
      return;
    }

    if (isActive !== false) {
      loadBookings();
    }
  }, [currentMonth, isActive, loadBookings, initialBookings.length]);

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

  // Helper to extract purely the YYYY-MM-DD date string in the user's local timezone
  // This avoids timezone shifts hiding single stays, and time offsets masking checkin dates
  const getLocalYYYYMMDD = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getBookingsForDate = (roomNumber: string, day: number): Booking[] => {
    const targetDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const targetStr = getLocalYYYYMMDD(targetDate);
    
    return bookings.filter(booking => {
      if (booking.roomNumber !== roomNumber) return false;
      
      const checkInStr = getLocalYYYYMMDD(new Date(booking.checkInDate));
      const checkOutStr = booking.checkOutDate ? getLocalYYYYMMDD(new Date(booking.checkOutDate)) : null;
      
      const isAfterOrOnCheckIn = targetStr >= checkInStr;
      const isBeforeOrOnCheckOut = !checkOutStr || targetStr <= checkOutStr;
      
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
      <div className="overflow-x-auto pt-20 pb-4 -mt-20">
        <div 
          className="grid gap-px bg-slate-200 mt-20"
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
                const dayBookings = getBookingsForDate(roomNumber, day);
                const targetDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
                const targetStr = getLocalYYYYMMDD(targetDate);
                
                return (
                  <div 
                    key={`${roomNumber}-${day}`}
                    className="border-t border-r border-slate-200 min-h-[60px] relative transition-colors bg-white hover:bg-slate-50"
                  >
                    {dayBookings.map(booking => {
                      const checkInStr = getLocalYYYYMMDD(new Date(booking.checkInDate));
                      const checkOutStr = booking.checkOutDate ? getLocalYYYYMMDD(new Date(booking.checkOutDate)) : null;
                      
                      const isCheckIn = targetStr === checkInStr;
                      const isCheckOut = targetStr === checkOutStr;

                      let posClasses = "";
                      if (isCheckIn && isCheckOut) {
                        // Same day in-and-out
                        posClasses = "left-1 right-1 rounded-md border-l border-r";
                      } else if (isCheckIn) {
                        // Starts in the afternoon -> right half
                        posClasses = "left-1/2 right-0 rounded-l-md border-l";
                      } else if (isCheckOut) {
                        // Ends in the morning -> left half
                        posClasses = "left-0 right-1/2 rounded-r-md border-r";
                      } else {
                        // Full day in between
                        posClasses = "left-0 right-0 border-l-0 border-r-0";
                      }

                      return (
                        <div 
                          key={`${booking.phoneNumber}-${booking.checkInDate}`}
                          className={`absolute top-1 bottom-1 z-10 flex flex-col justify-center px-1.5 overflow-hidden border-t border-b border-emerald-400 bg-emerald-100/95 hover:bg-emerald-200 cursor-pointer shadow-sm ${posClasses}`}
                          onMouseEnter={(e) => setTooltip({ booking, x: e.clientX, y: e.clientY })}
                          onMouseMove={(e) => setTooltip({ booking, x: e.clientX, y: e.clientY })}
                          onMouseLeave={() => setTooltip(null)}
                        >
                          {(isCheckIn || day === 1) && (
                            <div className="text-[10px] font-bold text-emerald-900 truncate tracking-tight">
                              {booking.guestName}
                            </div>
                          )}
                        </div>
                      );
                    })}
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

      {/* Global Fixed Tooltip */}
      {tooltip && (
        <div 
          className="fixed z-[9999] bg-slate-900 text-white text-xs rounded-xl py-3 px-4 shadow-2xl border border-slate-700 pointer-events-none transform -translate-x-1/2 w-64"
          style={{ 
            top: `${tooltip.y - 120}px`, 
            left: `${tooltip.x}px` 
          }}
        >
          <div className="font-semibold text-sm mb-1">Booked by {tooltip.booking.guestName}</div>
          <div className="text-slate-300 mb-2">📞 {tooltip.booking.phoneNumber}</div>
          <div className="text-slate-300 pt-2 border-t border-slate-700/50">
            {new Date(tooltip.booking.checkInDate).toLocaleDateString('en-US', { 
              weekday: 'short',
              month: 'short', 
              day: 'numeric',
              year: 'numeric'
            })}
            {tooltip.booking.checkOutDate ? (
              <>
                {' → '}
                {new Date(tooltip.booking.checkOutDate).toLocaleDateString('en-US', { 
                  weekday: 'short',
                  month: 'short', 
                  day: 'numeric',
                  year: 'numeric'
                })}
              </>
            ) : ' → Ongoing'}
          </div>
          <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[8px] border-r-[8px] border-t-[8px] border-l-transparent border-r-transparent border-t-slate-900 filter drop-shadow"></div>
        </div>
      )}
    </div>
  );
}