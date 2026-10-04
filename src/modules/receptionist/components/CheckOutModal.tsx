'use client';

import { X, LogOut, CreditCard, AlertCircle, BadgePercent } from 'lucide-react';
import { useState } from 'react';
import { PaymentMethod, CheckOutSubmission } from '../../../../types/room';
import {
  DISCOUNT_REASONS,
  OTHER_DISCOUNT_REASON,
  DISCOUNT_REASON_MAX_LENGTH,
  composeDiscountReason,
} from '../../../../lib/discounts';

interface CheckOutModalProps {
  room: string;
  guestName: string;
  phoneNumber: string;
  nicNumber: string;
  checkOutTime: string;
  totalAmount?: number;
  paidAmount?: number;
  isDueOut?: boolean;
  isOverdue?: boolean;
  overdueDays?: number;
  onSwitchToCheckIn?: () => void;
  // One submission object instead of a growing argument list: the discount
  // arrived after finalPayment/paymentMethod/earlyDeparture, and a slip in the
  // order here would silently discount the wrong amount.
  onConfirm: (submission: CheckOutSubmission) => void | Promise<void>;
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
  isDueOut,
  isOverdue,
  overdueDays,
  onSwitchToCheckIn,
  onConfirm,
  onClose,
}: CheckOutModalProps) {
  const [finalPayment, setFinalPayment] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Early departure: the guest leaves before the booked date. The server re-prices
  // the folio for the nights actually used and records the difference as a refund.
  const [isEarlyDeparture, setIsEarlyDeparture] = useState(false);
  // Discount: a concession agreed with the guest - a student, a night where no
  // cheaper room was free, a repeating customer, goodwill. It always needs a
  // reason, and it only ever forgives debt: it is never handed back as cash.
  const [isDiscounted, setIsDiscounted] = useState(false);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [discountPreset, setDiscountPreset] = useState<string>(DISCOUNT_REASONS[0]);
  const [discountNote, setDiscountNote] = useState('');

  // Calculate amounts
  const balanceDue = Math.max(0, totalAmount - paidAmount);
  // A discount can only write off what is owed, so it is clamped to the balance.
  const effectiveDiscount = isDiscounted ? Math.max(0, Math.min(discountAmount, balanceDue)) : 0;
  // What the guest still has to pay once the concession is taken off: the figure
  // the final payment has to clear, and the figure the API settles against.
  const netPayable = balanceDue - effectiveDiscount;
  const remainingAfterFinal = netPayable - finalPayment;
  const isBalanceSettled = remainingAfterFinal <= 0;
  // When leaving early the folio shrinks (and may already be overpaid), so the
  // final balance is decided by the server, not by the figures shown here.
  const isBalanceGateDisabled = isEarlyDeparture;
  // The reason as it will be stored ('' means the desk has not stated one yet).
  const discountReason = composeDiscountReason(discountPreset, discountNote);
  const needsReasonDetail = isDiscounted && effectiveDiscount > 0 && discountReason === '';

  const handleFinalPaymentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.max(0, Math.min(netPayable, parseInt(e.target.value) || 0));
    setFinalPayment(value);
    setError(null);
  };

  const handlePaymentMethodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPaymentMethod(e.target.value as PaymentMethod);
  };

  const handleEarlyDepartureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsEarlyDeparture(e.target.checked);
    setError(null);
  };

  const handleDiscountToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const enabled = e.target.checked;
    setIsDiscounted(enabled);
    setError(null);
    if (!enabled) {
      // Take the concession back off the folio entirely.
      setDiscountAmount(0);
      setDiscountNote('');
      setDiscountPreset(DISCOUNT_REASONS[0]);
    }
  };

  /** Apply a discount amount - the input and the "Full Balance" shortcut share this. */
  const applyDiscountAmount = (raw: number) => {
    const value = Math.max(0, Math.min(raw, balanceDue));
    setDiscountAmount(value);
    setError(null);
    // Typing a discount means "forgive this much and take the rest", which is the
    // everyday case at the desk: prefill the final payment so nobody has to
    // repeat the same arithmetic.
    setFinalPayment(Math.max(0, balanceDue - value));
  };

  const handleDiscountAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    applyDiscountAmount(parseInt(e.target.value) || 0);
  };

  const handleDiscountPresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDiscountPreset(e.target.value);
    setError(null);
  };

  const handleDiscountNoteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDiscountNote(e.target.value);
    setError(null);
  };

  const handleConfirm = async () => {
    // A discount without a reason is never allowed: every rupee given away has to
    // be attributable to something the desk can defend to the owner.
    if (needsReasonDetail) {
      setError(
        discountPreset === OTHER_DISCOUNT_REASON
          ? 'Please type the reason for this discount'
          : 'Please give a reason for this discount'
      );
      return;
    }
    if (discountReason.length > DISCOUNT_REASON_MAX_LENGTH) {
      setError(`The discount reason must be ${DISCOUNT_REASON_MAX_LENGTH} characters or fewer`);
      return;
    }

    if (!isEarlyDeparture && netPayable > 0 && finalPayment === 0) {
      setError('Please enter a payment amount to settle the balance');
      return;
    }

    if (netPayable > 0 && finalPayment > 0 && !paymentMethod) {
      setError('Please select a payment method');
      return;
    }

    setIsProcessing(true);
    try {
      await onConfirm({
        finalPayment: finalPayment > 0 ? finalPayment : undefined,
        paymentMethod: finalPayment > 0 ? paymentMethod : undefined,
        earlyDeparture: isEarlyDeparture,
        // Only a real, reasoned concession travels to the server.
        discountAmount: effectiveDiscount > 0 ? effectiveDiscount : undefined,
        discountReason: effectiveDiscount > 0 ? discountReason : undefined,
      });
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

        <h2 className="text-2xl font-bold text-gray-900 mb-1">
          {isOverdue ? 'Process Checkout (Not Checked Out)' : isDueOut ? 'Process Checkout (Due Out)' : 'Check-Out'}
        </h2>
        <p className="text-gray-600 mb-6 text-sm">Room {room}</p>

        {/* Unclosed folio: the stay window ended but the folio was never settled */}
        {isOverdue && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3">
            <AlertCircle size={18} className="text-rose-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-rose-800">This stay has already ended</p>
              <p className="text-xs text-rose-600 mt-1">
                The folio was left open
                {overdueDays && overdueDays > 0
                  ? ` ${overdueDays} day${overdueDays > 1 ? 's' : ''} ago`
                  : ''}
                . Collect the balance below to close it and release room {room}.
              </p>
            </div>
          </div>
        )}

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

            {/* A discount reduces what is charged, so it sits above the balance
                the desk is about to collect. */}
            {effectiveDiscount > 0 && (
              <div className="flex justify-between items-center gap-3">
                <span className="text-sm text-gray-600">
                  Discount
                  {discountReason ? ` · ${discountReason}` : ''}
                </span>
                <span className="text-base font-semibold text-fuchsia-700 whitespace-nowrap">
                  − LKR {effectiveDiscount.toLocaleString()}
                </span>
              </div>
            )}

            <div className="border-t border-gray-300 pt-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-gray-700">
                  {effectiveDiscount > 0 ? 'Balance Due After Discount' : 'Balance Due'}
                </span>
                <span className={`text-lg font-bold ${netPayable > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  LKR {netPayable.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Early Departure (re-pricing + refund).
            Not offered for an unclosed folio: the stay already ran to its booked
            check-out date, so there are no unused nights to refund. */}
        {!isOverdue && (
        <div className={`mb-7 p-4 rounded-xl border ${isEarlyDeparture ? 'bg-sky-50 border-sky-200' : 'bg-gray-50 border-gray-200'}`}>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isEarlyDeparture}
              onChange={handleEarlyDepartureChange}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500"
            />
            <span>
              <span className="block text-sm font-semibold text-gray-800">Guest is checking out early</span>
              <span className="block text-xs text-gray-600 mt-1">
                The folio is re-priced for the nights actually stayed. Any overpayment is recorded as
                a refund; anything still owed stays on the folio so the room can be released for sale.
              </span>
            </span>
          </label>
        </div>
        )}

        {/* Discount (concession with a reason). Offered for every folio too, not
            just a scheduled one: writing part of an old debt off is exactly what
            an unclosed folio needs. */}
        <div className={`mb-7 p-4 rounded-xl border ${effectiveDiscount > 0 ? 'bg-fuchsia-50 border-fuchsia-200' : 'bg-gray-50 border-gray-200'}`}>
          <label className={`flex items-start gap-3 ${balanceDue > 0 ? 'cursor-pointer' : ''}`}>
            <input
              type="checkbox"
              checked={isDiscounted}
              onChange={handleDiscountToggle}
              disabled={balanceDue <= 0}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-fuchsia-600 focus:ring-fuchsia-500"
            />
            <span>
              <span className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                <BadgePercent size={16} className="text-fuchsia-600" />
                Give this guest a discount
              </span>
              <span className="block text-xs text-gray-600 mt-1">
                {balanceDue > 0
                  ? 'For a student, a night where no cheaper room was free, a repeating customer, goodwill - a reason is required. The discount lowers what the guest owes; it is never handed back as cash.'
                  : 'Nothing is owed on this folio, so there is nothing to discount.'}
              </span>
            </span>
          </label>

          {isDiscounted && (
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-fuchsia-700 mb-1.5">
                  Discount Amount (LKR)
                </label>
                <input
                  type="number"
                  min={0}
                  max={balanceDue}
                  step={1}
                  value={discountAmount || ''}
                  onChange={handleDiscountAmountChange}
                  placeholder="Enter amount"
                  className="w-full border-fuchsia-300 focus:border-fuchsia-500 focus:ring-fuchsia-500"
                />
                <div className="flex justify-between mt-1 gap-3">
                  <span className="text-xs text-fuchsia-700">
                    Up to LKR {balanceDue.toLocaleString()} (the balance due)
                  </span>
                  <button
                    type="button"
                    onClick={() => applyDiscountAmount(balanceDue)}
                    className="text-xs text-fuchsia-600 hover:text-fuchsia-800 whitespace-nowrap"
                  >
                    Full Balance
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-fuchsia-700 mb-1.5">
                  Reason
                </label>
                <select
                  value={discountPreset}
                  onChange={handleDiscountPresetChange}
                  className="w-full border-fuchsia-300 focus:border-fuchsia-500 focus:ring-fuchsia-500"
                >
                  {DISCOUNT_REASONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-fuchsia-700 mb-1.5">
                  {discountPreset === OTHER_DISCOUNT_REASON ? 'Please specify the reason' : 'Note (optional)'}
                </label>
                <input
                  type="text"
                  value={discountNote}
                  onChange={handleDiscountNoteChange}
                  maxLength={DISCOUNT_REASON_MAX_LENGTH}
                  placeholder={
                    discountPreset === OTHER_DISCOUNT_REASON
                      ? 'e.g. Guest is a family friend'
                      : 'Anything the owner should know'
                  }
                  className="w-full border-fuchsia-300 focus:border-fuchsia-500 focus:ring-fuchsia-500"
                />
                {needsReasonDetail && (
                  <p className="text-xs text-rose-600 mt-1">
                    A reason is required whenever a discount is given.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Final Payment Section (only if a balance remains) */}
        {netPayable > 0 && (
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
                  max={netPayable}
                  value={finalPayment || ''}
                  onChange={handleFinalPaymentChange}
                  placeholder="Enter amount"
                  className="w-full border-amber-300 focus:border-amber-500 focus:ring-amber-500"
                />
                <div className="flex justify-between mt-1">
                  <button
                    type="button"
                    onClick={() => setFinalPayment(Math.floor(netPayable * 0.5))}
                    className="text-xs text-amber-600 hover:text-amber-800"
                  >
                    50%
                  </button>
                  <button
                    type="button"
                    onClick={() => setFinalPayment(netPayable)}
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
                      {isEarlyDeparture
                        ? 'Early departure: the folio is re-priced and any shortfall is carried on the folio'
                        : 'Note: Check-out will not be allowed with outstanding balance'}
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
            disabled={isProcessing || (!isBalanceGateDisabled && netPayable > 0 && !isBalanceSettled)}
            className={`flex-1 flex items-center justify-center gap-2 ${
              !isBalanceGateDisabled && netPayable > 0 && !isBalanceSettled
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
                {isEarlyDeparture ? 'Check Out Early' : netPayable > 0 ? 'Pay & Check Out' : 'Check Out'}
              </>
            )}
          </button>
        </div>

        {/* Section B: the second half of the day is re-sellable.
            A due-out guest frees the room at 11:00 today; an UNCLOSED folio
            ("Not Checked Out") is still bookable for this afternoon as well -
            the guest is leaving, the money is collected from this same card.
            Gating this on `isDueOut` alone hid the only door to the booking
            form for every overdue folio, so the room could not be re-sold. */}
        {(isDueOut || isOverdue) && onSwitchToCheckIn && (
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-emerald-800 uppercase tracking-wide mb-1">
                  {isDueOut ? 'Afternoon Availability' : 'Still Bookable Today'}
                </h3>
                <p className="text-sm text-emerald-600">
                  {isDueOut
                    ? 'Room is available for a new check-in today.'
                    : 'The unclosed folio keeps this room on the board. The arriving guest can still be booked for today - this folio stays open until it is settled.'}
                </p>
              </div>
              <button
                type="button"
                onClick={onSwitchToCheckIn}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap shadow-sm"
              >
                New Booking
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
