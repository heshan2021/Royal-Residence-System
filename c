'use client';

import { X, LogOut, User, Phone, CreditCard, Clock } from 'lucide-react';

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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Check Out</h2>
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
          {/* Guest Details Card */}
          <div className="bg-gray-50 rounded-xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-white rounded-lg shadow-sm">
                <User className="w-4 h-4 text-gray-500" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Guest Name</p>
                <p className="text-base font-semibold text-gray-900 mt-0.5">{guestName}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-white rounded-lg shadow-sm">
                <Phone className="w-4 h-4 text-gray-500" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Phone Number</p>
                <p className="text-sm text-gray-700 mt-0.5">{phoneNumber}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-white rounded-lg shadow-sm">
                <CreditCard className="w-4 h-4 text-gray-500" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">NIC Number</p>
                <p className="text-sm text-gray-700 mt-0.5">{nicNumber}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-rose-100 rounded-lg">
                <Clock className="w-4 h-4 text-rose-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Check-Out Time</p>
                <p className="text-base font-semibold text-rose-600 mt-0.5">{checkOutTime}</p>
              </div>
            </div>
          </div>

          {/* Confirmation Message */}
          <div className="mt-5 p-4 bg-amber-50 border border-amber-100 rounded-xl">
            <p className="text-sm text-amber-800">
              Please confirm that the guest has completed checkout and the room is ready for cleaning.
            </p>
          </div>
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
            onClick={onConfirm}
            className="btn-danger flex-1"
          >
            <LogOut size={18} />
            Confirm Check Out
          </button>
        </div>
      </div>
    </div>
  );
}
