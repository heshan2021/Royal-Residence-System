// src/modules/receptionist/components/TransactionLedger.tsx
// Glassmorphic Transaction Ledger Component
// Displays complete transaction history with guest and room details

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Receipt, CreditCard, Banknote, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { getTransactionHistory } from '../lib/repository';
import { TransactionHistoryItem } from '../../../../types/room';

interface TransactionLedgerProps {
  filterDate?: string;
  filterMethod?: 'all' | 'Cash' | 'Bank';
  variant?: 'dark' | 'light';
}

export default function TransactionLedger({ filterDate, filterMethod = 'all', variant = 'dark' }: TransactionLedgerProps) {
  // Determine styling based on variant
  const isLightVariant = variant === 'light';
  
  // Base classes for light vs dark variants
  const containerClass = isLightVariant 
    ? 'bg-white border border-slate-200 rounded-2xl p-6 shadow-sm'
    : 'backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-6 shadow-xl';
  
  const textColor = isLightVariant ? 'text-slate-800' : 'text-white';
  const textMutedColor = isLightVariant ? 'text-slate-600' : 'text-white/60';
  const textMoreMutedColor = isLightVariant ? 'text-slate-500' : 'text-white/70';
  const borderColor = isLightVariant ? 'border-slate-200' : 'border-white/10';
  const hoverBg = isLightVariant ? 'hover:bg-slate-50' : 'hover:bg-white/5';
  const bgMuted = isLightVariant ? 'bg-slate-100' : 'bg-white/10';
  const bgPurple = isLightVariant ? 'bg-purple-100' : 'bg-purple-500/20';
  const textPurple = isLightVariant ? 'text-purple-600' : 'text-purple-300';
  const textGreen = isLightVariant ? 'text-green-600' : 'text-green-300';
  const textBlue = isLightVariant ? 'text-blue-600' : 'text-blue-300';
  const textRed = isLightVariant ? 'text-red-600' : 'text-red-200';
  const bgRed = isLightVariant ? 'bg-red-50 border-red-200' : 'bg-red-500/20 border-red-400/30';
  const buttonBg = isLightVariant ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700' : 'bg-white/10 hover:bg-white/20 border-white/20 text-white';
  const [transactions, setTransactions] = useState<TransactionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Filter transactions based on props
  const filteredTransactions = transactions.filter((tx) => {
    // Filter by date if provided
    if (filterDate && tx.date) {
      const txDate = new Date(tx.date).toISOString().split('T')[0];
      if (txDate !== filterDate) return false;
    }
    
    // Filter by payment method if not 'all'
    if (filterMethod !== 'all' && tx.method !== filterMethod) {
      return false;
    }
    
    return true;
  });

  // Fetch transaction history
  const fetchTransactions = useCallback(async () => {
    try {
      setError(null);
      const data = await getTransactionHistory();
      setTransactions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transactions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Handle refresh button click
  const handleRefresh = () => {
    setRefreshing(true);
    fetchTransactions();
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

  // Format payment type for display
  const formatPaymentType = (type: string) => {
    switch (type) {
      case 'advance':
        return 'Advance';
      case 'final_settlement':
        return 'Final Settlement';
      default:
        return type;
    }
  };

  // Get badge color based on payment type
  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'advance':
        return 'bg-blue-500/20 text-blue-200 border-blue-400/30';
      case 'final_settlement':
        return 'bg-green-500/20 text-green-200 border-green-400/30';
      default:
        return 'bg-gray-500/20 text-gray-200 border-gray-400/30';
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className={containerClass}>
        <div className={`flex items-center justify-center gap-3 ${textMoreMutedColor}`}>
          <RefreshCw size={24} className="animate-spin" />
          <span className="text-lg">Loading transaction history...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={containerClass}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={`p-2 ${bgPurple} rounded-lg`}>
            <Receipt size={24} className={textPurple} />
          </div>
          <div>
            <h2 className={`text-xl font-bold ${textColor}`}>Transaction Ledger</h2>
            <p className={`text-sm ${textMutedColor}`}>
              {transactions.length} transaction{transactions.length !== 1 ? 's' : ''} recorded
            </p>
          </div>
        </div>
        
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className={`flex items-center gap-2 px-4 py-2 ${buttonBg} rounded-lg transition-all duration-200
                     disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className={`flex items-center gap-3 p-4 mb-4 ${bgRed} rounded-xl`}>
          <AlertCircle size={20} className={textRed} />
          <span className={textRed}>{error}</span>
        </div>
      )}

      {/* Empty state */}
      {!error && filteredTransactions.length === 0 && (
        <div className={`text-center py-12 ${textMoreMutedColor}`}>
          <Receipt size={48} className="mx-auto mb-4 opacity-50" />
          <p className="text-lg">No transactions found</p>
          <p className="text-sm">
            {transactions.length === 0 
              ? 'Transactions will appear here after guest check-ins and check-outs'
              : 'No transactions match the current filters'
            }
          </p>
        </div>
      )}

      {/* Transaction table */}
      {filteredTransactions.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className={`border-b ${borderColor}`}>
                <th className={`text-left py-3 px-4 ${textMoreMutedColor} font-medium text-sm`}>Date</th>
                <th className={`text-left py-3 px-4 ${textMoreMutedColor} font-medium text-sm`}>Guest Name</th>
                <th className={`text-left py-3 px-4 ${textMoreMutedColor} font-medium text-sm`}>NIC</th>
                <th className={`text-left py-3 px-4 ${textMoreMutedColor} font-medium text-sm`}>Room</th>
                <th className={`text-right py-3 px-4 ${textMoreMutedColor} font-medium text-sm`}>Amount</th>
                <th className={`text-center py-3 px-4 ${textMoreMutedColor} font-medium text-sm`}>Method</th>
                <th className={`text-center py-3 px-4 ${textMoreMutedColor} font-medium text-sm`}>Type</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((tx) => (
                <tr 
                  key={tx.transactionId}
                  className={`border-b ${borderColor} ${hoverBg} transition-colors`}
                >
                  {/* Date */}
                  <td className={`py-4 px-4 ${textMoreMutedColor} text-sm`}>
                    {formatDate(tx.date)}
                  </td>
                  
                  {/* Guest Name */}
                  <td className={`py-4 px-4 ${textColor} font-medium`}>
                    {tx.guestName}
                  </td>
                  
                  {/* NIC */}
                  <td className={`py-4 px-4 ${textMutedColor} text-sm font-mono`}>
                    {tx.guestNic}
                  </td>
                  
                  {/* Room */}
                  <td className="py-4 px-4">
                    <span className={`inline-flex items-center justify-center w-10 h-10 
                                     ${bgMuted} rounded-lg ${textColor} font-bold`}>
                      {tx.roomNumber}
                    </span>
                  </td>
                  
                  {/* Amount - right aligned with tabular-nums */}
                  <td className={`py-4 px-4 text-right tabular-nums ${textGreen} font-semibold`}>
                    LKR {tx.amount.toLocaleString()}
                  </td>
                  
                  {/* Payment Method */}
                  <td className="py-4 px-4 text-center">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 
                                     ${bgMuted} rounded-full ${textMutedColor} text-sm`}>
                      {tx.method === 'Cash' ? (
                        <Banknote size={14} className={textGreen} />
                      ) : (
                        <CreditCard size={14} className={textBlue} />
                      )}
                      {tx.method}
                    </span>
                  </td>
                  
                  {/* Payment Type */}
                  <td className="py-4 px-4 text-center">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium 
                                      border ${getTypeBadgeColor(tx.type)}`}>
                      {formatPaymentType(tx.type)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary footer */}
      {filteredTransactions.length > 0 && (
        <div className={`mt-6 pt-4 border-t ${borderColor} flex justify-between items-center`}>
          <span className={`${textMutedColor} text-sm`}>
            Showing {filteredTransactions.length} of {transactions.length} transactions
            {(filterDate || filterMethod !== 'all') && ' (filtered)'}
          </span>
          <div className="text-right">
            <span className={`${textMutedColor} text-sm`}>Total Collected: </span>
            <span className={`${textGreen} font-bold tabular-nums text-lg`}>
              LKR {filteredTransactions.reduce((sum, tx) => sum + tx.amount, 0).toLocaleString()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
