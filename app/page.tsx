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
    <div className="bg-background text-on-surface font-body selection:bg-secondary-container selection:text-on-secondary-container min-h-screen">
      {/* TopNavBar */}
      <nav className="fixed top-0 w-full z-50 bg-[#fbf9f4]/80 dark:bg-stone-900/80 backdrop-blur-md">
        <div className="flex justify-between items-center px-12 py-6 max-w-screen-2xl mx-auto">
          <div className="font-['Noto_Serif'] text-2xl tracking-tighter text-[#655d57] dark:text-[#aea39d]">
            Royal Residence
          </div>
          <div className="hidden md:flex items-center gap-12 font-['Noto_Serif'] font-medium tracking-tight text-[#655d57] dark:text-[#aea39d]">
            <a className="text-[#775a19] dark:text-[#C5A059] border-b border-[#775a19]/20 hover:text-[#775a19] transition-colors duration-300" href="#">Home</a>
            <a className="hover:text-[#775a19] transition-colors duration-300" href="#">Suites</a>
            <a className="hover:text-[#775a19] transition-colors duration-300" href="#">Amenities</a>
            <a className="hover:text-[#775a19] transition-colors duration-300" href="#">Gallery</a>
            <a className="hover:text-[#775a19] transition-colors duration-300" href="#">Contact</a>
          </div>
          <button className="bg-primary text-on-primary px-8 py-2.5 rounded-lg font-medium tracking-wide hover:opacity-90 transition-all scale-95 duration-200 ease-in-out">
            Book Now
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="relative h-screen w-full flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <img alt="Royal Residence Suite" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCxW_C_MAM509c1hWu0ANV6iBdtRM-OSEz0f4DkmYbsCwoMmov-4u42reBnQBR_fbdSL-kw8-MfCpwbruMTkct-IPGuA8MHXI1ZJq-WhVzPbkaCzAsEqBWpnZlmCg3-O0wGVqzL-mo4UAb5DQflRNy06XWEsHshHVND4ZUcLkdM9lii3Wu_eyWnxRX1ktgVGQMg3KLCAP_COYFVZRuCINPS537jhNhqFerz3g-W8T9NsXDMQjrTsB9N7YeHAwe1tI4xY4KHy0_D5Jk"/>
          <div className="absolute inset-0 hero-gradient"></div>
        </div>
        <div className="relative z-10 text-center max-w-4xl px-6">
          <h1 className="font-headline text-5xl md:text-7xl text-on-background mb-8 leading-tight tracking-tight">
            Refined Comfort in the <br/> <span className="italic">Heart of Malabe</span>
          </h1>
          {/* Booking Widget */}
          <div className="mt-12 p-2 bg-surface-container-lowest/90 backdrop-blur-xl rounded-xl shadow-2xl flex flex-col md:flex-row gap-2 max-w-4xl mx-auto">
            <div className="flex-1 grid grid-cols-2 gap-2">
              <div className="flex flex-col items-start px-4 py-3 border-r border-outline-variant/20">
                <span className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1">Check-in</span>
                <input 
                  type="date" 
                  value={checkIn} 
                  min={today}
                  onChange={(e) => setCheckIn(e.target.value)} 
                  className="w-full bg-transparent border-none text-on-surface focus:outline-none focus:ring-0 p-0 text-sm font-headline cursor-pointer" 
                />
              </div>
              <div className="flex flex-col items-start px-4 py-3 border-r border-outline-variant/20">
                <span className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1">Check-out</span>
                <input 
                  type="date" 
                  value={checkOut} 
                  min={minCheckOutDate}
                  onChange={(e) => setCheckOut(e.target.value)} 
                  className="w-full bg-transparent border-none text-on-surface focus:outline-none focus:ring-0 p-0 text-sm font-headline cursor-pointer" 
                />
              </div>
            </div>
            <div className="flex-1 grid grid-cols-2 gap-2">
              <div className="flex flex-col items-start px-4 py-3 border-r border-outline-variant/20">
                <span className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1">Guests</span>
                <select value={guests} onChange={(e) => setGuests(e.target.value)} className="w-full bg-transparent border-none text-on-surface focus:outline-none focus:ring-0 p-0 text-sm font-headline appearance-none cursor-pointer leading-[1.1]">
                  <option value="1">1 Adult</option>
                  <option value="2">2 Adults</option>
                  <option value="3">3 Adults</option>
                  <option value="4">4 Adults</option>
                  <option value="5">5+ Adults</option>
                </select>
              </div>
              <button 
                onClick={fetchAvailableRooms}
                disabled={loading}
                className="bg-primary text-on-primary h-full px-6 py-4 rounded-lg font-bold tracking-tight hover:bg-on-surface disabled:bg-surface-variant disabled:text-outline transition-colors flex items-center justify-center gap-2"
              >
                {loading ? 'Checking...' : 'Check'}
                <span className="material-symbols-outlined text-lg" data-icon="arrow_forward">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Room Selection Grid */}
      <section className="py-32 px-12 bg-surface">
        <div className="max-w-screen-2xl mx-auto">
          <div className="mb-24 text-center">
            <span className="text-secondary font-label tracking-[0.3em] uppercase text-xs mb-4 block font-bold">The Royal Collection</span>
            <h2 className="font-headline text-5xl text-on-background mb-4">Available Suites</h2>
            <div className="w-24 h-px bg-outline-variant/40 mx-auto"></div>
            {checkIn && checkOut && (
              <p className="mt-6 text-sm text-outline font-label tracking-wide">
                Showing availability for {checkIn} to {checkOut}
              </p>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-32">
            {availableRooms.map((room) => (
              <div className="group" key={room.id}>
                <div className="aspect-[16/10] overflow-hidden rounded-sm mb-8 bg-surface-container relative">
                  <img 
                    alt={room.name} 
                    className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" 
                    src={room.image_url || "https://images.unsplash.com/photo-1542314831-c6a4d140b3c6?auto=format&fit=crop&w=800&q=80"}
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = "https://images.unsplash.com/photo-1542314831-c6a4d140b3c6?auto=format&fit=crop&w=800&q=80";
                    }}
                  />
                  <div className="absolute top-6 right-6 bg-surface/90 backdrop-blur px-4 py-2 text-secondary font-bold text-lg tracking-tight">
                    {formatPrice(Number(room.price) || 0)} <span className="text-[10px] uppercase tracking-widest text-outline ml-1">/ Night</span>
                  </div>
                </div>
                <div className="flex flex-col gap-4">
                  <div className="flex justify-between items-end">
                    <div>
                      <h3 className="font-headline text-3xl text-on-background mb-2">{room.name}</h3>
                      <p className="text-on-surface-variant text-base font-light max-w-md leading-relaxed">{room.description || 'Experience luxury and deep comfort in our finely crafted suites.'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 py-4 border-y border-outline-variant/10">
                    <div className="flex items-center gap-2 text-on-surface-variant">
                      <span className="material-symbols-outlined text-sm">square_foot</span>
                      <span className="text-xs uppercase tracking-widest">{room.size || 'Standard'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-on-surface-variant">
                      <span className="material-symbols-outlined text-sm">bed</span>
                      <span className="text-xs uppercase tracking-widest">Premium Bed</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      if (!checkIn || !checkOut) {
                        alert('Please select check-in and check-out dates first');
                        return;
                      }
                      
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
                    className="w-full md:w-fit bg-primary text-on-primary px-10 py-4 rounded-lg font-bold tracking-wide hover:opacity-95 transition-all transform hover:-translate-y-0.5"
                  >
                    Book Now
                  </button>
                </div>
              </div>
            ))}
          </div>
          {availableRooms.length === 0 && !loading && (
            <div className="text-center py-16">
              <p className="text-outline text-lg font-label">No suites available for the selected dates. Please try different dates.</p>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#f5f3ee] dark:bg-stone-950 w-full border-t border-[#d1c5b4]/20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 px-12 py-16 max-w-screen-2xl mx-auto">
          <div className="flex flex-col gap-6">
            <div className="font-['Noto_Serif'] text-lg font-bold text-[#655d57]">Royal Residence</div>
            <p className="text-[#4e4639] text-sm font-light max-w-xs leading-relaxed">
              A legacy of luxury and a commitment to tranquility. Your sanctuary in the heart of the city awaits.
            </p>
            <div className="flex gap-4">
              <span className="material-symbols-outlined text-primary cursor-pointer hover:text-secondary" data-icon="facebook">social_leaderboard</span>
              <span className="material-symbols-outlined text-primary cursor-pointer hover:text-secondary" data-icon="photo_camera">photo_camera</span>
              <span className="material-symbols-outlined text-primary cursor-pointer hover:text-secondary" data-icon="alternate_email">alternate_email</span>
            </div>
          </div>
          <div className="flex flex-col gap-6">
            <h4 className="font-['Manrope'] text-sm tracking-widest uppercase font-bold text-[#655d57]">Navigation</h4>
            <nav className="flex flex-col gap-3">
              <a className="text-[#4e4639] hover:text-[#775a19] transition-opacity opacity-80 hover:opacity-100 font-['Manrope'] text-sm tracking-wide" href="#">Privacy Policy</a>
              <a className="text-[#4e4639] hover:text-[#775a19] transition-opacity opacity-80 hover:opacity-100 font-['Manrope'] text-sm tracking-wide" href="#">Terms of Service</a>
              <a className="text-[#4e4639] hover:text-[#775a19] transition-opacity opacity-80 hover:opacity-100 font-['Manrope'] text-sm tracking-wide" href="#">Location</a>
              <a className="text-[#4e4639] hover:text-[#775a19] transition-opacity opacity-80 hover:opacity-100 font-['Manrope'] text-sm tracking-wide" href="#">Contact Us</a>
            </nav>
          </div>
          <div className="flex flex-col gap-6">
            <h4 className="font-['Manrope'] text-sm tracking-widest uppercase font-bold text-[#655d57]">Newsletter</h4>
            <p className="text-[#4e4639] text-sm font-light leading-relaxed">
              Subscribe to receive invitations to exclusive events and seasonal offers.
            </p>
            <div className="flex border-b border-outline-variant/30 pb-2">
              <input className="bg-transparent border-none focus:ring-0 text-sm flex-1 placeholder:text-outline/50 outline-none" placeholder="Your email address" type="email"/>
              <button className="text-secondary text-sm font-bold tracking-widest uppercase">Join</button>
            </div>
          </div>
        </div>
        <div className="px-12 py-8 border-t border-[#d1c5b4]/10 max-w-screen-2xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <span className="text-[#4e4639] font-['Manrope'] text-sm tracking-wide opacity-80">© {new Date().getFullYear()} Royal Residence Malabe. All rights reserved.</span>
          <div className="flex gap-8 text-[10px] uppercase tracking-[0.2em] font-bold text-[#4e4639]">
            <span>Sri Lanka</span>
            <span>English</span>
          </div>
        </div>
      </footer>

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
