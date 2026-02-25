import React, { useState } from 'react';
import { useProspect } from '../context/ProspectContext';
import { ArrowLeft, Lock, Loader2 } from './icons';

export default function SettingsPage({ onBack }) {
  const { authUser, authToken, changePassword } = useProspect();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!currentPassword.trim()) {
      setError('Enter your current password');
      return;
    }
    if (!newPassword.trim()) {
      setError('Enter a new password');
      return;
    }
    if (newPassword.trim().length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match');
      return;
    }
    if (!authToken) {
      setError('Session expired. Please sign in again.');
      return;
    }
    setLoading(true);
    try {
      await changePassword(currentPassword, newPassword.trim());
      setSuccess('Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-800"
      >
        <ArrowLeft className="w-4 h-4" strokeWidth={2} />
        Back
      </button>

      <div className="ext-card ext-card-body">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary-100 text-primary-600">
            <Lock className="w-5 h-5" strokeWidth={2} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">Change password</h3>
            <p className="text-xs text-slate-500">
              {authUser?.username || authUser?.email || '—'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Current password <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => { setCurrentPassword(e.target.value); setError(null); }}
              placeholder="••••••••"
              className="w-full rounded-lg border border-slate-200 bg-white py-2.5 px-3 text-sm text-slate-800 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              New password <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); setError(null); }}
              placeholder="At least 6 characters"
              className="w-full rounded-lg border border-slate-200 bg-white py-2.5 px-3 text-sm text-slate-800 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Confirm new password <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setError(null); }}
              placeholder="••••••••"
              className="w-full rounded-lg border border-slate-200 bg-white py-2.5 px-3 text-sm text-slate-800 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              autoComplete="new-password"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          {success && (
            <p className="text-sm text-emerald-600">{success}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary-600 py-2.5 px-4 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-70 transition-colors inline-flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
                Updating…
              </>
            ) : (
              'Update password'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
