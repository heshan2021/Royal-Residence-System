// app/admin/accounting/page.tsx
// Owner's Accounting Overview Page
// Glassmorphic design with monthly sales analytics

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DollarSign, TrendingUp, Calendar, Clock, AlertCircle, BarChart3, CreditCard, Banknote } from 'lucide-react';
import TransactionLedger from '../../../src/modules/receptionist/components/TransactionLedger';
import AccountingPasswordGate from '../../AccountingPasswordGate';

// Types for accounting stats
interface MonthlySalesItem {
  month: string;
  total: number;
}

interface PaymentMethodSplit {
  cash: number;
  bank: number;
}

interface AccountingStats {
  totalRevenue: number;
  todayCollection: number;
  pendingBalance: number;
  paymentMethodSplit: PaymentMethodSplit;
  monthlySalesData: MonthlySalesItem[];
  revenueGrowth: number;
  currentMonthTotal: number;
  lastMonthTotal: number;
}

// Metric Card Component
function MetricCard({ title, value, icon: Icon, color = 'slate' }: {
  title: string;
  value: string;
  icon: React.ElementType;
  color?: 'slate' | 'emerald' | 'rose' | 'blue';
}) {
  const colorClasses = {
    slate: 'bg-slate-50 text-slate-500',
    emerald: 'bg-emerald-50 text-emerald-500',
    rose: 'bg-rose-50 text-rose-500',
    blue: 'bg-blue-50 text-blue-500',
  };

  return (
    <div className="bg-white/80 backdrop-blur-xl border border-slate-200 rounded-2xl p-8 flex items-center justify-between shadow-sm hover:shadow-md transition-all duration-300">
      <div>
        <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-3">{title}</p>
        <p className="text-4xl font-bold text-slate-800 tabular-nums leading-none">{value}</p>
      </div>
      <div className={`p-4 rounded-2xl ${colorClasses[color]}`}>
        <Icon className="w-8 h-8" />
      </div>
    </div>
  );
}

// Payment Method Progress Bar
function PaymentMethodBar({ cash, bank }: { cash: number; bank: number }) {
  const total = cash + bank;
  const cashPercentage = total > 0 ? (cash / total) * 100 : 0;
  const bankPercentage = total > 0 ? (bank / total) * 100 : 0;

  return (
    <div className="bg-white/80 backdrop-blur-xl border border-slate-200 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-800">Payment Method Split</h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
            <span className="text-sm text-slate-600">Cash: {cash} ({cashPercentage.toFixed(0)}%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span className="text-sm text-slate-600">Bank: {bank} ({bankPercentage.toFixed(0)}%)</span>
          </div>
        </div>
      </div>
      <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full flex">
          <div 
            className="bg-emerald-500 transition-all duration-500"
            style={{ width: `${cashPercentage}%` }}
          ></div>
          <div 
            className="bg-blue-500 transition-all duration-500"
            style={{ width: `${bankPercentage}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
}

// Monthly Sales Bar Chart
function MonthlySalesChart({ data }: { data: MonthlySalesItem[] }) {
  const maxValue = Math.max(...data.map(item => item.total));
  
  return (
    <div className="bg-white/80 backdrop-blur-xl border border-slate-200 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-slate-800">Monthly Sales Trend</h3>
        <BarChart3 className="w-5 h-5 text-slate-400" />
      </div>
      <div className="flex items-end justify-between h-48">
        {data.map((item, index) => {
          const height = maxValue > 0 ? (item.total / maxValue) * 100 : 0;
          const isCurrentMonth = index === new Date().getMonth();
          
          return (
            <div key={item.month} className="flex flex-col items-center flex-1">
              <div className="text-xs text-slate-500 mb-2">{item.month}</div>
              <div className="relative w-8">
                <div 
                  className={`w-full rounded-t-lg transition-all duration-500 ${
                    isCurrentMonth ? 'bg-blue-500' : 'bg-slate-300'
                  }`}
                  style={{ height: `${height}%` }}
                ></div>
                {item.total > 0 && (
                  <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 text-xs font-medium text-slate-700 bg-white px-2 py-1 rounded shadow-sm border border-slate-200">
                    LKR {item.total.toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AccountingOverviewContent() {
  const [stats, setStats] = useState<AccountingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterMethod, setFilterMethod] = useState<'all' | 'Cash' | 'Bank'>('all');

  const fetchStats = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch('/api/admin/accounting-stats');
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load accounting stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleRefresh = () => {
    setLoading(true);
    fetchStats();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-900 mx-auto"></div>
          <p className="mt-4 text-sm font-medium text-slate-500 uppercase tracking-wide">Loading Accounting Overview...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-slate-50 flex justify-center">
      <main className="w-full max-w-[1400px] px-10 sm:px-14 lg:px-20 py-12">
        
        {/* Header */}
        <header className="mb-12 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Royal Residence</h1>
            <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mt-1">Owner's Accounting Overview</p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 
                       border border-slate-200 rounded-lg text-slate-700 transition-all duration-200
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Clock size={18} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </header>

        {/* Error state */}
        {error && (
          <div className="flex items-center gap-3 p-4 mb-6 bg-red-500/20 border border-red-400/30 rounded-xl">
            <AlertCircle size={20} className="text-red-300" />
            <span className="text-red-200">{error}</span>
          </div>
        )}

        {/* Top Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <MetricCard
            title="Total Revenue"
            value={`LKR ${stats?.totalRevenue.toLocaleString() || '0'}`}
            icon={DollarSign}
            color="blue"
          />
          <MetricCard
            title="Today's Collection"
            value={`LKR ${stats?.todayCollection.toLocaleString() || '0'}`}
            icon={Calendar}
            color="emerald"
          />
          <MetricCard
            title="Pending Balance"
            value={`LKR ${stats?.pendingBalance.toLocaleString() || '0'}`}
            icon={AlertCircle}
            color="rose"
          />
        </div>

        {/* Payment Method Split */}
        <div className="mb-8">
          <PaymentMethodBar 
            cash={stats?.paymentMethodSplit.cash || 0}
            bank={stats?.paymentMethodSplit.bank || 0}
          />
        </div>

        {/* Monthly Sales Analytics */}
        <div className="mb-12">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
            {/* Monthly Summary */}
            <div className="bg-white/80 backdrop-blur-xl border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-800">Monthly Summary</h3>
                <TrendingUp className="w-5 h-5 text-slate-400" />
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Total Sales This Month</p>
                  <p className="text-2xl font-bold text-slate-800">
                    LKR {stats?.currentMonthTotal.toLocaleString() || '0'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Revenue Growth</p>
                  <div className="flex items-center gap-2">
                    <span className={`text-xl font-bold ${
                      (stats?.revenueGrowth || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}>
                      {stats?.revenueGrowth || 0 >= 0 ? '+' : ''}{stats?.revenueGrowth || 0}%
                    </span>
                    <TrendingUp className={`w-5 h-5 ${
                      (stats?.revenueGrowth || 0) >= 0 ? 'text-emerald-500' : 'text-rose-500 rotate-180'
                    }`} />
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    vs Last Month: LKR {stats?.lastMonthTotal.toLocaleString() || '0'}
                  </p>
                </div>
              </div>
            </div>

            {/* Monthly Sales Chart */}
            <div className="lg:col-span-2">
              <MonthlySalesChart data={stats?.monthlySalesData || []} />
            </div>
          </div>
        </div>

        {/* Transaction Ledger with Filters */}
        <div className="bg-white/80 backdrop-blur-xl border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Transaction Ledger</h3>
              <p className="text-sm text-slate-500">Complete financial transaction history</p>
            </div>
            
            <div className="flex flex-wrap gap-4">
              {/* Date Filter */}
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 bg-white"
                />
              </div>
              
              {/* Payment Method Filter */}
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-slate-400" />
                <select
                  value={filterMethod}
                  onChange={(e) => setFilterMethod(e.target.value as 'all' | 'Cash' | 'Bank')}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 bg-white"
                >
                  <option value="all">All Methods</option>
                  <option value="Cash">Cash Only</option>
                  <option value="Bank">Bank Only</option>
                </select>
              </div>
            </div>
          </div>

          {/* Transaction Ledger Component */}
          <TransactionLedger 
            filterDate={filterDate}
            filterMethod={filterMethod}
            variant="light"
          />
        </div>
      </main>
    </div>
  );
}

export default function AccountingOverview() {
  return (
    <AccountingPasswordGate>
      <AccountingOverviewContent />
    </AccountingPasswordGate>
  );
}
