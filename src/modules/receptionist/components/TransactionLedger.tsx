// src/modules/receptionist/components/TransactionLedger.tsx
// Glassmorphic Transaction Ledger Component
// Displays complete transaction history with guest and room details

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Receipt, CreditCard, Banknote, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { getTransactionHistory } from '../lib/repository';
import { TransactionHistoryItem } from '../../../../types/room';

export default function TransactionLedger() {
  const [transactions, setTransactions] = useState<TransactionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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
      <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-8 shadow-xl">
        <div className="flex items-center justify-center gap-3 text-white/70">
          <RefreshCw size={24} className="animate-spin" />
          <span className="text-lg">Loading transaction history...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-6 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/20 rounded-lg">
            <Receipt size={24} className="text-purple-300" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Transaction Ledger</h2>
            <p className="text-sm text-white/60">
              {transactions.length} transaction{transactions.length !== 1 ? 's' : ''} recorded
            </p>
          </div>
        </div>
        
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 
                     border border-white/20 rounded-lg text-white transition-all duration-200
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-3 p-4 mb-4 bg-red-500/20 border border-red-400/30 rounded-xl">
          <AlertCircle size={20} className="text-red-300" />
          <span className="text-red-200">{error}</span>
        </div>
      )}

      {/* Empty state */}
      {!error && transactions.length === 0 && (
        <div className="text-center py-12 text-white/50">
          <Receipt size={48} className="mx-auto mb-4 opacity-50" />
          <p className="text-lg">No transactions recorded yet</p>
          <p className="text-sm">Transactions will appear here after guest check-ins and check-outs</p>
        </div>
      )}

      {/* Transaction table */}
      {transactions.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-3 px-4 text-white/70 font-medium text-sm">Date</th>
                <th className="text-left py-3 px-4 text-white/70 font-medium text-sm">Guest Name</th>
                <th className="text-left py-3 px-4 text-white/70 font-medium text-sm">NIC</th>
                <th className="text-left py-3 px-4 text-white/70 font-medium text-sm">Room</th>
                <th className="text-right py-3 px-4 text-white/70 font-medium text-sm">Amount</th>
                <th className="text-center py-3 px-4 text-white/70 font-medium text-sm">Method</th>
                <th className="text-center py-3 px-4 text-white/70 font-medium text-sm">Type</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr 
                  key={tx.transactionId}
                  className="border-b border-white/5 hover:bg-white/5 transition-colors"
                >
                  {/* Date */}
                  <td className="py-4 px-4 text-white/80 text-sm">
                    {formatDate(tx.date)}
                  </td>
                  
                  {/* Guest Name */}
                  <td className="py-4 px-4 text-white font-medium">
                    {tx.guestName}
                  </td>
                  
                  {/* NIC */}
                  <td className="py-4 px-4 text-white/70 text-sm font-mono">
                    {tx.guestNic}
                  </td>
                  
                  {/* Room */}
                  <td className="py-4 px-4">
                    <span className="inline-flex items-center justify-center w-10 h-10 
                                     bg-white/10 rounded-lg text-white font-bold">
                      {tx.roomNumber}
                    </span>
                  </td>
                  
                  {/* Amount - right aligned with tabular-nums */}
                  <td className="py-4 px-4 text-right tabular-nums text-green-300 font-semibold">
                    LKR {tx.amount.toLocaleString()}
                  </td>
                  
                  {/* Payment Method */}
                  <td className="py-4 px-4 text-center">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 
                                     bg-white/10 rounded-full text-white/80 text-sm">
                      {tx.method === 'Cash' ? (
                        <Banknote size={14} className="text-green-300" />
                      ) : (
                        <CreditCard size={14} className="text-blue-300" />
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
      {transactions.length > 0 && (
        <div className="mt-6 pt-4 border-t border-white/10 flex justify-between items-center">
          <span className="text-white/60 text-sm">
            Showing all {transactions.length} transactions
          </span>
          <div className="text-right">
            <span className="text-white/60 text-sm">Total Collected: </span>
            <span className="text-green-300 font-bold tabular-nums text-lg">
              LKR {transactions.reduce((sum, tx) => sum + tx.amount, 0).toLocaleString()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
