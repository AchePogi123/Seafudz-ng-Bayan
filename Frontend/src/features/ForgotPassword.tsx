import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import logo from '../assets/logo.jpg';
import { supabase } from '../utils/supabase';

export const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!email) {
      setErrorMessage('Please enter your email address.');
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/login`,
      });

      if (error) {
        throw error;
      }

      setSuccessMessage('Password reset link has been sent to your email!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send reset link. Please try again.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="font-sans min-h-screen bg-[#faf9f6] flex flex-col">
      {/* Navbar - Exactly identical to Login / Register / POS pages */}
      <nav className="flex justify-between items-center py-4 px-[4%] bg-white sticky top-0 z-50 border-b border-neutral-200/80 md:flex-row flex-col gap-4 md:gap-0 shadow-2xs">
        <div>
          <span className="text-xl font-bold text-neutral-900 tracking-tight">Seafudz Ng Bayan</span>
        </div>

        <div className="flex items-center gap-6">
          <Link to="/dashboard" className="text-neutral-600 hover:text-neutral-900 font-medium text-sm transition-colors">Dashboard</Link>
          <Link to="/about" className="text-neutral-600 hover:text-neutral-900 font-medium text-sm transition-colors">About Us</Link>
          <Link to="/pos" className="text-neutral-600 hover:text-neutral-900 font-medium text-sm transition-colors">Menu & POS</Link>
        </div>

        <Link to="/login" className="bg-orange-600 hover:bg-orange-700 text-white py-2 px-5 rounded-xl font-semibold text-sm transition-all shadow-2xs">Login / Register</Link>
      </nav>

      {/* Main Auth Container matching Login / Create Account */}
      <div className="flex-1 flex justify-center items-center py-12 px-6">
        <div className="bg-white w-full max-w-[480px] rounded-2xl shadow-2xs border border-neutral-200/80 p-8 sm:p-10 transition-all text-center">
          
          {/* Top Headline */}
          <h1 className="text-[1.6rem] font-bold text-[#2d3748] mt-0 mb-[0.2rem]">Reset Password</h1>
          <p className="text-[0.88rem] font-semibold text-[#a0aec0] mt-0 mb-6">No worries! We Got yahhh!!!</p>

          {/* Brand Logo - Enlarged circular logo matching design image */}
          <div className="text-center mb-8">
            <img 
              src={logo} 
              alt="Seafudz Ng Bayan Logo" 
              className="w-44 h-44 sm:w-48 sm:h-48 object-cover rounded-full mx-auto drop-shadow-md" 
            />
          </div>

          {/* Mail Icon Envelope with @ inside */}
          <div className="mb-4 text-[#e74c3c] flex justify-center">
            <div className="w-16 h-16 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center shadow-xs">
              <svg
                className="w-10 h-10 text-[#e74c3c]"
                viewBox="0 0 64 64"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="8" y="16" width="48" height="38" rx="3" stroke="currentColor" fill="none" />
                <path d="M8 20 L32 38 L56 20" stroke="currentColor" fill="none" />
                <path d="M8 50 L24 35" stroke="currentColor" />
                <path d="M56 50 L40 35" stroke="currentColor" />
                <text
                  x="32"
                  y="33"
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="16"
                  fontWeight="bold"
                  fill="currentColor"
                  stroke="none"
                  fontFamily="sans-serif"
                >
                  @
                </text>
              </svg>
            </div>
          </div>

          {/* Subheader */}
          <h2 className="text-[1.3rem] font-bold text-[#2d3748] mt-0 mb-[0.2rem]">Reset Password</h2>
          <p className="text-[0.9rem] text-[#718096] mt-0 mb-[1.5rem]">We send you link to reset your password.</p>

          {/* Error / Success Notifications */}
          {errorMessage && (
            <div className="py-[1rem] px-[1.2rem] rounded-[12px] text-[0.9rem] font-semibold mb-[1.5rem] leading-[1.4] animate-[fadeIn_0.3s_ease] bg-[#fff5f5] text-[#c53030] border border-[#fed7d7] text-left">
              {errorMessage}
            </div>
          )}
          {successMessage && (
            <div className="py-[1rem] px-[1.2rem] rounded-[12px] text-[0.9rem] font-semibold mb-[1.5rem] leading-[1.4] animate-[fadeIn_0.3s_ease] bg-[#f0fff4] text-[#22543d] border border-[#c6f6d5] text-left">
              {successMessage}
            </div>
          )}

          {/* Reset Password Form */}
          <form onSubmit={handleReset} className="text-left">
            <div className="mb-[1.2rem]">
              <label className="flex items-center gap-1.5 text-[0.9rem] font-bold text-[#4a5568] mb-[0.5rem]">
                <svg
                  className="w-4 h-4 text-[#e74c3c]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
                <span>Email Address</span>
              </label>
              <input
                type="email"
                placeholder="Enter your email address"
                required
                className="w-full py-[1rem] px-[1.2rem] rounded-[12px] border border-[#e2e8f0] font-sans text-[0.95rem] font-medium text-[#2d3748] transition-all duration-[0.25s] box-border bg-[#f7fafc] focus:outline-none focus:border-[#e74c3c] focus:bg-white focus:shadow-[0_0_0_4px_rgba(231,76,60,0.1)]"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {/* Orange Gradient Primary Action Button matching Login */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full p-[1rem] bg-gradient-to-r from-[#e74c3c] to-[#d35400] text-white border-none rounded-[12px] font-bold text-[1rem] font-sans cursor-pointer shadow-[0_6px_20px_rgba(231,76,60,0.2)] transition-all duration-300 hover:translate-y-[-2px] hover:shadow-[0_10px_25px_rgba(231,76,60,0.35)] mb-[1rem] tracking-[0.5px] disabled:opacity-50"
            >
              {isLoading ? 'SENDING RESET LINK...' : 'RESET ACCOUNT'}
            </button>
          </form>

          {/* Or Divider */}
          <p className="text-center text-[0.9rem] font-bold text-[#a0aec0] my-2">or</p>

          {/* Back to Login Button */}
          <Link
            to="/login"
            className="w-full p-[0.9rem] bg-white text-[#4a5568] border border-[#e2e8f0] rounded-[12px] font-bold text-[0.95rem] font-sans cursor-pointer transition-all duration-[0.25s] flex items-center justify-center mt-3 hover:bg-[#f7fafc] hover:border-[#cbd5e0] hover:text-[#e74c3c]"
          >
            BACK TO LOGIN
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
