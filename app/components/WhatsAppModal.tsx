"use client";

import React, { useState } from 'react';
import { X, MessageCircle, Phone } from 'lucide-react';

interface WhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomName: string;
  checkIn: string;
  checkOut: string;
  guests: string;
  totalPrice: number;
}

export default function WhatsAppModal({
  isOpen,
  onClose,
  roomName,
  checkIn,
  checkOut,
  guests,
  totalPrice
}: WhatsAppModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-LK', {
      style: 'currency',
      currency: 'LKR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const generateWhatsAppLink = () => {
    // Format message according to specification
    const message = `Hello Royal Residence! I would like to request a booking:%0A%0A*Room:* ${roomName}%0A*Check-In:* ${formatDate(checkIn)}%0A*Check-Out:* ${formatDate(checkOut)}%0A*Guests:* ${guests}%0A*Total Expected:* ${formatPrice(totalPrice)}%0A%0AMy name is: ${name}`;
    
    // Target number: 94775745745 (display as 0775 745 745)
    const phoneNumber = '94775745745';
    
    return `https://wa.me/${phoneNumber}?text=${message}`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !phone.trim()) {
      alert('Please enter your name and phone number');
      return;
    }

    setIsSubmitting(true);
    
    // Generate WhatsApp link
    const whatsappLink = generateWhatsAppLink();
    
    // Open WhatsApp in new tab
    window.open(whatsappLink, '_blank');
    
    // Close modal after a brief delay
    setTimeout(() => {
      setIsSubmitting(false);
      onClose();
      setName('');
      setPhone('');
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-[#25190c] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <MessageCircle className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <h3 className="text-xl font-serif text-[#FDFBF7]">WhatsApp Concierge</h3>
              <p className="text-sm text-white/60">Contact our front desk directly</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>

        {/* Booking Summary */}
        <div className="p-6 border-b border-white/10">
          <h4 className="text-sm uppercase tracking-widest text-white/50 mb-4">Booking Summary</h4>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-white/70">Room</span>
              <span className="text-[#FDFBF7] font-medium">{roomName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/70">Check-In</span>
              <span className="text-[#FDFBF7]">{formatDate(checkIn)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/70">Check-Out</span>
              <span className="text-[#FDFBF7]">{formatDate(checkOut)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/70">Guests</span>
              <span className="text-[#FDFBF7]">{guests}</span>
            </div>
            <div className="flex justify-between pt-3 border-t border-white/10">
              <span className="text-white/70">Total Expected</span>
              <span className="text-xl font-medium text-[#D4AF37]">{formatPrice(totalPrice)}</span>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <h4 className="text-sm uppercase tracking-widest text-white/50 mb-4">Your Details</h4>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-white/70 mb-2">Full Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#060913]/50 border border-white/10 rounded-lg px-4 py-3 text-[#FDFBF7] focus:outline-none focus:border-[#D4AF37] transition-colors"
                placeholder="Enter your full name"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm text-white/70 mb-2">Phone Number *</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                  <Phone className="w-4 h-4 text-white/40" />
                </div>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-[#060913]/50 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-[#FDFBF7] focus:outline-none focus:border-[#D4AF37] transition-colors"
                  placeholder="Enter your phone number"
                  required
                />
              </div>
              <p className="mt-2 text-xs text-white/40">
                We'll send you a WhatsApp message to confirm your booking
              </p>
            </div>
          </div>

          {/* Contact Info */}
          <div className="mt-6 p-4 bg-[#060913]/30 rounded-lg border border-white/5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded">
                <MessageCircle className="w-4 h-4 text-green-400" />
              </div>
              <div>
                <p className="text-sm text-white/70">Contact Number</p>
                <p className="text-[#FDFBF7] font-medium">0775 745 745</p>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="mt-8">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-semibold tracking-widest uppercase py-4 px-6 rounded-lg transition-all duration-300 flex justify-center items-center gap-3"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Opening WhatsApp...
                </>
              ) : (
                <>
                  <MessageCircle className="w-5 h-5" />
                  Send WhatsApp Message
                </>
              )}
            </button>
            <p className="mt-3 text-center text-xs text-white/40">
              You'll be redirected to WhatsApp to complete your booking request
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}