import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import logo from '../assets/logo.jpg';
import { supabase } from '../utils/supabase';
import { API_BASE_URL } from '../utils/api';

export const CreateAccount = () => {
  const navigate = useNavigate();

  // Form states (Online Customer only)
  const [fullname, setFullname] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  // UI states
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!fullname || !username || !email || !password || !confirmPassword) {
      setErrorMessage('Please fill in all required fields.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    if (!termsAccepted) {
      setErrorMessage('You must agree to the Terms and Conditions to proceed.');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Create User in Supabase Auth Provider
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
      });

      if (authError) {
        throw new Error(authError.message);
      }

      const supabaseUserId = authData.user?.id;

      // 2. Register profile in PostgreSQL Express Backend as 'customer'
      try {
        await fetch(`${API_BASE_URL}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            supabaseUserId,
            fullname: fullname.trim(),
            username: username.trim(),
            email: email.trim(),
            role: 'customer',
          }),
        });
      } catch (backendErr) {
        console.warn('Backend API profile sync note:', backendErr);
      }

      setSuccessMessage('Account created successfully as Online Customer! Redirecting to ordering...');
      setTimeout(() => {
        navigate('/customer');
      }, 1400);

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed. Please try again.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="font-sans min-h-screen bg-[#faf9f6] flex flex-col">
      {/* Navbar */}
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

      {/* Main Auth Container */}
      <div className="flex-1 flex justify-center items-center py-10 px-4">
        <div className="bg-white w-full max-w-[440px] rounded-2xl shadow-2xs border border-neutral-200/80 p-8 sm:p-10 transition-all text-center">
          
          {/* Top Title */}
          <h1 className="text-[1.6rem] font-bold text-[#2d3748] mt-0 mb-[0.2rem]">
            Create Account
          </h1>
          <p className="text-[0.88rem] font-semibold text-[#a0aec0] mt-0 mb-6">
            Eat!Yummy Foods, SeaFudz ng bayan.
          </p>

          {/* Brand Logo - Circular */}
          <div className="text-center mb-6">
            <img 
              src={logo} 
              alt="Seafudz Ng Bayan Logo" 
              className="w-40 h-40 sm:w-44 sm:h-44 object-cover rounded-full mx-auto drop-shadow-md mb-2.5" 
            />
            <p className="text-xs text-neutral-400 font-medium tracking-tight">Owned by cousins Gelyn Basilio-Alday and Joemarie Gobangco</p>
          </div>

          {/* Alerts */}
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

          {/* Form - Online Customer Only */}
          <form onSubmit={handleRegister} className="text-left space-y-4">
            
            {/* 1. Fullname */}
            <div>
              <label className="flex items-center gap-1.5 text-[0.9rem] font-bold text-[#4a5568] mb-1.5">
                <svg className="w-4 h-4 text-[#e74c3c]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <span>Fullname</span>
              </label>
              <input
                type="text"
                placeholder="Enter fullname"
                required
                value={fullname}
                onChange={(e) => setFullname(e.target.value)}
                className="w-full py-[0.9rem] px-[1.2rem] rounded-[12px] border border-[#e2e8f0] font-sans text-[0.95rem] font-medium text-[#2d3748] transition-all duration-[0.25s] box-border bg-[#f7fafc] focus:outline-none focus:border-[#e74c3c] focus:bg-white focus:shadow-[0_0_0_4px_rgba(231,76,60,0.1)]"
              />
            </div>

            {/* 2. Username */}
            <div>
              <label className="flex items-center gap-1.5 text-[0.9rem] font-bold text-[#4a5568] mb-1.5">
                <svg className="w-4 h-4 text-[#e74c3c]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <span>Username</span>
              </label>
              <input
                type="text"
                placeholder="Choose username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full py-[0.9rem] px-[1.2rem] rounded-[12px] border border-[#e2e8f0] font-sans text-[0.95rem] font-medium text-[#2d3748] transition-all duration-[0.25s] box-border bg-[#f7fafc] focus:outline-none focus:border-[#e74c3c] focus:bg-white focus:shadow-[0_0_0_4px_rgba(231,76,60,0.1)]"
              />
            </div>

            {/* 3. Email */}
            <div>
              <label className="flex items-center gap-1.5 text-[0.9rem] font-bold text-[#4a5568] mb-1.5">
                <svg className="w-4 h-4 text-[#e74c3c]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
                <span>Email</span>
              </label>
              <input
                type="email"
                placeholder="Enter your email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full py-[0.9rem] px-[1.2rem] rounded-[12px] border border-[#e2e8f0] font-sans text-[0.95rem] font-medium text-[#2d3748] transition-all duration-[0.25s] box-border bg-[#f7fafc] focus:outline-none focus:border-[#e74c3c] focus:bg-white focus:shadow-[0_0_0_4px_rgba(231,76,60,0.1)]"
              />
            </div>

            {/* 4. Password */}
            <div>
              <label className="flex items-center gap-1.5 text-[0.9rem] font-bold text-[#4a5568] mb-1.5">
                <svg className="w-4 h-4 text-[#e74c3c]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span>Password</span>
              </label>
              <input
                type="password"
                placeholder="Enter a password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full py-[0.9rem] px-[1.2rem] rounded-[12px] border border-[#e2e8f0] font-sans text-[0.95rem] font-medium text-[#2d3748] transition-all duration-[0.25s] box-border bg-[#f7fafc] focus:outline-none focus:border-[#e74c3c] focus:bg-white focus:shadow-[0_0_0_4px_rgba(231,76,60,0.1)]"
              />
            </div>

            {/* 5. Confirm Password */}
            <div>
              <label className="flex items-center gap-1.5 text-[0.9rem] font-bold text-[#4a5568] mb-1.5">
                <svg className="w-4 h-4 text-[#e74c3c]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span>Confirm password</span>
              </label>
              <input
                type="password"
                placeholder="Confirm your password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full py-[0.9rem] px-[1.2rem] rounded-[12px] border border-[#e2e8f0] font-sans text-[0.95rem] font-medium text-[#2d3748] transition-all duration-[0.25s] box-border bg-[#f7fafc] focus:outline-none focus:border-[#e74c3c] focus:bg-white focus:shadow-[0_0_0_4px_rgba(231,76,60,0.1)]"
              />
            </div>

            {/* Terms and Conditions Checkbox */}
            <div className="pt-1">
              <label className="flex items-center gap-2 text-[0.88rem] font-medium text-[#4a5568] cursor-pointer">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="w-4 h-4 rounded accent-[#e74c3c] cursor-pointer"
                />
                <span>I agree to the Terms and Conditions</span>
              </label>
            </div>

            {/* Orange Gradient Primary Action Button matching Login */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full p-[1rem] bg-gradient-to-r from-[#e74c3c] to-[#d35400] text-white border-none rounded-[12px] font-bold text-[1rem] font-sans cursor-pointer shadow-[0_6px_20px_rgba(231,76,60,0.2)] transition-all duration-300 hover:translate-y-[-2px] hover:shadow-[0_10px_25px_rgba(231,76,60,0.35)] tracking-[0.5px] disabled:opacity-50"
              >
                {isLoading ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT'}
              </button>
            </div>
          </form>

          {/* Bottom Login Link */}
          <p className="text-center text-[0.9rem] text-[#718096] mt-6 mb-0">
            Already have an Account?{' '}
            <Link to="/login" className="text-[#e74c3c] font-bold cursor-pointer transition-all hover:text-[#c0392b] hover:underline">
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default CreateAccount;

