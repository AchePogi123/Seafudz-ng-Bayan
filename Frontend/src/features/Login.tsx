import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import logo from '../assets/logo.jpg';
import { supabase } from '../utils/supabase';
import { API_BASE_URL } from '../utils/api';

type UserRole = 'customer' | 'cashier' | 'kitchen' | 'rider' | 'assistant';

const Login = () => {
  const navigate = useNavigate();
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const [role, setRole] = useState<UserRole>('customer');

  // Form states
  const [loginInput, setLoginInput] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [fullname, setFullname] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  
  // UI states
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Business role prevention code (Standard restaurant admin key)
  const REQUIRED_STAFF_KEY = 'SFB-STAFF-99';

  const navigateByRole = (userRole?: string) => {
    const normRole = (userRole || 'customer').toLowerCase();
    if (normRole === 'cashier') navigate('/sales-report');
    else if (normRole === 'kitchen') navigate('/kitchen');
    else if (normRole === 'rider') navigate('/rider');
    else if (normRole === 'assistant') navigate('/assistant');
    else navigate('/customer');
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
        const { data, error } = await supabase.auth.signInWithPassword({
          email: loginInput.trim(),
          password: loginPassword,
        });

        if (data?.user) {
          supabaseUser = data.user;
        } else if (error) {
          supabaseAuthErr = error.message;
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
        const { data } = await supabase.auth.signInWithPassword({
          email: profileData.data.email,
          password: loginPassword,
        });
        if (data?.user) {
          supabaseUser = data.user;
        }
      }

      // If neither Supabase Auth nor Express backend profile succeeded
      if (!profileData?.success && !supabaseUser) {
        if (supabaseAuthErr) {
          throw new Error(supabaseAuthErr);
        }
        throw new Error('Invalid email/username or password. Please check your credentials.');
      }

      const userRole = profileData?.data?.role || 'customer';
      const userName = profileData?.data?.fullname || supabaseUser?.email || loginInput;

      setSuccessMessage(`Welcome back, ${userName}! Redirecting to workspace...`);
      setTimeout(() => {
        navigateByRole(userRole);
      }, 1200);

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

    if (!fullname || !username || !email || !password || !confirmPassword) {
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
      // 1. Create User in Supabase Auth Provider
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email,
        password: password,
      });

      if (authError) {
        throw new Error(authError.message);
      }

      const supabaseUserId = authData.user?.id;

      // 2. Register profile in PostgreSQL Express Backend
      try {
        await fetch(`${API_BASE_URL}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            supabaseUserId,
            fullname,
            username,
            email,
            role,
            token: verificationCode,
          }),
        });
      } catch (backendErr) {
        console.warn('Backend API profile sync note:', backendErr);
      }

      setSuccessMessage(`Account created successfully as ${role.toUpperCase()}! Redirecting...`);
      setTimeout(() => {
        navigateByRole(role);
      }, 1500);

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
      setIsLoading(true);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { 
          redirectTo: `${window.location.origin}/customer`,
          skipBrowserRedirect: true,
        }
      });

      if (error) throw error;

      if (data?.url) {
        // Open Google authentication popup window
        const width = 500;
        const height = 650;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2.5;
        
        const popup = window.open(
          data.url,
          'GoogleSignInPopup',
          `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes,scrollbars=yes`
        );

        if (!popup || popup.closed || typeof popup.closed === 'undefined') {
          // If popup is blocked by browser, fallback to standard redirect
          window.location.href = data.url;
        } else {
          // Monitor popup closure / auth state change
          const checkPopupInterval = setInterval(async () => {
            if (popup.closed) {
              clearInterval(checkPopupInterval);
              setIsLoading(false);
              const { data: sessionData } = await supabase.auth.getSession();
              if (sessionData?.session) {
                navigate('/customer');
              }
            }
          }, 600);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Google authentication failed';
      setErrorMessage(msg);
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
      <div className="flex-1 flex justify-center items-center py-12 px-6">
        <div className="bg-white w-full max-w-[480px] rounded-2xl shadow-2xs border border-neutral-200/80 p-8 sm:p-10 transition-all">
          {/* Brand Logo - Circular matching ForgotPassword */}
          <div className="text-center mb-6">
            <img 
              src={logo} 
              alt="Seafudz Ng Bayan Logo" 
              className="w-40 h-40 sm:w-44 sm:h-44 object-cover rounded-full mx-auto drop-shadow-md mb-2.5" 
            />
            <p className="text-xs text-neutral-400 font-medium tracking-tight">Owned by cousins Gelyn Basilio-Alday and Joemarie Gobangco</p>
          </div>

          {errorMessage && <div className="py-[1rem] px-[1.2rem] rounded-[12px] text-[0.9rem] font-semibold mb-[1.5rem] leading-[1.4] animate-[fadeIn_0.3s_ease] bg-[#fff5f5] text-[#c53030] border border-[#fed7d7]">{errorMessage}</div>}
          {successMessage && <div className="py-[1rem] px-[1.2rem] rounded-[12px] text-[0.9rem] font-semibold mb-[1.5rem] leading-[1.4] animate-[fadeIn_0.3s_ease] bg-[#f0fff4] text-[#22543d] border border-[#c6f6d5]">{successMessage}</div>}

          {!showCreateAccount ? (
            /* Login Form */
            <form onSubmit={handleLogin}>
              <h2 className="text-[1.6rem] font-bold text-[#2d3748] mt-0 mb-[0.4rem]">Welcome Back</h2>
              <p className="text-[0.95rem] text-[#718096] mt-0 mb-[1.5rem]">Sign in with your Supabase credentials</p>
              
              <div className="mb-[1.2rem]">
                <input
                  type="text"
                  placeholder="Email or Staff Username"
                  required
                  className="w-full py-[1rem] px-[1.2rem] rounded-[12px] border border-[#e2e8f0] font-sans text-[0.95rem] font-medium text-[#2d3748] transition-all duration-[0.25s] box-border bg-[#f7fafc] focus:outline-none focus:border-[#e74c3c] focus:bg-white focus:shadow-[0_0_0_4px_rgba(231,76,60,0.1)]"
                  value={loginInput}
                  onChange={(e) => setLoginInput(e.target.value)}
                />
              </div>
              <div className="mb-[1.2rem]">
                <input
                  type="password"
                  placeholder="Password or Counter PIN"
                  required
                  className="w-full py-[1rem] px-[1.2rem] rounded-[12px] border border-[#e2e8f0] font-sans text-[0.95rem] font-medium text-[#2d3748] transition-all duration-[0.25s] box-border bg-[#f7fafc] focus:outline-none focus:border-[#e74c3c] focus:bg-white focus:shadow-[0_0_0_4px_rgba(231,76,60,0.1)]"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                />
              </div>
              
              <div className="flex justify-between items-center mb-[2rem] text-[0.9rem]">
                <label className="flex items-center gap-[0.5rem] text-[#4a5568] cursor-pointer font-medium">
                  <input type="checkbox" className="accent-[#e74c3c]" defaultChecked /> Remember me
                </label>
                <Link to="/forgot-password" className="bg-none border-none text-[#e74c3c] font-semibold font-sans text-[0.9rem] cursor-pointer p-0 transition-all hover:text-[#c0392b] hover:underline">Forgot Password?</Link>
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
                className="w-full p-[0.9rem] bg-white text-[#4a5568] border border-[#e2e8f0] rounded-[12px] font-semibold text-[0.95rem] font-sans cursor-pointer transition-all duration-[0.25s] flex items-center justify-center gap-[0.8rem] mb-[2rem] hover:bg-[#f7fafc] hover:border-[#cbd5e0] shadow-2xs"
              >
                {/* Official 4-Color Google Logo SVG */}
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Sign in with Google</span>
              </button>

              <p className="text-center text-[0.9rem] text-[#718096] m-0">
                Don't have an account? <Link to="/create-account" className="text-[#e74c3c] font-bold cursor-pointer transition-all hover:text-[#c0392b] hover:underline">Create Account</Link>
              </p>
            </form>
          ) : (
            /* Create Account Form */
            <form onSubmit={handleRegister}>
              <h2 className="text-[1.6rem] font-bold text-[#2d3748] mt-0 mb-[0.4rem]">Create Account</h2>
              <p className="text-[0.95rem] text-[#718096] mt-0 mb-[1.5rem]">Join us to start ordering fresh seafood</p>
              
              {/* Account Type / Role Selection */}
              <div className="mb-[1.8rem] text-left">
                <label className="text-[0.9rem] font-bold text-[#4a5568] block mb-[0.7rem]">Register As:</label>
                <div className="flex flex-wrap gap-[0.6rem]">
                  {(['customer', 'cashier', 'kitchen', 'rider', 'assistant'] as UserRole[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      className={`bg-[#f7fafc] border border-[#e2e8f0] text-[#4a5568] py-[0.6rem] px-[1.1rem] rounded-[50px] text-[0.85rem] font-semibold font-sans cursor-pointer transition-all duration-[0.25s] cubic-bezier(0.165,0.84,0.44,1) hover:bg-[#edf2f7] hover:border-[#cbd5e0] hover:translate-y-[-1px] ${role === r ? 'bg-gradient-to-r from-[#e74c3c] to-[#d35400] text-white border-transparent shadow-[0_4px_12px_rgba(231,76,60,0.2)]' : ''}`}
                      onClick={() => {
                        setRole(r);
                        setErrorMessage('');
                      }}
                    >
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Business Prevention Token Field */}
              {role !== 'customer' && (
                <div className="bg-[#fffaf0] border border-[#feebc8] p-[1.2rem] rounded-[14px] mb-[1.5rem] animate-slide-down">
                  <div className="text-[0.85rem] text-[#c05621] font-bold mb-[0.8rem] flex items-center gap-[0.4rem]">
                    ⚠️ Business Role: Employee Access Token Required to Register.
                  </div>
                  <div className="mb-[1.2rem]">
                    <input
                      type="text"
                      placeholder="Enter Employee Access Token"
                      className="w-full py-[1rem] px-[1.2rem] rounded-[12px] border border-[#feebc8] font-sans text-[0.95rem] font-medium text-[#2d3748] transition-all duration-[0.25s] box-border bg-white focus:outline-none focus:border-[#dd6b20] focus:shadow-[0_0_0_4px_rgba(221,107,32,0.1)]"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value)}
                    />
                  </div>
                  <small className="block mt-[0.4rem] text-[0.78rem] text-[#718096]">
                    For testing purposes, use standard key: <code className="bg-[#edf2f7] py-[0.1rem] px-[0.4rem] rounded font-mono font-bold text-[#2d3748]">SFB-STAFF-99</code>
                  </small>
                </div>
              )}
              
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
                  type="password"
                  placeholder="Password"
                  required
                  className="w-full py-[1rem] px-[1.2rem] rounded-[12px] border border-[#e2e8f0] font-sans text-[0.95rem] font-medium text-[#2d3748] transition-all duration-[0.25s] box-border bg-[#f7fafc] focus:outline-none focus:border-[#e74c3c] focus:bg-white focus:shadow-[0_0_0_4px_rgba(231,76,60,0.1)]"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="mb-[1.2rem]">
                <input
                  type="password"
                  placeholder="Confirm Password"
                  required
                  className="w-full py-[1rem] px-[1.2rem] rounded-[12px] border border-[#e2e8f0] font-sans text-[0.95rem] font-medium text-[#2d3748] transition-all duration-[0.25s] box-border bg-[#f7fafc] focus:outline-none focus:border-[#e74c3c] focus:bg-white focus:shadow-[0_0_0_4px_rgba(231,76,60,0.1)]"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              <label className="flex items-center gap-[0.5rem] mb-[2rem] text-[0.9rem] text-[#4a5568] cursor-pointer font-medium">
                <input
                  type="checkbox"
                  className="accent-[#e74c3c]"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                />
                I agree to the Terms and Conditions
              </label>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full p-[1rem] bg-gradient-to-r from-[#e74c3c] to-[#d35400] text-white border-none rounded-[12px] font-bold text-[1rem] font-sans cursor-pointer shadow-[0_6px_20px_rgba(231,76,60,0.2)] transition-all duration-300 hover:translate-y-[-2px] hover:shadow-[0_10px_25px_rgba(231,76,60,0.35)] mb-[1rem] tracking-[0.5px] disabled:opacity-50"
              >
                {isLoading ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT'}
              </button>
              
              <p className="text-center text-[0.9rem] text-[#718096] m-0">
                Already have an Account? <span className="text-[#e74c3c] font-bold cursor-pointer transition-all hover:text-[#c0392b] hover:underline" onClick={() => setShowCreateAccount(false)}>Login</span>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
