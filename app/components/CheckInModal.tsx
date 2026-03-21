'use client';

import { X, UserPlus } from 'lucide-react';
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
  function getNowTime() {
    const now = new Date();
    return now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

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
    days: 1,
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
    if (errors[name as keyof CheckInData]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof CheckInData, string>> = {};

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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Check In</h2>
              <p className="text-sm text-gray-500 mt-0.5">Room {room}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="modal-body">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Guest Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Guest Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="guestName"
                value={formData.guestName}
                onChange={handleChange}
                placeholder="Enter full name"
                className={errors.guestName ? 'border-rose-300 focus:border-rose-500' : ''}
              />
              {errors.guestName && <p className="text-rose-600 text-xs mt-1.5">{errors.guestName}</p>}
            </div>

            {/* Phone Number */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Phone Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="tel"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleChange}
                placeholder="+94 7X XXX XXXX"
                className={errors.phoneNumber ? 'border-rose-300 focus:border-rose-500' : ''}
              />
              {errors.phoneNumber && <p className="text-rose-600 text-xs mt-1.5">{errors.phoneNumber}</p>}
            </div>

            {/* NIC Number */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                NIC Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="nicNumber"
                value={formData.nicNumber}
                onChange={handleChange}
                placeholder="National ID number"
                className={errors.nicNumber ? 'border-rose-300 focus:border-rose-500' : ''}
              />
              {errors.nicNumber && <p className="text-rose-600 text-xs mt-1.5">{errors.nicNumber}</p>}
            </div>

            {/* Check-In Time and Days */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Check-In Time
                </label>
                <input
                  type="time"
                  name="checkInTime"
                  value={formData.checkInTime}
                  onChange={handleChange}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Number of Days
                </label>
                <input
                  type="number"
                  name="days"
                  min={1}
                  value={formData.days}
                  onChange={handleChange}
                  className="short-number-input w-full"
                />
                {errors.days && <p className="text-rose-600 text-xs mt-1.5">{errors.days}</p>}
              </div>
            </div>

            {/* Guests */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Adults
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    name="adults"
                    min={1}
                    max={4}
                    value={formData.adults}
                    onChange={handleChange}
                    className="modern-slider flex-1"
                  />
                  <span className="text-sm font-medium text-gray-900 w-6 text-center">{formData.adults}</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Kids
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    name="kids"
                    min={0}
                    max={5}
                    value={formData.kids}
                    onChange={handleChange}
                    className="modern-slider flex-1"
                  />
                  <span className="text-sm font-medium text-gray-900 w-6 text-center">{formData.kids}</span>
                </div>
              </div>
            </div>

            {/* Check-Out Time (calculated) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Check-Out Time
              </label>
              <input
                type="text"
                name="checkOutTime"
                value={formData.checkOutTime}
                readOnly
                className="bg-gray-50"
              />
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary flex-1"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="btn-primary flex-1"
          >
            <UserPlus size={18} />
            Check In
          </button>
        </div>
      </div>
    </div>
  );
}
