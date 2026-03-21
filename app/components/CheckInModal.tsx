'use client';

import { X } from 'lucide-react';
import { useState } from 'react';

interface CheckInModalProps {
  room: string;
  onConfirm: (data: CheckInData) => void;
  onClose: () => void;
}

export interface CheckInData {
  guestName: string;
  phoneNumber: string;
  nicNumber: string;
  checkInTime: string;
  checkOutTime: string;
  days: number;
  adults: number;
  kids: number;
}


export function CheckInModal({ room, onConfirm, onClose }: CheckInModalProps) {
  // Get current time in HH:mm 24-hour format
  function getNowTime() {
    const now = new Date();
    return now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  // Calculate checkout date/time string
  function calcCheckout(days: number, checkInTime: string) {
    const [h, m] = checkInTime.split(':').map(Number);
    const now = new Date();
    now.setHours(h, m, 0, 0);
    now.setDate(now.getDate() + days);
    return now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }) + ' ' + now.toLocaleDateString('en-GB');
  }

  const [formData, setFormData] = useState({
    guestName: '',
    phoneNumber: '',
    nicNumber: '',
    checkInTime: getNowTime(),
    checkOutTime: calcCheckout(1, getNowTime()),
    days: 1 as number,
    adults: 1,
    kids: 0,
  });

  const [errors, setErrors] = useState<Partial<Record<keyof CheckInData, string>>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'days') {
      const days = Math.max(1, parseInt(value) || 1);
      setFormData((prev) => ({
        ...prev,
        days,
        checkOutTime: calcCheckout(days, prev.checkInTime),
      }));
    } else if (name === 'checkInTime') {
      setFormData((prev) => ({
        ...prev,
        checkInTime: value,
        checkOutTime: calcCheckout(prev.days, value),
      }));
    } else if (name === 'adults' || name === 'kids') {
      setFormData((prev) => ({ ...prev, [name]: parseInt(value) }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
    // Clear error for this field when user starts typing
    if (errors[name as keyof CheckInData]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<CheckInData> = {};

    if (!formData.guestName.trim()) newErrors.guestName = 'Guest name is required';
    if (!formData.phoneNumber.trim()) newErrors.phoneNumber = 'Phone number is required';
    if (!formData.nicNumber.trim()) newErrors.nicNumber = 'NIC number is required';
    if (!formData.checkOutTime.trim()) newErrors.checkOutTime = 'Check-out time is required';
    if (!formData.days || formData.days < 1) newErrors.days = 'Number of days must be at least 1';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      // Only pass the required fields
      onConfirm({
        guestName: formData.guestName,
        phoneNumber: formData.phoneNumber,
        nicNumber: formData.nicNumber,
        checkInTime: formData.checkInTime,
        checkOutTime: formData.checkOutTime,
        days: formData.days,
        adults: formData.adults,
        kids: formData.kids,
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-2xl max-w-md w-full px-16 py-20 md:px-24 md:py-24 relative space-y-10">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Close"
        >
          <X size={20} />
        </button>

        <h2 className="text-2xl font-bold text-gray-900 mb-1">Check-In</h2>
        <p className="text-gray-600 mb-6 text-sm">Room {room}</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Guest Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Guest Name *</label>
            <input
              type="text"
              name="guestName"
              value={formData.guestName}
              onChange={handleChange}
              placeholder="Full name"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all bg-white"
            />
            {errors.guestName && <p className="text-red-600 text-xs mt-1.5 font-medium">{errors.guestName}</p>}
          </div>

          {/* Phone Number */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Phone Number *</label>
            <input
              type="tel"
              name="phoneNumber"
              value={formData.phoneNumber}
              onChange={handleChange}
              placeholder="+94 ..."
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all bg-white"
            />
            {errors.phoneNumber && <p className="text-red-600 text-xs mt-1.5 font-medium">{errors.phoneNumber}</p>}
          </div>

          {/* NIC Number */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">NIC Number *</label>
            <input
              type="text"
              name="nicNumber"
              value={formData.nicNumber}
              onChange={handleChange}
              placeholder="National ID"
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-white/40 focus:bg-white/15 transition-all"
            />
            {errors.nicNumber && <p className="text-red-300 text-xs mt-1">{errors.nicNumber}</p>}
          </div>

          {/* Check-In Time and Days */}
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-900 mb-2">Check-In Time</label>
              <input
                type="time"
                name="checkInTime"
                value={formData.checkInTime}
                onChange={handleChange}
                className="w-full"
              />
            </div>
            <div className="flex flex-col items-center" style={{ minWidth: '80px' }}>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Days</label>
              <input
                type="number"
                name="days"
                min={1}
                value={formData.days}
                onChange={handleChange}
                className="short-number-input text-center"
                style={{ maxWidth: '60px' }}
              />
              {errors.days && <p className="text-red-600 text-xs mt-1.5 font-medium">{errors.days}</p>}
            </div>
          </div>

          {/* Number of Adults */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Adults</label>
              <div className="flex justify-center">
                <input
                  type="range"
                  name="adults"
                  min={1}
                  max={2}
                  value={formData.adults}
                  onChange={handleChange}
                  className="modern-slider" style={{ maxWidth: '70px' }}
                />
              </div>
            <div className="text-xs text-gray-700 mt-1">{formData.adults} adult{formData.adults > 1 ? 's' : ''}</div>
          </div>

          {/* Number of Kids */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Kids</label>
              <div className="flex justify-center">
                <input
                  type="range"
                  name="kids"
                  min={0}
                  max={5}
                  value={formData.kids}
                  onChange={handleChange}
                  className="modern-slider" style={{ maxWidth: '70px' }}
                />
              </div>
            <div className="text-xs text-gray-700 mt-1">{formData.kids} kid{formData.kids !== 1 ? 's' : ''}</div>
          </div>

          {/* Check-Out Time (calculated) */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Check-Out Time</label>
            <input
              type="text"
              name="checkOutTime"
              value={formData.checkOutTime}
              readOnly
              className="w-full bg-gray-100 cursor-not-allowed"
            />
          </div>

          {/* Action buttons */}
            <div className="flex gap-3 mt-7">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                className="flex-1 btn-primary"
              >
                Check In
              </button>
            </div>
        </form>
      </div>
    </div>
  );
}
