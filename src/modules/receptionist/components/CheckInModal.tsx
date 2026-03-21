'use client';

import { X, UserPlus, CreditCard, Search, User } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { PaymentMethod, Guest } from '../../../../types/room';
import { findGuestByQuery } from '../lib/repository';

interface CheckInModalProps {
  room: string;
  roomPrice: number;
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
  advancePayment: number;
  paymentMethod?: PaymentMethod;
}

export function CheckInModal({ room, roomPrice, onConfirm, onClose }: CheckInModalProps) {
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
    advancePayment: 0,
    paymentMethod: 'Cash' as PaymentMethod,
  });

  const [errors, setErrors] = useState<Partial<Record<keyof CheckInData, string>>>({});

  // Guest search state
  const [searchResults, setSearchResults] = useState<Guest[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [showResults, setShowResults] = useState(false);

  // Calculate total amount
  const totalAmount = roomPrice * formData.days;
  const balanceAfterAdvance = totalAmount - formData.advancePayment;

  // Debounced search function
  const performSearch = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    try {
      const results = await findGuestByQuery(query);
      setSearchResults(results);
      setShowResults(results.length > 0);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounce search when guest name changes
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(formData.guestName);
    }, 300);

    return () => clearTimeout(timer);
  }, [formData.guestName, performSearch]);

  // Handle guest selection
  const handleGuestSelect = (guest: Guest) => {
    setSelectedGuest(guest);
    setFormData(prev => ({
      ...prev,
      guestName: guest.name,
      phoneNumber: guest.phone_number,
      nicNumber: guest.nic_number,
    }));
    setShowResults(false);
  };

  // Clear guest selection
  const handleClearGuest = () => {
    setSelectedGuest(null);
    setFormData(prev => ({
      ...prev,
      guestName: '',
      phoneNumber: '',
      nicNumber: '',
    }));
    setShowResults(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // If guest name is being changed and a guest is selected, clear the selection
    if (name === 'guestName' && selectedGuest) {
      setSelectedGuest(null);
    }
    
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
    } else if (name === 'advancePayment') {
      const amount = Math.max(0, Math.min(totalAmount, parseInt(value) || 0));
      setFormData((prev) => ({ ...prev, advancePayment: amount }));
    } else if (name === 'paymentMethod') {
      setFormData((prev) => ({ ...prev, paymentMethod: value as PaymentMethod }));
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
        advancePayment: formData.advancePayment,
        paymentMethod: formData.advancePayment > 0 ? formData.paymentMethod : undefined,
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
            {/* Selected Guest Indicator */}
            {selectedGuest && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-emerald-100 p-2 rounded-lg">
                      <User size={16} className="text-emerald-600" />
                    </div>
                    <div>
                      <div className="font-medium text-emerald-800">Existing Guest Selected</div>
                      <div className="text-xs text-emerald-600 mt-0.5">
                        {selectedGuest.name} • NIC: {selectedGuest.nic_number}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearGuest}
                    className="text-xs bg-rose-100 text-rose-700 hover:bg-rose-200 px-2 py-1 rounded-full transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}

            {/* Guest Name with Search */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Guest Name <span className="text-rose-500">*</span>
                <span className="text-gray-400 font-normal ml-2">(type to search existing guests)</span>
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  name="guestName"
                  value={formData.guestName}
                  onChange={handleChange}
                  placeholder="Enter full name, NIC, or phone number..."
                  className={`pl-10 w-full ${errors.guestName ? 'border-rose-300 focus:border-rose-500' : ''} ${selectedGuest ? 'bg-emerald-50 border-emerald-200' : ''}`}
                  disabled={!!selectedGuest}
                />
                {isSearching && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-500"></div>
                  </div>
                )}
              </div>

              {/* Search Results Dropdown */}
              {showResults && searchResults.length > 0 && !selectedGuest && (
                <div className="absolute z-10 w-full mt-1 backdrop-blur-md bg-white/90 border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                  <div className="max-h-60 overflow-y-auto">
                    {searchResults.map((guest) => (
                      <button
                        key={guest.id}
                        type="button"
                        onClick={() => handleGuestSelect(guest)}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50/80 border-b border-gray-100 last:border-b-0 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="bg-emerald-100 p-2 rounded-lg">
                            <User size={16} className="text-emerald-600" />
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{guest.name}</div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              NIC: {guest.nic_number} • Phone: {guest.phone_number}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
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
                className={`${errors.phoneNumber ? 'border-rose-300 focus:border-rose-500' : ''} ${selectedGuest ? 'bg-emerald-50 border-emerald-200' : ''}`}
                disabled={!!selectedGuest}
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
                className={`${errors.nicNumber ? 'border-rose-300 focus:border-rose-500' : ''} ${selectedGuest ? 'bg-emerald-50 border-emerald-200' : ''}`}
                disabled={!!selectedGuest}
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

            {/* Payment Section */}
            <div className="border-t border-gray-200 pt-5 mt-6">
              <div className="flex items-center gap-2 mb-4">
                <CreditCard size={18} className="text-emerald-600" />
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Payment Details</h3>
              </div>

              {/* Total Amount Display */}
              <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl p-4 mb-4 border border-slate-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Amount</span>
                  <span className="text-lg font-bold text-gray-900">LKR {totalAmount.toLocaleString()}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {roomPrice.toLocaleString()} × {formData.days} {formData.days === 1 ? 'day' : 'days'}
                </p>
              </div>

              {/* Advance Payment */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Advance Payment <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="number"
                    name="advancePayment"
                    min={0}
                    max={totalAmount}
                    value={formData.advancePayment || ''}
                    onChange={handleChange}
                    placeholder="0"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Payment Method
                  </label>
                  <select
                    name="paymentMethod"
                    value={formData.paymentMethod}
                    onChange={handleChange}
                    disabled={formData.advancePayment === 0}
                    className={`w-full ${formData.advancePayment === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank">Bank Transfer</option>
                  </select>
                </div>
              </div>

              {/* Balance After Advance */}
              {formData.advancePayment > 0 && (
                <div className="mt-4 bg-amber-50 rounded-xl p-3 border border-amber-200">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-amber-700">Balance Due at Check-out</span>
                    <span className="text-base font-semibold text-amber-800">
                      LKR {balanceAfterAdvance.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
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
