'use client';

import { X, LogOut } from 'lucide-react';

interface CheckOutModalProps {
  room: string;
  guestName: string;
  phoneNumber: string;
  nicNumber: string;
  checkOutTime: string;
  onConfirm: () => void;
  onClose: () => void;
}

export function CheckOutModal({
  room,
  guestName,
  phoneNumber,
  nicNumber,
  checkOutTime,
  onConfirm,
  onClose,
}: CheckOutModalProps) {
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

        <h2 className="text-2xl font-bold text-gray-900 mb-1">Check-Out</h2>
        <p className="text-gray-600 mb-6 text-sm">Room {room}</p>

        {/* Guest Details (Read-only) */}
        <div className="space-y-4 mb-7 p-4 bg-gray-50 border border-gray-200 rounded-xl">
          <div>
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Guest Name</p>
            <p className="text-base text-gray-900 font-semibold">{guestName}</p>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Phone Number</p>
            <p className="text-gray-700">{phoneNumber}</p>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">NIC Number</p>
            <p className="text-gray-700">{nicNumber}</p>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Check-Out Time</p>
            <p className="text-base font-semibold text-red-600">{checkOutTime}</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 btn-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 btn-danger flex items-center justify-center gap-2"
          >
            <LogOut size={18} />
            Check Out
          </button>
        </div>
      </div>
    </div>
  );
}
