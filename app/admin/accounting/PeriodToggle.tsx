// app/admin/accounting/PeriodToggle.tsx
// Segmented control that scopes the accounting dashboard stats:
// All Time (default) / Monthly / Annual.
//
// Styling mirrors src/modules/receptionist/components/ViewToggle.tsx so both
// dashboards feel like the same product.

'use client';

import type { ElementType } from 'react';
import { Layers, CalendarDays, CalendarRange } from 'lucide-react';

export type AccountingPeriod = 'all' | 'month' | 'year';

interface PeriodToggleProps {
  period: AccountingPeriod;
  onPeriodChange: (period: AccountingPeriod) => void;
  /** Shows a small "Updating" spinner next to the options while refetching. */
  busy?: boolean;
}

const OPTIONS: { value: AccountingPeriod; label: string; icon: ElementType }[] = [
  { value: 'all', label: 'All Time', icon: Layers },
  { value: 'month', label: 'Monthly', icon: CalendarDays },
  { value: 'year', label: 'Annual', icon: CalendarRange },
];

export default function PeriodToggle({ period, onPeriodChange, busy = false }: PeriodToggleProps) {
  return (
    <div
      role="group"
      aria-label="Statistics period"
      className="flex items-center gap-1 bg-white/80 backdrop-blur-xl border border-slate-200 rounded-xl p-1 shadow-sm"
    >
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const active = period === option.value;

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onPeriodChange(option.value)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              active ? 'bg-emerald-50 text-emerald-700 shadow-sm' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Icon size={16} />
            <span>{option.label}</span>
          </button>
        );
      })}

      {busy && (
        <span className="flex items-center gap-2 px-3 text-xs font-medium uppercase tracking-wide text-slate-400">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-500" />
          Updating
        </span>
      )}
    </div>
  );
}
