import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import BrandLogo from '../components/BrandLogo';
import { API_BASE_URL } from '../utils/api';

export const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const token = searchParams.get('token') || '';
  const email = searchParams.get('email') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!token || !email) {
      setErrorMessage('Invalid or expired reset link. Please request a new password reset link.');
      return;
    }

    if (!newPassword || !confirmPassword) {
      setErrorMessage('Please fill in both password fields.');
      return;
    }

    if (newPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please verify your entries.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          token,
          newPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to update password. Link may be expired.');
      }

      setSuccessMessage('Password reset successfully! Redirecting to login page...');

      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 2000);

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Password reset failed. Please try again.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="font-sans min-h-screen bg-[#faf9f6] flex flex-col justify-center items-center py-12 px-6">
      
      {/* Top Navbar Back Link */}
      <div className="absolute top-6 left-6 sm:left-10">
        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-600 hover:text-orange-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          <span>Back to Sign In</span>
        </Link>
      </div>

      {/* Main Container */}
      <div className="bg-white w-full max-w-[440px] rounded-3xl shadow-xl border border-neutral-200/80 p-8 sm:p-10 text-center animate-[fadeIn_0.3s_ease-out]">
        
        {/* Brand Logo */}
        <div className="mb-6 flex flex-col items-center">
          <BrandLogo size="md" subtitle="SEAFOOD & BILAO FEASTS" />
        </div>

        <h2 className="text-2xl font-bold text-neutral-900 mb-1">
          Set New Password
        </h2>

        <p className="text-xs text-neutral-500 mb-6">
          Create a new password for <strong className="text-neutral-800 font-semibold">{email || 'your account'}</strong>
        </p>

        {(!token || !email) && !errorMessage && (
          <div className="py-3 px-4 rounded-xl text-xs font-semibold mb-6 bg-amber-50 text-amber-900 border border-amber-200 text-left">
            ⚠️ Invalid password reset URL. Please request a new reset link from the login page.
          </div>
        )}

        {errorMessage && (
          <div className="py-3 px-4 rounded-xl text-xs font-semibold mb-6 bg-red-50 text-red-600 border border-red-200 text-left animate-[fadeIn_0.2s_ease-out]">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="py-3 px-4 rounded-xl text-xs font-semibold mb-6 bg-emerald-50 text-emerald-700 border border-emerald-200 text-left animate-[fadeIn_0.2s_ease-out]">
            {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="text-left space-y-4">
          
          {/* New Password */}
          <div>
            <label className="block text-xs font-bold text-neutral-600 uppercase tracking-wider mb-1.5">
              New Password
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                placeholder="Minimum 6 characters"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full py-3.5 pl-4 pr-11 rounded-xl border border-neutral-200 font-medium text-sm text-neutral-900 bg-neutral-50/80 focus:outline-none focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-500/10 transition-all box-border"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 p-1 transition-colors"
                aria-label="Toggle new password visibility"
              >
                {showNewPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908a10.03 10.03 0 013.122-.563c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m-6.165-4.131a3 3 0 11-4.243-4.243M3 3l18 18" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-xs font-bold text-neutral-600 uppercase tracking-wider mb-1.5">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Re-enter new password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full py-3.5 pl-4 pr-11 rounded-xl border border-neutral-200 font-medium text-sm text-neutral-900 bg-neutral-50/80 focus:outline-none focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-500/10 transition-all box-border"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 p-1 transition-colors"
                aria-label="Toggle confirm password visibility"
              >
                {showConfirmPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908a10.03 10.03 0 013.122-.563c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m-6.165-4.131a3 3 0 11-4.243-4.243M3 3l18 18" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || !token || !email}
            className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold text-sm rounded-xl shadow-md transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer pt-3 mt-4"
          >
            {isLoading ? 'UPDATING PASSWORD...' : 'UPDATE PASSWORD'}
          </button>

        </form>

      </div>
    </div>
  );
};

export default ResetPassword;
