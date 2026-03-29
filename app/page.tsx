"use client";

import React, { useState, useEffect } from 'react';
import { Calendar, Users, Wifi, Snowflake, BedDouble, Coffee, Wine, Bath, ChevronRight, Star, MapPin } from 'lucide-react';
import WhatsAppModal from './components/WhatsAppModal';

const AmenityIcon = ({ type }: { type: string }) => {
  const iconProps = { className: "w-4 h-4 text-[#D4AF37]/80 group-hover:text-[#D4AF37] transition-colors" };
  switch (type) {
    case 'wifi': return <Wifi {...iconProps} />;
    case 'ac': return <Snowflake {...iconProps} />;
    case 'bed': return <BedDouble {...iconProps} />;
    case 'coffee': return <Coffee {...iconProps} />;
    case 'wine': return <Wine {...iconProps} />;
    case 'bath': return <Bath {...iconProps} />;
    default: return null;
  }
};

const formatPrice = (price: number) => {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
};

interface Room {
  id: number;
  name: string;
  description: string | null;
  size: string | null;
  image_url: string | null;
  price: string | null;
  amenities: string[];
}

export default function HomePage() {
  // Calculate today's date for default check-in
  const today = new Date().toISOString().split('T')[0];
  
  // Calculate tomorrow's date for default check-out
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const [checkIn, setCheckIn] = useState(today);
  const [checkOut, setCheckOut] = useState(tomorrowStr);
  const [guests, setGuests] = useState('2');
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [whatsAppModal, setWhatsAppModal] = useState<{
    isOpen: boolean;
    roomName: string;
    totalPrice: number;
  }>({
    isOpen: false,
    roomName: '',
    totalPrice: 0
  });

  // Calculate tomorrow's date for minimum check-out
  const minCheckOutDate = tomorrowStr;

  const fetchAvailableRooms = async () => {
    if (!checkIn || !checkOut) {
      alert('Please select both check-in and check-out dates');
      return;
    }

    if (new Date(checkOut) <= new Date(checkIn)) {
      alert('Check-out date must be after check-in date');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/book/availability?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}`);
      if (!response.ok) {
        throw new Error('Failed to fetch available rooms');
      }
      const data = await response.json();
      setAvailableRooms(data);
    } catch (error) {
      console.error('Error fetching rooms:', error);
      alert('Failed to check availability. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Initial load of all rooms (without date filter)
  useEffect(() => {
    const loadAllRooms = async () => {
      try {
        const response = await fetch('/api/book/rooms');
        if (response.ok) {
          const data = await response.json();
          setAvailableRooms(data);
        }
      } catch (error) {
        console.error('Error loading rooms:', error);
      }
    };
    loadAllRooms();
  }, []);

  return (
    <div className="min-h-screen bg-[#060913] text-slate-300 font-sans selection:bg-[#D4AF37]/30 selection:text-[#FDFBF7]">
      <nav className="absolute top-0 w-full z-50 flex justify-between items-center px-8 md:px-16 py-8">
        <div className="flex items-center gap-2 text-[#FDFBF7]">
          <Star className="w-5 h-5 text-[#D4AF37] fill-[#D4AF37]" />
          <span className="font-serif text-xl tracking-widest uppercase text-[#FDFBF7]">Royal Residence</span>
        </div>
        <div className="hidden md:flex gap-8 text-sm tracking-widest uppercase text-white/80 font-medium">
          <a href="#" className="hover:text-[#D4AF37] transition-colors duration-300">The Estate</a>
          <a href="#" className="hover:text-[#D4AF37] transition-colors duration-300">Suites</a>
        </div>
      </nav>

      <header className="relative w-full h-[85vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat scale-105 transform" style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1542314831-c6a4d140b3c6?ixlib=rb-4.0.3&auto=format&fit=crop&w=2800&q=80")' }} />
        <div className="absolute inset-0 bg-gradient-to-b from-[#060913]/60 via-[#060913]/30 to-[#060913]" />
        <div className="relative z-10 text-center px-4 flex flex-col items-center translate-y-[-5%]">
          <p className="text-[#D4AF37] uppercase tracking-[0.4em] text-sm md:text-base font-semibold mb-6">A Sanctuary of Elegance</p>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-serif text-[#FDFBF7] mb-8 leading-tight drop-shadow-2xl">Experience the <br className="hidden md:block"/> Royal Residence</h1>
          <div className="flex items-center gap-2 text-white/70 text-sm tracking-widest uppercase"><MapPin className="w-4 h-4" /><span>Colombo, Sri Lanka</span></div>
        </div>
      </header>

      <div className="relative z-20 w-full px-4 sm:px-6 lg:px-8 flex justify-center mt-[-80px] mb-24 md:mb-32">
        <div className="w-full max-w-6xl bg-white/5 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)] p-6 md:p-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
            <div className="flex flex-col gap-2">
              <label className="text-xs uppercase tracking-widest text-white/60 font-semibold flex items-center gap-2"><Calendar className="w-4 h-4 text-[#D4AF37]" /> Check-In</label>
              <input 
                type="date" 
                value={checkIn} 
                min={today}
                onChange={(e) => setCheckIn(e.target.value)} 
                className="w-full bg-[#060913]/50 border border-white/10 rounded-lg px-4 py-3 text-[#FDFBF7] focus:outline-none focus:border-[#D4AF37] transition-colors [color-scheme:dark]" 
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs uppercase tracking-widest text-white/60 font-semibold flex items-center gap-2"><Calendar className="w-4 h-4 text-[#D4AF37]" /> Check-Out</label>
              <input 
                type="date" 
                value={checkOut} 
                min={minCheckOutDate}
                onChange={(e) => setCheckOut(e.target.value)} 
                className="w-full bg-[#060913]/50 border border-white/10 rounded-lg px-4 py-3 text-[#FDFBF7] focus:outline-none focus:border-[#D4AF37] transition-colors [color-scheme:dark]" 
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs uppercase tracking-widest text-white/60 font-semibold flex items-center gap-2"><Users className="w-4 h-4 text-[#D4AF37]" /> Guests</label>
              <select value={guests} onChange={(e) => setGuests(e.target.value)} className="w-full bg-[#060913]/50 border border-white/10 rounded-lg px-4 py-3 text-[#FDFBF7] focus:outline-none focus:border-[#D4AF37] transition-colors appearance-none">
                <option value="1">1 Guest</option>
                <option value="2">2 Guests</option>
                <option value="3">3 Guests</option>
                <option value="4">4 Guests</option>
              </select>
            </div>
            <button 
              onClick={fetchAvailableRooms}
              disabled={loading}
              className="w-full bg-[#D4AF37] hover:bg-[#C5A059] disabled:bg-gray-600 text-[#060913] font-semibold tracking-widest uppercase py-3.5 px-6 rounded-lg transition-all duration-300 flex justify-center items-center gap-2 group"
            >
              {loading ? 'Checking...' : 'Check Availability'}
              <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32">
        <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
          <div>
            <h2 className="text-3xl md:text-5xl font-serif text-[#FDFBF7] mb-4">Curated Accommodations</h2>
            <p className="text-white/60 max-w-xl text-lg font-light leading-relaxed">Discover unparalleled luxury tailored to your deepest desires.</p>
          </div>
          {checkIn && checkOut && (
            <div className="text-sm text-white/50">
              Showing availability for {checkIn} to {checkOut}
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {availableRooms.map((room) => (
            <article key={room.id} className="group flex flex-col bg-[#0F1524] rounded-2xl overflow-hidden border border-white/5 hover:border-[#D4AF37]/30 transition-all duration-500">
              <div className="relative h-72 w-full overflow-hidden">
                <img 
                  src={room.image_url || 'https://images.unsplash.com/photo-1542314831-c6a4d140b3c6?auto=format&fit=crop&w=800&q=80'} 
                  alt={room.name} 
                  className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-1000 ease-out" 
                />
                <div className="absolute top-4 right-4 z-20 bg-[#060913]/60 backdrop-blur-md px-3 py-1.5 rounded text-xs tracking-widest uppercase text-[#FDFBF7] border border-white/10">
                  {room.size || 'Standard'}
                </div>
              </div>
              <div className="flex flex-col flex-grow p-8">
                <h3 className="text-2xl font-serif text-[#FDFBF7] mb-4">{room.name}</h3>
                <p className="text-white/50 text-sm mb-6 line-clamp-2 leading-relaxed font-light">
                  {room.description || 'Experience luxury and comfort in our meticulously designed rooms.'}
                </p>
                <div className="mt-auto flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-xs uppercase tracking-widest text-white/50 mb-1">From</span>
                    <span className="text-xl font-medium text-[#FDFBF7]">
                      {formatPrice(room.price ? parseFloat(room.price) : 0)} 
                      <span className="text-sm text-white/40 font-light"> / night</span>
                    </span>
                  </div>
                  <button 
                    className="px-6 py-3 bg-transparent border border-[#D4AF37] text-[#D4AF37] rounded-lg text-sm uppercase tracking-widest hover:bg-[#D4AF37] hover:text-[#060913] transition-all duration-300 font-medium"
                    onClick={() => {
                      if (!checkIn || !checkOut) {
                        alert('Please select check-in and check-out dates first');
                        return;
                      }
                      
                      // Calculate total price for the stay
                      const nights = Math.ceil(
                        (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24)
                      );
                      const pricePerNight = room.price ? parseFloat(room.price) : 0;
                      const totalPrice = pricePerNight * nights;
                      
                      setWhatsAppModal({
                        isOpen: true,
                        roomName: room.name,
                        totalPrice
                      });
                    }}
                  >
                    Book Now
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
        {availableRooms.length === 0 && !loading && (
          <div className="text-center py-16">
            <p className="text-white/60 text-lg">No rooms available for the selected dates. Please try different dates.</p>
          </div>
        )}
      </main>

      {/* WhatsApp Modal */}
      <WhatsAppModal
        isOpen={whatsAppModal.isOpen}
        onClose={() => setWhatsAppModal({ ...whatsAppModal, isOpen: false })}
        roomName={whatsAppModal.roomName}
        checkIn={checkIn}
        checkOut={checkOut}
        guests={guests}
        totalPrice={whatsAppModal.totalPrice}
      />
    </div>
  );
}
