
'use client';
import { useState } from 'react';

export default function PasswordGate({ children }: { children: React.ReactNode }) {
  const [show, setShow] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.sessionStorage.getItem('residence_access') === 'true';
    }
    return false;
  });
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input === 'residence777') {
      setShow(true);
      window.sessionStorage.setItem('residence_access', 'true');
    } else {
      setError('Incorrect password');
    }
  };

  if (!show) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-xs flex flex-col items-center space-y-4 border border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Enter Password</h2>
          <input
            type="password"
            value={input}
            onChange={e => { setInput(e.target.value); setError(''); }}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all bg-white"
            placeholder="Password"
            autoFocus
          />
          {error && <div className="text-red-600 text-xs font-medium">{error}</div>}
          <button type="submit" className="w-full btn-primary">Access</button>
        </form>
      </div>
    );
  }
  return <>{children}</>;
}
