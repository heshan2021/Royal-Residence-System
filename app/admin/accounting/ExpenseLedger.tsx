// app/admin/accounting/ExpenseLedger.tsx
// Glassmorphic Expense Ledger Component
// Displays complete expense history with category and description details

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Receipt, AlertCircle, Tag, FileText } from 'lucide-react';
import { format } from 'date-fns';

// Expense item interface matching API response
interface ExpenseItem {
  id: string;
  amount: number;
  category: string;
  description: string | null;
  expenseDate: string;
  createdAt: string;
}

interface ExpenseLedgerProps {
  filterDate?: string;
  filterCategory?: 'all' | 'Marketing' | 'Maintenance' | 'Guest Supplies' | 'Utilities' | 'Other';
  onRefresh?: () => void;
}

export default function ExpenseLedger({ filterDate, filterCategory = 'all', onRefresh }: ExpenseLedgerProps) {
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Filter expenses based on props
  const filteredExpenses = expenses.filter((expense) => {
    // Filter by date if provided
    if (filterDate && expense.expenseDate) {
      const expDate = new Date(expense.expenseDate).toISOString().split('T')[0];
      if (expDate !== filterDate) return false;
    }
    
    // Filter by category if not 'all'
    if (filterCategory !== 'all' && expense.category !== filterCategory) {
      return false;
    }
    
    return true;
  });

  // Fetch expenses from API
  const fetchExpenses = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch('/api/admin/expenses');
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      setExpenses(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load expenses');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  // Handle refresh button click
  const handleRefresh = () => {
    setRefreshing(true);
    fetchExpenses();
    onRefresh?.();
  };

  // Format date for display
  const formatDate = (date: string | null) => {
    if (!date) return 'N/A';
    try {
      return format(new Date(date), 'MMM dd, yyyy HH:mm');
    } catch {
      return 'Invalid Date';
    }
  };

  // Get category badge color
  const getCategoryBadgeColor = (category: string) => {
    switch (category) {
      case 'Marketing':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Maintenance':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Guest Supplies':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'Utilities':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'Other':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="bg-white/80 backdrop-blur-xl border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-center gap-3 text-slate-500">
          <RefreshCw size={24} className="animate-spin" />
          <span className="text-lg">Loading expense history...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/80 backdrop-blur-xl border border-slate-200 rounded-2xl p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-rose-100 rounded-lg">
            <Receipt size={24} className="text-rose-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Expense Ledger</h2>
            <p className="text-sm text-slate-500">
              {expenses.length} expense{expenses.length !== 1 ? 's' : ''} recorded
            </p>
          </div>
        </div>
        
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 
                     border border-slate-300 rounded-lg text-slate-700 transition-all duration-200
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-3 p-4 mb-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle size={20} className="text-red-600" />
          <span className="text-red-600">{error}</span>
        </div>
      )}

      {/* Empty state */}
      {!error && filteredExpenses.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <Receipt size={48} className="mx-auto mb-4 opacity-50" />
          <p className="text-lg">No expenses found</p>
          <p className="text-sm">
            {expenses.length === 0 
              ? 'Expenses will appear here after they are added'
              : 'No expenses match the current filters'
            }
          </p>
        </div>
      )}

      {/* Expense table */}
      {filteredExpenses.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4 text-slate-500 font-medium text-sm">Date</th>
                <th className="text-left py-3 px-4 text-slate-500 font-medium text-sm">Category</th>
                <th className="text-left py-3 px-4 text-slate-500 font-medium text-sm">Description</th>
                <th className="text-right py-3 px-4 text-slate-500 font-medium text-sm">Amount</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.map((expense) => (
                <tr 
                  key={expense.id}
                  className="border-b border-slate-200 hover:bg-slate-50 transition-colors"
                >
                  {/* Date */}
                  <td className="py-4 px-4 text-slate-600 text-sm">
                    {formatDate(expense.expenseDate)}
                  </td>
                  
                  {/* Category */}
                  <td className="py-4 px-4">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 
                                     rounded-full text-sm font-medium border ${getCategoryBadgeColor(expense.category)}`}>
                      <Tag size={14} />
                      {expense.category}
                    </span>
                  </td>
                  
                  {/* Description */}
                  <td className="py-4 px-4 text-slate-700">
                    {expense.description ? (
                      <div className="flex items-start gap-2">
                        <FileText size={16} className="text-slate-400 mt-0.5 flex-shrink-0" />
                        <span className="line-clamp-2">{expense.description}</span>
                      </div>
                    ) : (
                      <span className="text-slate-400 italic">No description</span>
                    )}
                  </td>
                  
                  {/* Amount - right aligned with tabular-nums */}
                  <td className="py-4 px-4 text-right tabular-nums text-rose-600 font-semibold">
                    LKR {expense.amount.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary footer */}
      {filteredExpenses.length > 0 && (
        <div className="mt-6 pt-4 border-t border-slate-200 flex justify-between items-center">
          <span className="text-slate-500 text-sm">
            Showing {filteredExpenses.length} of {expenses.length} expenses
            {(filterDate || filterCategory !== 'all') && ' (filtered)'}
          </span>
          <div className="text-right">
            <span className="text-slate-500 text-sm">Total Expenses: </span>
            <span className="text-rose-600 font-bold tabular-nums text-lg">
              LKR {filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0).toLocaleString()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
