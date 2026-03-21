'use client';

import { useState } from 'react';
import { Lock, ArrowRight } from 'lucide-react';

export default function PasswordGate({ children }: { children: React.ReactNode }) {
  const [show, setShow] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.sessionStorage.getItem('residence_access') === 'true';
    }
    return false;
  });
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Small delay for UX
    await new Promise(resolve => setTimeout(resolve, 300));
    
    if (input === 'residence777') {
      setShow(true);
      window.sessionStorage.setItem('residence_access', 'true');
    } else {
      setError('Incorrect password');
      setIsLoading(false);
    }
  };

  if (!show) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
        
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
