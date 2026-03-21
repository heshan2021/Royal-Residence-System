'use client';

import { X, LogOut, CreditCard, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { PaymentMethod } from '../../../../types/room';

interface CheckOutModalProps {
  room: string;
  guestName: string;
  phoneNumber: string;
  nicNumber: string;
  checkOutTime: string;
  totalAmount?: number;
  paidAmount?: number;
  onConfirm: (finalPayment?: number, paymentMethod?: PaymentMethod) => void;
  onClose: () => void;
}

export function CheckOutModal({
  room,
  guestName,
  phoneNumber,
  nicNumber,
  checkOutTime,
  totalAmount = 0,
  paidAmount = 0,
  onConfirm,
  onClose,
}: CheckOutModalProps) {
  const [finalPayment, setFinalPayment] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate amounts
  const balanceDue = Math.max(0, totalAmount - paidAmount);
  const remainingAfterFinal = balanceDue - finalPayment;
  const isBalanceSettled = remainingAfterFinal <= 0;

  const handleFinalPaymentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.max(0, Math.min(balanceDue, parseInt(e.target.value) || 0));
    setFinalPayment(value);
    setError(null);
  };

  const handlePaymentMethodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPaymentMethod(e.target.value as PaymentMethod);
  };

  const handleConfirm = async () => {
    if (balanceDue > 0 && finalPayment === 0) {
      setError('Please enter a payment amount to settle the balance');
      return;
    }

    if (balanceDue > 0 && finalPayment > 0 && !paymentMethod) {
      setError('Please select a payment method');
      return;
    }

    setIsProcessing(true);
    try {
      await onConfirm(finalPayment > 0 ? finalPayment : undefined, finalPayment > 0 ? paymentMethod : undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process check-out');
      setIsProcessing(false);
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

        {/* Payment Summary */}
        <div className="space-y-4 mb-7 p-4 bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200 rounded-xl">
          <div className="flex items-center gap-2 mb-3">
            <CreditCard size={18} className="text-emerald-600" />
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Payment Summary</h3>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Total Amount</span>
              <span className="text-base font-semibold text-gray-900">LKR {totalAmount.toLocaleString()}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Already Paid</span>
              <span className="text-base font-medium text-emerald-600">LKR {paidAmount.toLocaleString()}</span>
            </div>

            <div className="border-t border-gray-300 pt-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-gray-700">Balance Due</span>
                <span className={`text-lg font-bold ${balanceDue > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  LKR {balanceDue.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Final Payment Section (only if balance due) */}
        {balanceDue > 0 && (
          <div className="space-y-4 mb-7 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle size={18} className="text-amber-600" />
              <h3 className="text-sm font-semibold text-amber-800 uppercase tracking-wide">Final Payment Required</h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-amber-700 mb-1.5">
                  Payment Amount
                </label>
                <input
                  type="number"
                  min={0}
                  max={balanceDue}
                  value={finalPayment || ''}
                  onChange={handleFinalPaymentChange}
                  placeholder="Enter amount"
                  className="w-full border-amber-300 focus:border-amber-500 focus:ring-amber-500"
                />
                <div className="flex justify-between mt-1">
                  <button
                    type="button"
                    onClick={() => setFinalPayment(Math.floor(balanceDue * 0.5))}
                    className="text-xs text-amber-600 hover:text-amber-800"
                  >
                    50%
                  </button>
                  <button
                    type="button"
                    onClick={() => setFinalPayment(balanceDue)}
                    className="text-xs text-amber-600 hover:text-amber-800"
                  >
                    Full Amount
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-amber-700 mb-1.5">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={handlePaymentMethodChange}
                  className="w-full border-amber-300 focus:border-amber-500 focus:ring-amber-500"
                >
                  <option value="Cash">Cash</option>
                  <option value="Bank">Bank Transfer</option>
                </select>
              </div>

              {finalPayment > 0 && (
                <div className="mt-3 p-3 bg-white/80 rounded-lg border border-amber-300">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-amber-700">Remaining After Payment</span>
                    <span className={`text-base font-semibold ${remainingAfterFinal > 0 ? 'text-amber-800' : 'text-emerald-600'}`}>
                      LKR {remainingAfterFinal.toLocaleString()}
                    </span>
                  </div>
                  {remainingAfterFinal > 0 && (
                    <p className="text-xs text-amber-600 mt-1">
                      Note: Check-out will not be allowed with outstanding balance
                    </p>
                  )}
                </div>
              )}
            </div>

            {error && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 btn-secondary"
            disabled={isProcessing}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isProcessing || (balanceDue > 0 && !isBalanceSettled)}
            className={`flex-1 flex items-center justify-center gap-2 ${
              balanceDue > 0 && !isBalanceSettled
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'btn-danger'
            }`}
          >
            {isProcessing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Processing...
              </>
            ) : (
              <>
                <LogOut size={18} />
                {balanceDue > 0 ? 'Pay & Check Out' : 'Check Out'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
