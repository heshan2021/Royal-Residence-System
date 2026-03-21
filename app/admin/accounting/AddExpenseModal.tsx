// app/admin/accounting/AddExpenseModal.tsx
// Glassmorphic modal for adding business expenses

'use client';

import { useState } from 'react';
import { X, Plus, AlertCircle, CheckCircle } from 'lucide-react';
import { addExpense } from '../../../src/modules/receptionist/lib/repository';

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExpenseAdded: () => void;
}

const EXPENSE_CATEGORIES = [
  'Marketing',
  'Maintenance', 
  'Guest Supplies',
  'Utilities',
  'Other'
] as const;

export default function AddExpenseModal({ isOpen, onClose, onExpenseAdded }: AddExpenseModalProps) {
  const [amount, setAmount] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate inputs
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount greater than 0');
      return;
    }

    if (!category) {
      setError('Please select a category');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await addExpense(
        Math.round(parseFloat(amount)), // Convert to integer LKR amount
        category,
        description.trim() || undefined
      );

      // Success
      setSuccess(true);
      
      // Reset form
      setAmount('');
      setCategory('');
      setDescription('');
      
      // Notify parent to refresh data
      setTimeout(() => {
        onExpenseAdded();
        setSuccess(false);
        onClose();
      }, 1500);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add expense');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setAmount('');
      setCategory('');
      setDescription('');
      setError(null);
      setSuccess(false);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md bg-white/90 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div>
            <h2 className="text-xl font-semibold text-slate-800">Add Business Expense</h2>
            <p className="text-sm text-slate-500 mt-1">Record a new expense for accounting</p>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Error/Success Messages */}
          {error && (
            <div className="flex items-center gap-3 p-4 mb-6 bg-red-500/20 border border-red-400/30 rounded-xl">
              <AlertCircle size={20} className="text-red-500" />
              <span className="text-red-700">{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-3 p-4 mb-6 bg-emerald-500/20 border border-emerald-400/30 rounded-xl">
              <CheckCircle size={20} className="text-emerald-500" />
              <span className="text-emerald-700">Expense added successfully!</span>
            </div>
          )}

          {/* Amount Field */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Amount (LKR)
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500">
                LKR
              </div>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                min="1"
                step="1"
                className="w-full pl-16 pr-4 py-3 bg-white border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                disabled={loading || success}
              />
            </div>
            <p className="text-xs text-slate-500 mt-2">Enter the expense amount in Sri Lankan Rupees</p>
          </div>

          {/* Category Field */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all appearance-none"
              disabled={loading || success}
            >
              <option value="">Select a category</option>
              {EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Description Field */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Facebook Ads, Plumbing fix, Electricity bill..."
              rows={3}
              className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
              disabled={loading || success}
            />
            <p className="text-xs text-slate-500 mt-2">Brief description of what the expense was for</p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="flex-1 px-6 py-3 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || success}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Adding...</span>
                </>
              ) : (
                <>
                  <Plus size={18} />
                  <span>Add Expense</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/50 rounded-b-2xl">
          <p className="text-xs text-slate-500 text-center">
            Expenses are recorded immediately and will affect the Net Profit calculation
          </p>
        </div>
      </div>
    </div>
  );
}