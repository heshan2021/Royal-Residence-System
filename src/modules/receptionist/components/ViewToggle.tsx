'use client';

import { LayoutDashboard, Calendar } from 'lucide-react';

interface ViewToggleProps {
  view: 'dashboard' | 'calendar';
  onViewChange: (view: 'dashboard' | 'calendar') => void;
}

export default function ViewToggle({ view, onViewChange }: ViewToggleProps) {
  return (
    <div className="flex items-center gap-2 bg-white/80 backdrop-blur-xl border border-slate-200 rounded-xl p-1 shadow-sm">
      <button
        onClick={() => onViewChange('dashboard')}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all duration-200 ${
          view === 'dashboard'
            ? 'bg-emerald-50 text-emerald-700 shadow-sm'
            : 'text-slate-600 hover:bg-slate-50'
        }`}
      >
        <LayoutDashboard size={18} />
        <span className="text-sm font-medium">Today's Dashboard</span>
      </button>
      <button
        onClick={() => onViewChange('calendar')}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all duration-200 ${
          view === 'calendar'
            ? 'bg-emerald-50 text-emerald-700 shadow-sm'
            : 'text-slate-600 hover:bg-slate-50'
        }`}
      >
        <Calendar size={18} />
        <span className="text-sm font-medium">Calendar View</span>
      </button>
    </div>
  );
}