'use client';

import { useState, useSyncExternalStore } from 'react';
import { Lock, ArrowRight } from 'lucide-react';

// Helper to read session storage safely (returns null during SSR)
function getSessionAuth(): boolean | null {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage.getItem('residence_access') === 'true';
}

// Subscribe function for useSyncExternalStore (session storage doesn't emit events, so no-op)
function subscribe(): () => void {
  // Session storage doesn't have a native change event within the same tab
  // We just need to read the initial value, so this is a no-op
  return () => {};
}

export default function PasswordGate({ children }: { children: React.ReactNode }) {
  const initialAuth = useSyncExternalStore(
    subscribe,
    getSessionAuth,
    () => null // Server snapshot
  );
  const [authState, setAuthState] = useState<boolean | null>(null);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Use authState if set (after login), otherwise use initialAuth from session storage
  const isAuthenticated = authState !== null ? authState : initialAuth;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    await new Promise(resolve => setTimeout(resolve, 300));
    
    if (input === 'residence777') {
      window.sessionStorage.setItem('residence_access', 'true');
      setAuthState(true);
    } else {
      setError('Incorrect password');
      setIsLoading(false);
    }
  };

  // Show loading while checking auth status (prevents hydration mismatch)
  if (isAuthenticated === null) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="relative w-full max-w-sm mx-4">
          {/* Logo/Brand */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-900 rounded-2xl shadow-lg mb-4">
              <Lock className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-semibold text-gray-900">Royal Residence</h1>
            <p className="text-sm text-gray-500 mt-1">Staff Access Portal</p>
          </div>
          
          {/* Login Card */}
          <form 
            onSubmit={handleSubmit} 
            className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8"
          >
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Access Password
                </label>
                <input
                  type="password"
                  value={input}
                  onChange={e => { setInput(e.target.value); setError(''); }}
                  className={`w-full ${error ? 'border-rose-300 focus:border-rose-500' : ''}`}
                  placeholder="Enter your password"
                  autoFocus
                  disabled={isLoading}
                />
                {error && (
                  <p className="text-rose-600 text-sm mt-2 flex items-center gap-1">
                    <span className="w-1 h-1 bg-rose-500 rounded-full" />
                    {error}
                  </p>
                )}
              </div>
              
              <button 
                type="submit" 
                className="btn-primary w-full"
                disabled={isLoading || !input}
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    Access Dashboard
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </div>
          </form>
          
          {/* Footer */}
          <p className="text-center text-xs text-gray-400 mt-6">
            Protected area. Authorized personnel only.
          </p>
        </div>
      </div>
    );
  }
  
  return <>{children}</>;
}
