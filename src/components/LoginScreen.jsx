import React, { useState } from 'react';
import { UserPlus, Mail, Lock, Loader2 } from './icons';

import { API_URL } from '../config.js';

const LoginScreen = ({ onLogin }) => {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const loginTrimmed = login.trim();
    if (!loginTrimmed) {
      setError('Please enter your username or email');
      return;
    }
    if (!password) {
      setError('Please enter your password');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/auth/dashboard-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: loginTrimmed, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }
      onLogin({ user: data.user, token: data.token });
    } catch (err) {
      setError('Cannot connect to server. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-100">
      {/* Header */}
      <header className="flex-shrink-0 bg-primary-600 text-white">
        <div className="flex items-center gap-2.5 px-4 py-3.5">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-white/15">
            <UserPlus className="w-5 h-5" strokeWidth={2} />
          </div>
          <span className="font-semibold text-[15px] tracking-tight">Prospect Manager</span>
        </div>
      </header>

      {/* Login form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="ext-card ext-card-body p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-1">Sign in</h2>
            <p className="text-sm text-slate-500 mb-6">Use your username or email and password</p>

            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Username or email <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Username or you@company.com"
                    value={login}
                    onChange={(e) => { setLogin(e.target.value); setError(null); }}
                    className="w-full rounded-lg border border-slate-200 bg-white py-3 px-4 pr-10 text-sm text-slate-800 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 transition-colors"
                    autoComplete="username"
                    autoFocus
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" strokeWidth={2} />
                  </span>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(null); }}
                    className="w-full rounded-lg border border-slate-200 bg-white py-3 px-4 pr-10 text-sm text-slate-800 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 transition-colors"
                    autoComplete="current-password"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" strokeWidth={2} />
                  </span>
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-600 mb-4">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-primary-600 py-3 px-4 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-70 transition-colors inline-flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} />
                    Signing in…
                  </>
                ) : (
                  'Sign in'
                )}
              </button>
            </form>

            <p className="text-xs text-slate-400 text-center mt-5">
              Contact your admin if you don't have an account
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
