'use client';

import { useState, useSyncExternalStore } from 'react';
import { Lock, ArrowRight, DollarSign } from 'lucide-react';

// Helper to read session storage safely (returns null during SSR)
function getSessionAuth(): boolean | null {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage.getItem('accounting_access') === 'true';
}

// Subscribe function for useSyncExternalStore (session storage doesn't emit events, so no-op)
function subscribe(): () => void {
  // Session storage doesn't have a native change event within the same tab
  // We just need to read the initial value, so this is a no-op
  return () => {};
}

export default function AccountingPasswordGate({ children }: { children: React.ReactNode }) {
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
    
    const trimmedInput = input.trim();
    console.log('Password check:', {
      input,
      trimmedInput,
      expected: 'accounting333',
      match: trimmedInput === 'accounting333',
      inputLength: input.length,
      trimmedLength: trimmedInput.length
    });
    
    if (trimmedInput === 'accounting333') {
      console.log('Password correct! Setting session storage');
      window.sessionStorage.setItem('accounting_access', 'true');
      setAuthState(true);
    } else {
      console.log('Password incorrect');
      setError(`Incorrect password. You entered: "${input}" (length: ${input.length}), expected: "accounting333"`);
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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="relative w-full max-w-sm mx-4">
          {/* Logo/Brand */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl shadow-lg mb-4">
              <DollarSign className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-semibold text-gray-900">Royal Residence</h1>
            <p className="text-sm text-gray-500 mt-1">Owner's Accounting Portal</p>
          </div>
          
          {/* Login Card */}
          <form 
            onSubmit={handleSubmit} 
            className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8"
          >
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Accounting Access Password
                </label>
                <input
                  type="password"
                  value={input}
                  onChange={e => { setInput(e.target.value); setError(''); }}
                  className={`w-full px-4 py-3 rounded-lg border ${error ? 'border-rose-300 focus:border-rose-500' : 'border-gray-300 focus:border-blue-500'} focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all duration-200`}
                  placeholder="Enter accounting password"
                  autoFocus
                  disabled={isLoading}
                />
                {error && (
                  <p className="text-rose-600 text-sm mt-2 flex items-center gap-1">
                    <span className="w-1 h-1 bg-rose-500 rounded-full" />
                    {error}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-2">
                  Hint: The password is <code className="bg-gray-100 px-1 py-0.5 rounded">accounting333</code>
                </p>
              </div>
              
              <button 
                type="submit" 
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLoading || !input}
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    Access Accounting
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
              
              <div className="pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    window.sessionStorage.removeItem('accounting_access');
                    setAuthState(false);
                    setInput('');
                    setError('');
                  }}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Clear session and try again
                </button>
              </div>
            </div>
          </form>
          
          {/* Footer */}
          <p className="text-center text-xs text-gray-400 mt-6">
            Owner-only access. Financial data protected.
          </p>
        </div>
      </div>
    );
  }
  
  return <>{children}</>;
}
