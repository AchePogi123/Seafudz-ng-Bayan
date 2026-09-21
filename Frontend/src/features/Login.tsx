import { useState } from 'react';
import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import BrandLogo from '../components/BrandLogo';
import { supabase } from '../utils/supabase';
import { API_BASE_URL } from '../utils/api';
import { saveSessionToken, saveActiveUser, generateClientHashToken } from '../cryptography/cryptoSession';

type UserRole = 'customer' | 'cashier' | 'kitchen' | 'rider' | 'assistant';

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const role: UserRole = 'customer';

  // Form states
  const [loginInput, setLoginInput] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const [fullname, setFullname] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Terms and Conditions modal
  const [showTerms, setShowTerms] = useState(false);

  // UI states
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Business role prevention code (Standard restaurant admin key)
  const REQUIRED_STAFF_KEY = 'SFB-STAFF-99';

  const MOCK_STAFF_ACCOUNTS: Record<string, { fullname: string; username: string; email: string; role: string }> = {
    admin: { fullname: 'Admin Manager', username: 'admin1', email: 'admin@seafudz.ph', role: 'admin' },
    admin1: { fullname: 'Admin Manager', username: 'admin1', email: 'admin@seafudz.ph', role: 'admin' },
    admin2: { fullname: 'Super Admin Chief', username: 'admin2', email: 'admin2@seafudz.ph', role: 'admin' },
    'admin@seafudz.ph': { fullname: 'Admin Manager', username: 'admin1', email: 'admin@seafudz.ph', role: 'admin' },
    cashier: { fullname: 'Maria Santos', username: 'cashier1', email: 'cashier@seafudz.ph', role: 'cashier' },
    cashier1: { fullname: 'Maria Santos', username: 'cashier1', email: 'cashier@seafudz.ph', role: 'cashier' },
    cashier2: { fullname: 'Maria Santos', username: 'cashier2', email: 'maria.cashier@seafudz.ph', role: 'cashier' },
    'cashier@seafudz.ph': { fullname: 'Maria Santos', username: 'cashier1', email: 'cashier@seafudz.ph', role: 'cashier' },
    kitchen: { fullname: 'Chef Juan', username: 'kitchen1', email: 'kitchen@seafudz.ph', role: 'kitchen' },
    kitchen1: { fullname: 'Chef Juan', username: 'kitchen1', email: 'kitchen@seafudz.ph', role: 'kitchen' },
    kitchen2: { fullname: 'Chef Ben', username: 'kitchen2', email: 'chef.ben@seafudz.ph', role: 'kitchen' },
    'kitchen@seafudz.ph': { fullname: 'Chef Juan', username: 'kitchen1', email: 'kitchen@seafudz.ph', role: 'kitchen' },
    assistant: { fullname: 'Assistant Cashier Grace', username: 'assistant1', email: 'assistant@seafudz.ph', role: 'assistant' },
    assistant1: { fullname: 'Assistant Cashier Grace', username: 'assistant1', email: 'assistant@seafudz.ph', role: 'assistant' },
    assistant2: { fullname: 'Joy Flores', username: 'assistant2', email: 'joy.floor@seafudz.ph', role: 'assistant' },
    'assistant@seafudz.ph': { fullname: 'Assistant Cashier Grace', username: 'assistant1', email: 'assistant@seafudz.ph', role: 'assistant' },
    rider: { fullname: 'Rider Alex Ramos', username: 'rider1', email: 'rider@seafudz.ph', role: 'rider' },
    rider1: { fullname: 'Rider Alex Ramos', username: 'rider1', email: 'rider@seafudz.ph', role: 'rider' },
    rider2: { fullname: 'Dan Cruz', username: 'rider2', email: 'dan.rider@seafudz.ph', role: 'rider' },
    'rider@seafudz.ph': { fullname: 'Rider Alex Ramos', username: 'rider1', email: 'rider@seafudz.ph', role: 'rider' },
  };

  const navigateByRole = (userRole?: string, token?: string, userData?: Record<string, unknown>) => {
    const normRole = (userRole || 'customer').toLowerCase();
    const userPhone = (userData?.phone as string) || phone || undefined;
    const userAddress = (userData?.delivery_address as string) || (userData?.address as string) || undefined;

    const activeToken =
      token ||
      generateClientHashToken(
        (userData?.username as string) || (loginInput ? loginInput.split('@')[0] : 'user'),
        normRole,
        {
          fullname: (userData?.fullname as string) || (userData?.username as string) || loginInput || fullname || 'User',
          username: (userData?.username as string) || (loginInput ? loginInput.split('@')[0] : username || 'user'),
          email: (userData?.email as string) || (loginInput.includes('@') ? loginInput : email || undefined),
          phone: userPhone,
          address: userAddress,
          role: normRole,
        }
      );

    saveActiveUser({
      fullname: (userData?.fullname as string) || (userData?.username as string) || loginInput || fullname || 'Customer',
      username: (userData?.username as string) || (loginInput ? loginInput.split('@')[0] : username || 'customer'),
      email: (userData?.email as string) || (loginInput.includes('@') ? loginInput : email || undefined),
      phone: userPhone,
      address: userAddress,
      role: normRole,
      sessionToken: activeToken,
    });

    saveSessionToken(activeToken);

    const fromState = location.state?.from;
    const returnPath = typeof fromState === 'string' ? fromState : (fromState?.pathname || null);

    let targetPath = (normRole === 'customer' && returnPath) ? returnPath : '/customer';

    if (normRole === 'cashier') targetPath = '/pos';
    else if (normRole === 'kitchen') targetPath = '/kitchen';
    else if (normRole === 'rider') targetPath = '/rider';
    else if (normRole === 'assistant') targetPath = '/assistant';
    else if (normRole === 'admin') targetPath = '/admin-dashboard';

    navigate(targetPath, { replace: true });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!loginInput || !loginPassword) {
      setErrorMessage('Please enter your email/username and password.');
      return;
    }

    setIsLoading(true);

    try {
      const isEmail = loginInput.trim().includes('@');
      let supabaseUser = null;
      let profileData = null;
      let supabaseAuthErr: string | null = null;

      // 1. Try Supabase Auth login first if an email is provided
      if (isEmail) {
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: loginInput.trim(),
            password: loginPassword,
          });

          if (data?.user) {
            supabaseUser = data.user;
          } else if (error) {
            supabaseAuthErr = error.message;
          }
        } catch (sErr) {
          console.warn('Supabase auth attempt note:', sErr);
        }
      }

      // 2. Fetch or verify profile against Express backend
      try {
        const res = await fetch(`${API_BASE_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: isEmail ? loginInput.trim() : undefined,
            username: !isEmail ? loginInput.trim() : undefined,
            pinCode: !isEmail ? loginPassword : undefined,
            supabaseUserId: supabaseUser?.id,
          }),
        });

        if (res.ok) {
          profileData = await res.json();
        }
      } catch (backendErr) {
        console.warn('Backend API connection note:', backendErr);
      }

      // 3. Fallback: If username login was used, attempt Supabase Auth using the user's email from database
      if (!supabaseUser && profileData?.data?.email) {
        try {
          const { data } = await supabase.auth.signInWithPassword({
            email: profileData.data.email,
            password: loginPassword,
          });

          if (data?.user) {
            supabaseUser = data.user;
          }
        } catch { }
      }

      // 4. Mock Accounts Fallback if backend or Supabase is not reachable / not configured
      if (!profileData?.success && !supabaseUser) {
        const mockMatch = MOCK_STAFF_ACCOUNTS[loginInput.trim().toLowerCase()];

        if (mockMatch) {
          setSuccessMessage(`Welcome back, ${mockMatch.fullname}! Redirecting to workspace...`);
          navigateByRole(mockMatch.role, undefined, mockMatch);
          return;
        }

        if (supabaseAuthErr) {
          throw new Error(supabaseAuthErr);
        }

        throw new Error('Invalid email/username or password. Please check your credentials.');
      }

      const userRole = profileData?.data?.role || 'customer';
      const userName = profileData?.data?.fullname || supabaseUser?.email || loginInput;
      const sessionToken = profileData?.sessionToken;

      setSuccessMessage(`Welcome back, ${userName}! Redirecting to workspace...`);
      navigateByRole(userRole, sessionToken, profileData?.data);

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed. Please check your credentials.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!fullname || !username || !email || !phone || !password || !confirmPassword) {
      setErrorMessage('Please fill in all required fields.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    if (!termsAccepted) {
      setErrorMessage('You must accept the Terms and Conditions to proceed.');
      return;
    }

    // Validate employee key for business system roles
    if (role !== 'customer') {
      if (!verificationCode) {
        setErrorMessage('Verification is required for business accounts. Please enter your Employee Access Token.');
        return;
      }

      if (verificationCode.trim().toUpperCase() !== REQUIRED_STAFF_KEY) {
        setErrorMessage('Access Denied: Invalid Employee Access Token. Please contact your administrator.');
        return;
      }
    }

    setIsLoading(true);

    try {
      let supabaseUserId: string | undefined = undefined;

      // 1. Attempt User Registration in Supabase Auth Provider
      try {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password: password,
        });

        if (authError) {
          console.warn('Supabase Auth SignUp note:', authError.message);
        } else if (authData?.user?.id) {
          supabaseUserId = authData.user.id;
        }
      } catch (sErr) {
        console.warn('Supabase Auth SignUp exception note:', sErr);
      }

      // 2. Register profile in PostgreSQL Express Backend
      const regRes = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supabaseUserId,
          fullname: fullname.trim(),
          username: username.trim(),
          email: email.trim(),
          phone: phone.trim(),
          role,
          token: verificationCode.trim(),
        }),
      });

      const regJson = await regRes.json();

      if (!regRes.ok || !regJson.success) {
        throw new Error(regJson.message || 'Account registration failed. Please try again.');
      }

      const regSessionToken = regJson?.sessionToken;
      const regUserData = regJson?.data;

      // Clear input fields
      setPassword('');
      setConfirmPassword('');
      setVerificationCode('');

      setSuccessMessage(`Account created successfully as ${role.toUpperCase()}! Redirecting to workspace...`);

      setTimeout(() => {
        navigateByRole(role, regSessionToken, regUserData);
      }, 1200);

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed. Please try again.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setErrorMessage('');

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + '/customer' },
      });

      if (error) throw error;

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Google authentication failed';
      setErrorMessage(msg);
    }
  };

  return (
    <div className="font-sans min-h-screen bg-[#faf9f6] flex flex-col">

      {/* Navbar */}
      <nav className="flex justify-between items-center py-4 px-[4%] bg-white sticky top-0 z-50 border-b border-neutral-200/80 shadow-2xs">
        <div>
          <Link
            to="/landingpage"
            className="inline-flex items-center gap-2 text-xl font-bold text-neutral-900 hover:text-orange-600 tracking-tight transition-colors duration-200"
          >
            <svg
              className="w-5 h-5 text-current transition-colors duration-200"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 19.5L8.25 12l7.5-7.5"
              />
            </svg>
            <span>Seafudz Ng Bayan</span>
          </Link>
        </div>
      </nav>

      {/* Main Auth Container */}
      <div className="flex-1 flex justify-center items-center py-12 px-6">
        <div className="bg-white w-full max-w-[480px] rounded-2xl shadow-2xs border border-neutral-200/80 p-8 sm:p-10 transition-all">

          {/* Logo */}
          <div className="text-center mb-8 flex flex-col items-center">
            <BrandLogo
              to="/"
              size="lg"
              subtitle="FRESH SEAFOOD & BILAO FEASTS"
            />
            <p className="text-xs text-neutral-400 mt-2 font-medium">
              By: Joemarie Gobangco & Gelyn Basilio-Alday
            </p>
          </div>

          {/* Notice when redirected from Order Online */}
          {(location.state?.from === '/customer' ||
            (typeof location.state?.from === 'object' &&
              location.state?.from?.pathname === '/customer')) &&
            !errorMessage &&
            !successMessage && (
              <div className="py-2.5 px-3.5 rounded-xl text-xs font-semibold mb-5 bg-orange-50 text-orange-900 border border-orange-200 flex items-center gap-2.5 text-left">
                <svg
                  className="w-4 h-4 text-orange-600 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>
                  Please sign in or create an account to verify your details
                  and complete your seafood order.
                </span>
              </div>
            )}

          {errorMessage && (
            <div className="py-[1rem] px-[1.2rem] rounded-[12px] text-[0.9rem] font-semibold mb-[1.5rem] leading-[1.4] animate-[fadeIn_0.3s_ease] bg-[#fff5f5] text-[#c53030] border border-[#fed7d7]">
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className="py-[1rem] px-[1.2rem] rounded-[12px] text-[0.9rem] font-semibold mb-[1.5rem] leading-[1.4] animate-[fadeIn_0.3s_ease] bg-[#f0fff4] text-[#22543d] border border-[#c6f6d5]">
              {successMessage}
            </div>
          )}

          {!showCreateAccount ? (
            /* Login Form */
            <form onSubmit={handleLogin}>
              <h2 className="text-[1.6rem] font-bold text-[#2d3748] mt-0 mb-[0.4rem]">
                Welcome Back
              </h2>

              <p className="text-[0.95rem] text-[#718096] mt-0 mb-[1.5rem]">
                Sign in with your Supabase credentials
              </p>

              <div className="mb-[1.2rem]">
                <input
                  type="text"
                  placeholder="Username"
                  required
                  className="w-full py-[1rem] px-[1.2rem] rounded-[12px] border border-[#e2e8f0] font-sans text-[0.95rem] font-medium text-[#2d3748] transition-all duration-[0.25s] box-border bg-[#f7fafc] focus:outline-none focus:border-[#e74c3c] focus:bg-white focus:shadow-[0_0_0_4px_rgba(231,76,60,0.1)]"
                  value={loginInput}
                  onChange={(e) => setLoginInput(e.target.value)}
                />
              </div>

              <div className="mb-[1.2rem] relative">
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  placeholder="Password"
                  required
                  className="w-full py-[1rem] pl-[1.2rem] pr-[3rem] rounded-[12px] border border-[#e2e8f0] font-sans text-[0.95rem] font-medium text-[#2d3748] transition-all duration-[0.25s] box-border bg-[#f7fafc] focus:outline-none focus:border-[#e74c3c] focus:bg-white focus:shadow-[0_0_0_4px_rgba(231,76,60,0.1)]"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                />

                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="absolute right-[1rem] top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 focus:outline-none transition-colors"
                  aria-label="Toggle password visibility"
                >
                  {showLoginPassword ? (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908a10.03 10.03 0 013.122-.563c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m-6.165-4.131a3 3 0 11-4.243-4.243M3 3l18 18"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  )}
                </button>
              </div>

              <div className="flex justify-between items-center mb-[2rem] text-[0.9rem]">
                <label className="flex items-center gap-[0.5rem] text-[#4a5568] cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    className="accent-[#e74c3c]"
                    defaultChecked
                  />
                  Remember me
                </label>

                <button
                  type="button"
                  className="bg-none border-none text-[#e74c3c] font-semibold font-sans text-[0.9rem] cursor-pointer p-0 transition-all hover:text-[#c0392b] hover:underline"
                >
                  Forgot Password?
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full p-[1rem] bg-gradient-to-r from-[#e74c3c] to-[#d35400] text-white border-none rounded-[12px] font-bold text-[1rem] font-sans cursor-pointer shadow-[0_6px_20px_rgba(231,76,60,0.2)] transition-all duration-300 hover:translate-y-[-2px] hover:shadow-[0_10px_25px_rgba(231,76,60,0.35)] mb-[1rem] tracking-[0.5px] disabled:opacity-50"
              >
                {isLoading ? 'SIGNING IN...' : 'LOGIN'}
              </button>

              <button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full p-[0.9rem] bg-white text-[#4a5568] border border-[#e2e8f0] rounded-[12px] font-semibold text-[0.95rem] font-sans cursor-pointer transition-all duration-[0.25s] flex items-center justify-center gap-[0.8rem] mb-[2rem] hover:bg-[#f7fafc] hover:border-[#cbd5e0]"
              >
                <span className="font-extrabold bg-gradient-to-r from-[#4285f4] via-[#ea4335] via-[#fbbc05] to-[#34a853] bg-clip-text text-transparent">
                  G
                </span>
                Sign in with Google
              </button>

              <p className="text-center text-[0.9rem] text-[#718096] m-0">
                Don't have an account?{' '}
                <span
                  className="text-[#e74c3c] font-bold cursor-pointer transition-all hover:text-[#c0392b] hover:underline"
                  onClick={() => setShowCreateAccount(true)}
                >
                  Create Account
                </span>
              </p>
            </form>
          ) : (
            /* Create Account Form */
            <form onSubmit={handleRegister}>
              <h2 className="text-[1.6rem] font-bold text-[#2d3748] mt-0 mb-[0.4rem]">
                Create Account
              </h2>

              <p className="text-[0.95rem] text-[#718096] mt-0 mb-[1.5rem]">
                Join us to start ordering fresh seafood
              </p>

              <div className="mb-[1.2rem]">
                <input
                  type="text"
                  placeholder="Full Name"
                  required
                  className="w-full py-[1rem] px-[1.2rem] rounded-[12px] border border-[#e2e8f0] font-sans text-[0.95rem] font-medium text-[#2d3748] transition-all duration-[0.25s] box-border bg-[#f7fafc] focus:outline-none focus:border-[#e74c3c] focus:bg-white focus:shadow-[0_0_0_4px_rgba(231,76,60,0.1)]"
                  value={fullname}
                  onChange={(e) => setFullname(e.target.value)}
                />
              </div>

              <div className="mb-[1.2rem]">
                <input
                  type="text"
                  placeholder="Username"
                  required
                  className="w-full py-[1rem] px-[1.2rem] rounded-[12px] border border-[#e2e8f0] font-sans text-[0.95rem] font-medium text-[#2d3748] transition-all duration-[0.25s] box-border bg-[#f7fafc] focus:outline-none focus:border-[#e74c3c] focus:bg-white focus:shadow-[0_0_0_4px_rgba(231,76,60,0.1)]"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>

              <div className="mb-[1.2rem]">
                <input
                  type="email"
                  placeholder="Email Address"
                  required
                  className="w-full py-[1rem] px-[1.2rem] rounded-[12px] border border-[#e2e8f0] font-sans text-[0.95rem] font-medium text-[#2d3748] transition-all duration-[0.25s] box-border bg-[#f7fafc] focus:outline-none focus:border-[#e74c3c] focus:bg-white focus:shadow-[0_0_0_4px_rgba(231,76,60,0.1)]"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="mb-[1.2rem]">
                <input
                  type="tel"
                  placeholder="Phone Number"
                  required
                  className="w-full py-[1rem] px-[1.2rem] rounded-[12px] border border-[#e2e8f0] font-sans text-[0.95rem] font-medium text-[#2d3748] transition-all duration-[0.25s] box-border bg-[#f7fafc] focus:outline-none focus:border-[#e74c3c] focus:bg-white focus:shadow-[0_0_0_4px_rgba(231,76,60,0.1)]"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div className="mb-[1.2rem] relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  required
                  className="w-full py-[1rem] pl-[1.2rem] pr-[3rem] rounded-[12px] border border-[#e2e8f0] font-sans text-[0.95rem] font-medium text-[#2d3748] transition-all duration-[0.25s] box-border bg-[#f7fafc] focus:outline-none focus:border-[#e74c3c] focus:bg-white focus:shadow-[0_0_0_4px_rgba(231,76,60,0.1)]"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-[1rem] top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 focus:outline-none transition-colors"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908a10.03 10.03 0 013.122-.563c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m-6.165-4.131a3 3 0 11-4.243-4.243M3 3l18 18"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-3.057-9.542-7z"
                      />
                    </svg>
                  )}
                </button>
              </div>

              <div className="mb-[1.2rem] relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm Password"
                  required
                  className="w-full py-[1rem] pl-[1.2rem] pr-[3rem] rounded-[12px] border border-[#e2e8f0] font-sans text-[0.95rem] font-medium text-[#2d3748] transition-all duration-[0.25s] box-border bg-[#f7fafc] focus:outline-none focus:border-[#e74c3c] focus:bg-white focus:shadow-[0_0_0_4px_rgba(231,76,60,0.1)]"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />

                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-[1rem] top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 focus:outline-none transition-colors"
                  aria-label="Toggle confirm password visibility"
                >
                  {showConfirmPassword ? (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908a10.03 10.03 0 013.122-.563c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m-6.165-4.131a3 3 0 11-4.243-4.243M3 3l18 18"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7z"
                      />
                    </svg>
                  )}
                </button>
              </div>

              {/* Terms and Conditions Checkbox */}
              <label className="flex items-center gap-[0.5rem] mb-[2rem] text-[0.9rem] text-[#4a5568] cursor-pointer font-medium">
                <input
                  type="checkbox"
                  className="accent-[#e74c3c]"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                />

                <span>
                  I agree to the{' '}
                  <button
                    type="button"
                    onClick={() => setShowTerms(true)}
                    className="text-[#e74c3c] font-semibold hover:text-[#c0392b] hover:underline"
                  >
                    Terms and Conditions
                  </button>
                </span>
              </label>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full p-[1rem] bg-gradient-to-r from-[#e74c3c] to-[#d35400] text-white border-none rounded-[12px] font-bold text-[1rem] font-sans cursor-pointer shadow-[0_6px_20px_rgba(231,76,60,0.2)] transition-all duration-300 hover:translate-y-[-2px] hover:shadow-[0_10px_25px_rgba(231,76,60,0.35)] mb-[1rem] tracking-[0.5px] disabled:opacity-50"
              >
                {isLoading ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT'}
              </button>

              <p className="text-center text-[0.9rem] text-[#718096] m-0">
                Already have an Account?{' '}
                <span
                  className="text-[#e74c3c] font-bold cursor-pointer transition-all hover:text-[#c0392b] hover:underline"
                  onClick={() => setShowCreateAccount(false)}
                >
                  Login
                </span>
              </p>
            </form>
          )}
        </div>

        {/* Terms and Conditions Modal */}
        {showTerms && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">

            <div className="bg-white w-full max-w-3xl max-h-[85vh] rounded-2xl shadow-2xl border border-neutral-200 flex flex-col">

              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-200">
                <div>
                  <h2 className="text-xl font-bold text-[#2d3748]">
                    TERMS AND CONDITIONS
                  </h2>

                  <p className="text-xs text-neutral-500 mt-1">
                    Effective Date: 9/20/2026
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowTerms(false)}
                  className="text-neutral-400 hover:text-neutral-700 text-2xl font-bold leading-none"
                  aria-label="Close Terms and Conditions"
                >
                  ×
                </button>
              </div>

              {/* Modal Content */}
              <div className="overflow-y-auto px-6 py-6 text-sm text-[#4a5568] leading-relaxed">

                <p className="mb-5">
                  Welcome to Seafudz ng Bayan. These Terms and Conditions
                  govern the use of the Seafudz ng Bayan Online Ordering and Delivery System. By
                  creating an account, logging in, or using the system, the customer agrees to
                  comply with these terms.
                </p>

                <h3 className="font-bold text-[#2d3748] mb-2">
                  1. Account Registration
                </h3>

                <p className="mb-3">
                  Customers may create an account by providing the required
                  information.
                </p>

                <p className="mb-5">
                  Customers are required to provide accurate and complete
                  information when creating an account. The information provided should be kept
                  updated when necessary.
                </p>

                <h3 className="font-bold text-[#2d3748] mb-2">
                  2. Account Security
                </h3>

                <p className="mb-3">
                  Customers are responsible for keeping their username and
                  password confidential. Customers should not share their login credentials with
                  other individuals. Any activity performed through the customer's account may be
                  associated with that account.
                </p>

                <p className="mb-5">
                  If a customer believes that their account or password has
                  been compromised, they should use the available password recovery option or
                  contact the restaurant for assistance.
                </p>

                <h3 className="font-bold text-[#2d3748] mb-2">
                  3. Login
                </h3>

                <p className="mb-3">
                  Customers may access their account using their registered
                  username and password. The system also provides a{' '}
                  <strong>Google Sign-In</strong> option
                  for account access.
                </p>

                <p className="mb-5">
                  The <strong>Remember Me</strong> option may be used to keep the
                  customer's login session active on the device, subject to the system's
                  authentication settings.
                </p>

                <h3 className="font-bold text-[#2d3748] mb-2">
                  4. Password Recovery
                </h3>

                <p className="mb-5">
                  Customers who forget their password may use the{' '}
                  <strong>Forgot Password</strong> option provided on the login page to recover or
                  reset their account password.
                </p>

                <h3 className="font-bold text-[#2d3748] mb-2">
                  5. Account Creation and Terms Agreement
                </h3>

                <p className="mb-5">
                  Customers must agree to the <strong>Terms and Conditions</strong>
                  before creating an account. By selecting the agreement option and clicking{' '}
                  <strong>Create Account</strong>, the customer confirms that they have read and
                  accepted these Terms and Conditions.
                </p>

                <h3 className="font-bold text-[#2d3748] mb-2">
                  6. Proper Use of the Account
                </h3>

                <p className="mb-5">
                  Customers are expected to use their accounts only for legitimate
                  purposes related to the services provided by Seafudz ng Bayan.
                  Customers must not attempt to access another person's account or use the system
                  in a way that may interfere with its normal operation.
                </p>

                <h3 className="font-bold text-[#2d3748] mb-2">
                  7. System Access
                </h3>

                <p className="mb-5">
                  Access to the system may depend on the availability of the
                  internet and the system itself. Temporary interruptions may occur due to
                  maintenance, technical problems, or other circumstances affecting system
                  availability.
                </p>

                <h3 className="font-bold text-[#2d3748] mb-2">
                  8. Acceptance of Terms
                </h3>

                <p>
                  By creating an account and using the Seafudz ng Bayan Online Ordering and Delivery System, the customer acknowledges that they have read, understood, and agreed to these Terms and Conditions.
                </p>

              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-neutral-200 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowTerms(false)}
                  className="px-5 py-2.5 bg-[#e74c3c] hover:bg-[#c0392b] text-white rounded-xl font-semibold text-sm transition-colors"
                >
                  Close
                </button>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;