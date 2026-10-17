import { useState, useEffect, useRef } from 'react';
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../utils/supabase';
import { API_BASE_URL } from '../utils/api';
import { saveSessionToken, saveActiveUser, generateClientHashToken, getStoredSessionToken } from '../cryptography/cryptoSession';

type UserRole = 'customer' | 'cashier' | 'kitchen' | 'rider' | 'assistant';

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [authMode, setAuthMode] = useState<'welcome' | 'login' | 'signup'>(() => {
    return location.state?.from ? 'login' : 'welcome';
  });
  const [isExpandingAuth, setIsExpandingAuth] = useState(false);
  const authTransitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [boatSceneKey, setBoatSceneKey] = useState(0);
  const [isBoatSceneActive, setIsBoatSceneActive] = useState(false);
  const boatSceneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const role: UserRole = 'customer';

  // Device & browser back button handler: Always navigate to Landing Page
  useEffect(() => {
    window.history.pushState({ page: 'login' }, '', window.location.href);

    const handlePopState = () => {
      navigate('/landingpage', { replace: true });
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [navigate]);

  useEffect(() => () => {
    if (authTransitionTimer.current) clearTimeout(authTransitionTimer.current);
    if (boatSceneTimer.current) clearTimeout(boatSceneTimer.current);
  }, []);

  // Form states
  const [loginInput, setLoginInput] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const fullname = `${firstName.trim()} ${lastName.trim()}`.trim();

  const handleFirstNameChange = (val: string) => {
    setFirstName(val);
    if (val.trim() && lastName.trim()) {
      setUsername(`${val.trim().charAt(0).toUpperCase()}.${lastName.trim()}`);
    }
  };

  const handleLastNameChange = (val: string) => {
    setLastName(val);
    if (firstName.trim() && val.trim()) {
      setUsername(`${firstName.trim().charAt(0).toUpperCase()}.${val.trim()}`);
    }
  };
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

  // OTP Verification Modal States
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [otpTimer, setOtpTimer] = useState(30);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState('');

  // Forgot Password Modal States
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [isSendingForgot, setIsSendingForgot] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');

  // UI states
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [isRegisterLoading, setIsRegisterLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // OTP Resend Countdown Timer
  React.useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (showOtpModal && otpTimer > 0) {
      interval = setInterval(() => {
        setOtpTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [showOtpModal, otpTimer]);


  const navigateByRole = (userRole?: string, token?: string, userData?: Record<string, unknown>) => {
    const normRole = (userRole || 'customer').toLowerCase();
    const userPhone = (userData?.phone as string) || phone || undefined;
    const userAddress = (userData?.delivery_address as string) || (userData?.address as string) || undefined;

    const activeToken =
      token ||
      getStoredSessionToken() ||
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
    if (activeToken) {
      saveSessionToken(activeToken);
    }

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

    setIsLoginLoading(true);

    try {
      const isEmail = loginInput.trim().includes('@');
      let supabaseUser = null;
      let supabaseAccessToken: string | null = null;
      let profileData = null;
      let supabaseAuthErr: string | null = null;
      let blockedStaffMessage: string | null = null;

      // 1. Try Supabase Auth login first if an email is provided
      if (isEmail) {
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: loginInput.trim(),
            password: loginPassword,
          });

          if (data?.user) {
            supabaseUser = data.user;
            supabaseAccessToken = data.session?.access_token || null;
          } else if (error) {
            supabaseAuthErr = error.message;
          }
        } catch (sErr) {
          console.warn('Supabase auth attempt note:', sErr);
        }
      }

      // 2. Authenticate and retrieve profile against Express backend
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (supabaseAccessToken) {
          headers['Authorization'] = `Bearer ${supabaseAccessToken}`;
        }

        const res = await fetch(`${API_BASE_URL}/auth/login`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            loginInput: loginInput.trim(),
            email: isEmail ? loginInput.trim() : undefined,
            username: !isEmail ? loginInput.trim() : undefined,
            password: loginPassword,
            pinCode: loginPassword,
          }),
        });

        if (res.ok) {
          profileData = await res.json();
        } else {
          const errData = await res.json().catch(() => null);
          if (errData?.code === 'STAFF_PENDING_ACTIVATION' || errData?.code === 'STAFF_ACCOUNT_INACTIVE') {
            blockedStaffMessage = errData.message || 'This staff account cannot sign in yet.';
          }
          if (errData?.message && !supabaseUser) {
            supabaseAuthErr = errData.message;
          }
        }
      } catch (backendErr) {
        console.warn('Backend API connection note:', backendErr);
      }

      if (blockedStaffMessage) throw new Error(blockedStaffMessage);

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

      if (!profileData?.success && !supabaseUser) {
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
      setIsLoginLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setOtpError('');

    if (!firstName.trim() || !lastName.trim() || !username || !email || !phone || !password || !confirmPassword) {
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

    // Validate employee key requirement for business system roles
    if (role !== 'customer' && !verificationCode) {
      setErrorMessage('Verification is required for business accounts. Please enter your Employee Access Token.');
      return;
    }

    setIsSendingOtp(true);
    setIsRegisterLoading(true);

    try {
      // Send 5-digit OTP verification code to user email
      const otpRes = await fetch(`${API_BASE_URL}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const otpJson = await otpRes.json();

      if (!otpRes.ok || !otpJson.success) {
        throw new Error(otpJson.message || 'Failed to send verification code.');
      }

      setOtpDigits(['', '', '', '', '', '']);
      setOtpTimer(30);
      setShowOtpModal(true);

      setTimeout(() => {
        document.getElementById('otp-slot-0')?.focus();
      }, 200);

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed. Please try again.';
      setErrorMessage(msg);
    } finally {
      setIsSendingOtp(false);
      setIsRegisterLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setOtpError('');
    setIsSendingOtp(true);
    try {
      const otpRes = await fetch(`${API_BASE_URL}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const otpJson = await otpRes.json();
      if (!otpRes.ok || !otpJson.success) {
        throw new Error(otpJson.message || 'Failed to resend code.');
      }

      setOtpDigits(['', '', '', '', '', '']);
      setOtpTimer(30);
      document.getElementById('otp-slot-0')?.focus();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Resend failed.';
      setOtpError(msg);
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    const cleanValue = value.replace(/[^0-9]/g, '');
    const newDigits = [...otpDigits];

    if (cleanValue.length > 0) {
      newDigits[index] = cleanValue.slice(-1);
      setOtpDigits(newDigits);

      if (index < 5) {
        document.getElementById(`otp-slot-${index + 1}`)?.focus();
      }
    } else {
      newDigits[index] = '';
      setOtpDigits(newDigits);
    }

    if (newDigits.join('').length === 6) {
      handleVerifyOtp(newDigits.join(''));
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      document.getElementById(`otp-slot-${index - 1}`)?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 6);
    if (pasted) {
      const digits = pasted.split('');
      const newDigits = ['', '', '', '', '', ''];
      digits.forEach((d, i) => {
        newDigits[i] = d;
      });
      setOtpDigits(newDigits);
      if (digits.length === 6) {
        document.getElementById('otp-slot-5')?.focus();
        handleVerifyOtp(pasted);
      } else {
        document.getElementById(`otp-slot-${digits.length - 1}`)?.focus();
      }
    }
  };

  const handleVerifyOtp = async (codeToVerify: string) => {
    if (codeToVerify.length < 6) {
      setOtpError('Please enter all 6 digits.');
      return;
    }

    setOtpError('');
    setIsVerifyingOtp(true);

    try {
      const verifyRes = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), otp: codeToVerify }),
      });

      const verifyJson = await verifyRes.json();
      if (!verifyRes.ok || !verifyJson.success) {
        throw new Error(verifyJson.message || 'Invalid verification code.');
      }

      setShowOtpModal(false);
      await executeRegistration();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Verification failed.';
      setOtpError(msg);
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const executeRegistration = async () => {
    setIsRegisterLoading(true);

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
      setFirstName('');
      setLastName('');
      setUsername('');
      setEmail('');
      setPhone('');
      setPassword('');
      setConfirmPassword('');
      setVerificationCode('');

      setSuccessMessage(`Account created & email verified successfully as ${role.toUpperCase()}! Redirecting to workspace...`);

      setTimeout(() => {
        navigateByRole(role, regSessionToken, regUserData);
      }, 1200);

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed. Please try again.';
      setErrorMessage(msg);
    } finally {
      setIsRegisterLoading(false);
    }
  };

  const handleSendForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');

    if (!forgotEmail || !forgotEmail.trim()) {
      setForgotError('Please enter your registered email address.');
      return;
    }

    setIsSendingForgot(true);

    try {
      const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim() }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to send password reset link.');
      }

      setForgotSuccess(data.message || 'Password reset link sent! Please check your email inbox.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send reset link.';
      setForgotError(msg);
    } finally {
      setIsSendingForgot(false);
    }
  };

  const beginAuth = (mode: 'login' | 'signup') => {
    setErrorMessage('');
    setSuccessMessage('');

    if (authTransitionTimer.current) clearTimeout(authTransitionTimer.current);

    if (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      !window.matchMedia('(min-width: 768px)').matches
    ) {
      setIsExpandingAuth(false);
      setAuthMode(mode);
      return;
    }

    setIsExpandingAuth(true);
    authTransitionTimer.current = setTimeout(() => {
      setAuthMode(mode);
      setIsExpandingAuth(false);
      authTransitionTimer.current = null;
    }, 420);
  };

  const returnToWelcome = () => {
    if (authTransitionTimer.current) clearTimeout(authTransitionTimer.current);
    setAuthMode('welcome');

    if (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      !window.matchMedia('(min-width: 768px)').matches
    ) {
      setIsExpandingAuth(false);
      return;
    }

    setIsExpandingAuth(true);
    authTransitionTimer.current = setTimeout(() => {
      setIsExpandingAuth(false);
      authTransitionTimer.current = null;
    }, 450);
  };

  const animateBoatScene = () => {
    setBoatSceneKey((key) => key + 1);
    setIsBoatSceneActive(true);
    if (boatSceneTimer.current) clearTimeout(boatSceneTimer.current);
    boatSceneTimer.current = setTimeout(() => {
      setIsBoatSceneActive(false);
      boatSceneTimer.current = null;
    }, 2600);
  };

  const heroPanel = (
    <div className={`login-hero relative min-w-0 min-h-[330px] md:min-h-0 bg-[#FF6900] px-6 pt-8 sm:px-9 sm:pt-9 pb-8 md:p-10 lg:p-12 text-white overflow-hidden flex flex-col justify-between ${
      authMode === 'signup'
        ? 'login-hero-from-right rounded-t-[30px] sm:rounded-t-[34px] md:rounded-t-none md:rounded-r-[28px] lg:rounded-r-[36px]'
        : 'login-hero-from-left rounded-b-[30px] sm:rounded-b-[34px] md:rounded-b-none md:rounded-l-[28px] lg:rounded-l-[36px]'
    }`}>
      <div className="pointer-events-none absolute -right-24 -top-16 h-80 w-80 rounded-full border border-white/15" />
      <div className="pointer-events-none absolute -right-10 top-16 h-56 w-56 rounded-full border border-white/10" />
      <button
        type="button"
        onClick={animateBoatScene}
        aria-label="Make the boat sail with birds and swimming fish"
        className="group pointer-events-auto absolute left-1/2 top-1/2 z-0 hidden h-48 w-64 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white md:block lg:h-56 lg:w-80"
      >
        <svg className="h-full w-full transition-transform duration-300 group-hover:scale-[1.03] group-focus-visible:scale-[1.03]" viewBox="0 0 320 220" fill="none" aria-hidden="true">
          <ellipse cx="160" cy="181" rx="104" ry="9" fill="#7D3300" fillOpacity=".24" />
          <g className="hero-boat-motion">
            <path d="M86 119 39 103M234 119l47-16" stroke="#F5D49F" strokeWidth="6" strokeLinecap="round" />
            <path d="M16 101q24 15 48 0l-7 12q-18 9-35 0Z" fill="#16495A" />
            <path d="M256 101q24 15 48 0l-6 12q-18 9-35 0Z" fill="#16495A" />
            <path d="M71 119h178l-29 43q-60 22-120 0Z" fill="#16394B" />
            <path d="M86 147h148l-14 21q-60 18-120 0Z" fill="#0B6975" />
            <path d="M75 116h170l10 14H65Z" fill="#F2B967" />
            <path d="M119 75h82l19 41H100Z" fill="#FFF3D9" />
            <path d="M111 74h94l-8 12h-78Z" fill="#16495A" />
            <path d="M126 90h24v19h-24Zm34 0h24v19h-24Z" fill="#0D5968" />
            <path d="M155 50v26" stroke="#F5D49F" strokeWidth="4" strokeLinecap="round" />
            <path d="M145 51h21" stroke="#F5D49F" strokeWidth="4" strokeLinecap="round" />
            <path d="M75 133h170" stroke="#FF6900" strokeWidth="4" strokeLinecap="round" />
          </g>
          <g className="hero-boat-waves" stroke="#FFF5E7" strokeWidth="3" strokeLinecap="round" opacity=".78">
            <path d="M42 190q18-9 36 0t36 0 36 0 36 0 36 0 36 0 36 0" />
            <path d="M70 205q18-8 36 0t36 0 36 0 36 0 36 0" />
          </g>
          {isBoatSceneActive && (
            <g key={boatSceneKey}>
              <g className="hero-bird hero-bird-one" fill="none" stroke="#FFF5E7" strokeWidth="3" strokeLinecap="round">
                <path d="M208 56q7-9 14 0 7-9 14 0" />
              </g>
              <g className="hero-bird hero-bird-two" fill="none" stroke="#FFF5E7" strokeWidth="2.5" strokeLinecap="round">
                <path d="M234 39q6-7 12 0 6-7 12 0" />
              </g>
              <g className="hero-bird hero-bird-three" fill="none" stroke="#FFF5E7" strokeWidth="2" strokeLinecap="round">
                <path d="M183 43q5-6 10 0 5-6 10 0" />
              </g>
              <g className="hero-fish hero-fish-one" stroke="#16495A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M83 194c7-8 18-11 29-7l10 7-10 7c-11 4-22 1-29-7Z" fill="#FFF3D9" />
                <path d="m83 194-11-8v16Z" fill="#F5D49F" />
                <path d="m96 187 5-7 5 9m-9 12 5 7 5-9" fill="#F5D49F" />
                <path d="M100 188q6 6 0 12m-9-8 4 2m-4 2 4 1" fill="none" />
                <circle cx="114" cy="191" r="1.7" fill="#16495A" stroke="none" />
              </g>
              <g className="hero-fish hero-fish-two" stroke="#16495A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M237 204c-7-8-18-10-28-6l-10 7 10 7c10 4 21 1 28-8Z" fill="#F5D49F" />
                <path d="m237 205 11-8v16Z" fill="#FFF3D9" />
                <path d="m224 198-5-7-5 9m9 11-5 7-5-9" fill="#FFF3D9" />
                <path d="M220 199q-6 6 0 12m9-8-4 2m4 2-4 1" fill="none" />
                <circle cx="204" cy="201" r="1.7" fill="#16495A" stroke="none" />
              </g>
            </g>
          )}
        </svg>
      </button>
      <div className="login-hero-copy relative z-10 space-y-3">
        <div className="inline-flex items-center gap-2 text-white/90 text-[11px] font-bold tracking-[0.16em] uppercase">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-white">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 13.5c2.2-1.2 3.4-4.1 6.2-4.1 2.7 0 3.7 2.5 6.2 2.5 1.2 0 2.3-.5 3.6-1.5-.3 4.3-3.8 7.6-8.1 7.6-3.7 0-6.8-1.7-7.9-4.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M6 7.5c.8-.8 1.6-1.2 2.6-1.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </span>
          Seafudz ng Bayan
        </div>
        <h1 className="text-[2rem] sm:text-4xl lg:text-[2.7rem] font-extrabold tracking-[-0.045em] leading-[1.05] text-white">
          {authMode === 'signup'
            ? <>Good food is even<br className="hidden sm:block" /> better shared.</>
            : <>A little taste<br className="hidden sm:block" /> of the sea.</>}
        </h1>
        <p className="text-xs sm:text-sm text-white/90 font-medium leading-relaxed max-w-sm">
          {authMode === 'signup'
            ? 'Bring your favorite people together over a seafood feast.'
            : 'Welcome back—your seafood favorites are waiting.'}
        </p>
      </div>
      <div className="relative z-10 flex items-center gap-5 sm:gap-7 text-[10px] sm:text-[11px] text-white/90 font-semibold border-t border-white/20 pt-4">
        <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-white" />Fresh daily</span>
        <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-white" />Made for sharing</span>
      </div>
    </div>
  );

  return (
    <div className="login-page font-sans min-h-screen flex items-center justify-center p-0 sm:p-6 lg:p-10">
      {/* Responsive Card: Mobile App Phone Frame on small screens, Expansive Split Dashboard on Windows/Desktop */}
      <div className={`login-card w-full min-h-screen sm:min-h-[560px] md:min-h-[680px] lg:min-h-[720px] bg-white sm:rounded-[28px] lg:rounded-[36px] shadow-[0_32px_100px_-42px_rgba(75,42,25,0.28)] border border-white/70 overflow-hidden grid grid-cols-1 relative ${
        authMode === 'welcome'
          ? isExpandingAuth
            ? 'max-w-[520px] md:max-w-5xl lg:max-w-6xl xl:max-w-7xl md:grid-cols-[minmax(0,0fr)_minmax(0,1fr)]'
            : 'max-w-[520px] md:grid-cols-[minmax(0,0fr)_minmax(0,1fr)]'
          : 'max-w-[520px] md:max-w-5xl lg:max-w-6xl xl:max-w-7xl md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]'
      }`}>
        {authMode === 'login' && heroPanel}

        <div className={`login-form-panel min-w-0 px-6 py-8 sm:px-10 sm:py-10 md:px-8 lg:px-12 xl:px-14 bg-white ${
          authMode === 'welcome'
            ? 'flex flex-col justify-center md:col-start-2'
            : authMode === 'signup'
              ? 'flex flex-col justify-center md:rounded-l-[28px] lg:rounded-l-[36px]'
              : 'flex flex-col justify-center md:rounded-r-[28px] lg:rounded-r-[36px]'
        }`}>
          {/* Notification when redirected from customer order */}
          {(location.state?.from === '/customer' ||
            (typeof location.state?.from === 'object' &&
              location.state?.from?.pathname === '/customer')) &&
            !errorMessage &&
            !successMessage && (
              <div className="md:col-span-2 py-2.5 px-3.5 rounded-2xl text-xs font-semibold mb-4 bg-amber-50 text-amber-900 border border-amber-200/80 flex items-center gap-2 text-left">
                <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Please sign in or create an account to complete your seafood order.</span>
              </div>
            )}

          {errorMessage && (
            <div className="md:col-span-2 py-2.5 px-3.5 rounded-2xl text-xs font-bold mb-4 bg-red-50 text-red-700 border border-red-200 flex items-center gap-2">
              <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="md:col-span-2 py-2.5 px-3.5 rounded-2xl text-xs font-bold mb-4 bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              <span>{successMessage}</span>
            </div>
          )}

          {/* VIEW 1: WELCOME ONBOARDING STATE (Matches reference image directly) */}
          {authMode === 'welcome' && (
            <div className="login-form-content max-w-sm w-full mx-auto flex flex-col items-center justify-center py-2 space-y-6 my-auto text-center">
              <div className="text-center space-y-2 pt-1">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#a82c00]">
                  Fresh seafood · Made for sharing
                </p>
                <h2 className="text-3xl sm:text-[2.15rem] font-bold text-[#4a2b1d] tracking-tight">
                  Gather around something delicious.
                </h2>
                <p className="text-sm text-neutral-500 font-medium leading-relaxed max-w-[290px] mx-auto">
                  Create an account or sign in to order your favorites.
                </p>
              </div>

              <div className="w-full max-w-xs mx-auto space-y-3 pt-1 translate-y-8">
                <button
                  type="button"
                  onClick={() => beginAuth('signup')}
                  className="w-full py-4 bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm tracking-wide rounded-xl shadow-lg shadow-orange-600/25 transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.99] cursor-pointer"
                >
                  Create an account
                </button>

                <button
                  type="button"
                  onClick={() => beginAuth('login')}
                  className="w-full py-4 bg-white hover:bg-[#fff8f2] text-[#4a2b1d] font-bold text-sm tracking-wide rounded-xl border border-[#eadfd7] transition-all duration-200 active:scale-[0.99] cursor-pointer"
                >
                  Sign in
                </button>
                <p className="pt-2 text-xs font-medium text-neutral-400">
                  Your favorites and orders, all in one place.
                </p>
              </div>

            </div>
          )}

          {/* VIEW 2: LOGIN FORM */}
          {authMode === 'login' && (
            <form id="login-form" onSubmit={handleLogin} className="login-form-content max-w-sm w-full mx-auto flex flex-col justify-center my-auto">
              <div>
                <div className="flex items-center mb-3">
                  <button
                    type="button"
                    onClick={returnToWelcome}
                    className="inline-flex items-center gap-1 text-xs font-bold text-neutral-400 hover:text-neutral-700 transition-colors cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                    </svg>
                    Back
                  </button>
                </div>

                <div className="mb-4">
                  <h2 className="text-3xl sm:text-[2.15rem] font-bold text-[#4a2b1d] tracking-tight">
                    Welcome back
                  </h2>
                  <p className="text-sm text-neutral-500 font-medium mt-1">
                    Sign in to pick up where the good food begins.
                  </p>
                </div>

                {/* Email / Username Input */}
                <label className="block mb-4">
                  <span className="block mb-2 text-xs font-bold text-neutral-700">Email or username</span>
                  <input
                    type="text"
                    autoComplete="username"
                    placeholder="you@example.com"
                    required
                    className="w-full py-3.5 px-4 rounded-xl border border-[#eadfd7] font-sans text-sm font-medium text-neutral-800 placeholder-neutral-400 bg-[#fcfaf8] hover:border-[#d8b9a5] focus:outline-none focus:border-[#FF6900] focus:bg-white focus:ring-4 focus:ring-[#FF6900]/10 transition-all box-border"
                    value={loginInput}
                    onChange={(e) => setLoginInput(e.target.value)}
                  />
                </label>

                {/* Password Input */}
                <label className="block mb-4 relative">
                  <span className="block mb-2 text-xs font-bold text-neutral-700">Password</span>
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    required
                    className="w-full py-3.5 pl-4 pr-11 rounded-xl border border-[#eadfd7] font-sans text-sm font-medium text-neutral-800 placeholder-neutral-400 bg-[#fcfaf8] hover:border-[#d8b9a5] focus:outline-none focus:border-[#FF6900] focus:bg-white focus:ring-4 focus:ring-[#FF6900]/10 transition-all box-border"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3.5 top-[calc(50%+0.5rem)] -translate-y-1/2 text-neutral-400 hover:text-[#a82c00] p-1 focus:outline-none transition-colors cursor-pointer"
                    aria-label="Toggle password visibility"
                  >
                    {showLoginPassword ? (
                      <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908a10.03 10.03 0 013.122-.563c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m-6.165-4.131a3 3 0 11-4.243-4.243M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </label>

                {/* Remember & Forgot Password */}
                <div className="flex justify-between items-center mb-4 text-xs">
                  <label className="flex items-center gap-2 text-neutral-600 cursor-pointer font-medium select-none">
                    <input
                      type="checkbox"
                      className="accent-[#FF6900] rounded cursor-pointer"
                    />
                    Remember me
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      setForgotError('');
                      setForgotSuccess('');
                      setForgotEmail(loginInput.includes('@') ? loginInput : '');
                      setShowForgotPasswordModal(true);
                    }}
                    className="text-[#a82c00] hover:text-[#711d00] font-bold transition-colors cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>
              </div>

              <div className="space-y-2.5 pt-2">
                <button
                  type="submit"
                  disabled={isLoginLoading}
                  className="w-full py-4 bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm tracking-wide rounded-xl shadow-lg shadow-orange-600/25 transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.99] cursor-pointer disabled:opacity-50"
                >
                  {isLoginLoading ? 'SIGNING IN...' : 'Log in'}
                </button>

                <p className="text-center text-xs text-neutral-400 font-medium pt-2">
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage('');
                      setSuccessMessage('');
                      setAuthMode('signup');
                    }}
                    className="text-[#a82c00] hover:text-[#711d00] font-bold transition-colors cursor-pointer"
                  >
                    Sign Up
                  </button>
                </p>
              </div>
            </form>
          )}

          {/* VIEW 3: SIGN UP FORM */}
          {authMode === 'signup' && (
            <form id="register-form" onSubmit={handleRegister} className="login-form-content max-w-md w-full mx-auto flex flex-col justify-center my-auto">
              <div>
                <div className="flex items-center mb-3">
                  <button
                    type="button"
                    onClick={returnToWelcome}
                    className="inline-flex items-center gap-1 text-xs font-bold text-neutral-400 hover:text-neutral-700 transition-colors cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                    </svg>
                    Back
                  </button>
                </div>

                <div className="mb-3">
                  <h2 className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight">
                    Join the feast
                  </h2>
                  <p className="text-xs text-neutral-500 font-medium mt-0.5">
                    Set up your profile to make ordering easier.
                  </p>
                  <p className="text-[11px] font-medium text-neutral-400 mt-1">
                    <span className="font-bold text-[#a82c00]">*</span> Email and phone number are required.
                  </p>
                </div>

                {/* Name inputs */}
                <div className="grid grid-cols-2 gap-2 mb-2.5">
                  <input
                    type="text"
                    placeholder="First Name"
                    required
                    className="w-full py-3 px-3.5 rounded-xl border border-[#eadfd7] font-sans text-sm font-medium text-neutral-800 placeholder-neutral-400 bg-[#fcfaf8] hover:border-[#d8b9a5] focus:outline-none focus:border-[#FF6900] focus:bg-white focus:ring-4 focus:ring-[#FF6900]/10 transition-all box-border"
                    value={firstName}
                    onChange={(e) => handleFirstNameChange(e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Last Name"
                    required
                    className="w-full py-3 px-3.5 rounded-xl border border-[#eadfd7] font-sans text-sm font-medium text-neutral-800 placeholder-neutral-400 bg-[#fcfaf8] hover:border-[#d8b9a5] focus:outline-none focus:border-[#FF6900] focus:bg-white focus:ring-4 focus:ring-[#FF6900]/10 transition-all box-border"
                    value={lastName}
                    onChange={(e) => handleLastNameChange(e.target.value)}
                  />
                </div>

                {/* Username */}
                <div className="mb-2.5">
                  <input
                    type="text"
                    placeholder="Username"
                    value={username}
                    readOnly
                    className="w-full py-3 px-3.5 rounded-2xl border border-neutral-200 font-sans text-xs font-medium text-neutral-500 bg-neutral-100 cursor-not-allowed box-border"
                  />
                </div>

                {/* Email */}
                <div className="mb-2.5">
                  <label htmlFor="register-email" className="block mb-1.5 text-xs font-semibold text-neutral-700">
                    Email address <span className="text-[#a82c00]" aria-hidden="true">*</span>
                  </label>
                  <input
                    id="register-email"
                    type="email"
                    placeholder="you@example.com"
                    required
                    className="w-full py-3 px-3.5 rounded-xl border border-[#eadfd7] font-sans text-sm font-medium text-neutral-800 placeholder-neutral-400 bg-[#fcfaf8] hover:border-[#d8b9a5] focus:outline-none focus:border-[#FF6900] focus:bg-white focus:ring-4 focus:ring-[#FF6900]/10 transition-all box-border"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                {/* Phone */}
                <div className="mb-2.5">
                  <label htmlFor="register-phone" className="block mb-1.5 text-xs font-semibold text-neutral-700">
                    Phone number <span className="text-[#a82c00]" aria-hidden="true">*</span>
                  </label>
                  <input
                    id="register-phone"
                    type="tel"
                    placeholder="09XXXXXXXXX"
                    required
                    className="w-full py-3 px-3.5 rounded-xl border border-[#eadfd7] font-sans text-sm font-medium text-neutral-800 placeholder-neutral-400 bg-[#fcfaf8] hover:border-[#d8b9a5] focus:outline-none focus:border-[#FF6900] focus:bg-white focus:ring-4 focus:ring-[#FF6900]/10 transition-all box-border"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>

                {/* Password */}
                <div className="mb-2.5 relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password"
                    required
                    className="w-full py-3 pl-3.5 pr-10 rounded-xl border border-[#eadfd7] font-sans text-sm font-medium text-neutral-800 placeholder-neutral-400 bg-[#fcfaf8] hover:border-[#d8b9a5] focus:outline-none focus:border-[#FF6900] focus:bg-white focus:ring-4 focus:ring-[#FF6900]/10 transition-all box-border"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-[#a82c00] p-1 focus:outline-none transition-colors cursor-pointer"
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908a10.03 10.03 0 013.122-.563c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m-6.165-4.131a3 3 0 11-4.243-4.243M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>

                {/* Confirm Password */}
                <div className="mb-2.5 relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirm Password"
                    required
                    className="w-full py-3 pl-3.5 pr-10 rounded-xl border border-[#eadfd7] font-sans text-sm font-medium text-neutral-800 placeholder-neutral-400 bg-[#fcfaf8] hover:border-[#d8b9a5] focus:outline-none focus:border-[#FF6900] focus:bg-white focus:ring-4 focus:ring-[#FF6900]/10 transition-all box-border"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-[#a82c00] p-1 focus:outline-none transition-colors cursor-pointer"
                    aria-label="Toggle password visibility"
                  >
                    {showConfirmPassword ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908a10.03 10.03 0 013.122-.563c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m-6.165-4.131a3 3 0 11-4.243-4.243M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>

                {/* Terms and Conditions */}
                <div className="mb-4">
                  <label className="flex items-start gap-2 text-[11px] text-neutral-600 cursor-pointer font-medium leading-tight select-none">
                    <input
                      type="checkbox"
                      checked={termsAccepted}
                      onChange={(e) => setTermsAccepted(e.target.checked)}
                      className="accent-[#FF6900] rounded mt-0.5 cursor-pointer"
                      required
                    />
                    <span>
                      I agree to the{' '}
                      <button
                        type="button"
                        onClick={() => setShowTerms(true)}
                        className="text-[#a82c00] hover:text-[#711d00] font-bold underline cursor-pointer"
                      >
                        Terms and Conditions
                      </button>
                    </span>
                  </label>
                </div>
              </div>

              <div className="space-y-2.5 pt-1">
                <button
                  type="submit"
                  disabled={isRegisterLoading}
                  className="w-full py-4 bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm tracking-wide rounded-xl shadow-lg shadow-orange-600/25 transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.99] cursor-pointer disabled:opacity-50"
                >
                  {isRegisterLoading ? 'CREATING ACCOUNT...' : 'Sign Up'}
                </button>

                <p className="text-center text-xs text-neutral-400 font-medium pt-2">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage('');
                      setSuccessMessage('');
                      setAuthMode('login');
                    }}
                    className="text-[#a82c00] hover:text-[#711d00] font-bold transition-colors cursor-pointer"
                  >
                    Log in
                  </button>
                </p>
              </div>
            </form>
          )}
        </div>
        {authMode === 'signup' && heroPanel}
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
                  username and password.
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
                  className="px-5 py-2.5 bg-[#FF6900] hover:bg-[#a82c00] text-white rounded-xl font-semibold text-sm transition-colors"
                >
                  Close
                </button>
              </div>

            </div>
          </div>
        )}
        {/* Forgot Password Modal */}
        {showForgotPasswordModal && (
          <div className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-xs flex justify-center items-center p-4 animate-[fadeIn_0.2s_ease-out]">
            <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-neutral-100 p-7 sm:p-9 relative animate-[scaleUp_0.2s_ease-out] text-center">

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setShowForgotPasswordModal(false)}
                className="absolute top-5 right-5 text-neutral-400 hover:text-neutral-700 p-1.5 rounded-full hover:bg-neutral-100 transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <h3 className="text-xl font-bold text-neutral-900 mb-1">
                Reset Your Password
              </h3>
              <p className="text-xs text-neutral-500 mb-6">
                Enter your registered email address and we'll send you a link to reset your password.
              </p>

              {forgotError && (
                <div className="mb-4 py-2.5 px-3 rounded-xl bg-red-50 text-red-600 text-xs font-semibold border border-red-200/80 text-left">
                  {forgotError}
                </div>
              )}

              {forgotSuccess && (
                <div className="mb-4 py-2.5 px-3 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200/80 text-left">
                  {forgotSuccess}
                </div>
              )}

              <form onSubmit={handleSendForgotPassword} className="text-left">
                <div className="mb-5">
                  <label className="block text-xs font-bold text-neutral-600 uppercase tracking-wider mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="Enter your registered email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="w-full py-3.5 px-4 rounded-xl border border-neutral-200 font-medium text-sm text-neutral-900 bg-neutral-50/80 focus:outline-none focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-500/10 transition-all box-border"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSendingForgot || !forgotEmail.trim()}
                  className="w-full py-3.5 bg-[#FF6900] hover:bg-[#a82c00] text-white font-bold text-sm rounded-xl shadow-md transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isSendingForgot ? 'SENDING RESET LINK...' : 'SEND RESET LINK'}
                </button>
              </form>

            </div>
          </div>
        )}

        {/* 6-Digit Email Verification OTP Modal */}
        {showOtpModal && (
          <div className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-xs flex justify-center items-center p-4 animate-[fadeIn_0.2s_ease-out]">
            <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-neutral-100 p-7 sm:p-9 relative animate-[scaleUp_0.2s_ease-out] text-center">

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setShowOtpModal(false)}
                className="absolute top-5 right-5 text-neutral-400 hover:text-neutral-700 p-1.5 rounded-full hover:bg-neutral-100 transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <h3 className="text-xl font-bold text-neutral-900 mb-1">
                Enter Verification Code
              </h3>
              <p className="text-xs text-neutral-500 mb-6">
                We sent a 6-digit code to <strong className="text-neutral-800 font-semibold">{email}</strong>
              </p>

              {otpError && (
                <div className="mb-4 py-2.5 px-3 rounded-xl bg-red-50 text-red-600 text-xs font-semibold border border-red-200/80">
                  {otpError}
                </div>
              )}

              {/* 6-Slot Digit Input Boxes */}
              <div className="flex justify-center gap-2 mb-6" onPaste={handleOtpPaste}>
                {otpDigits.map((digit, index) => (
                  <input
                    key={index}
                    id={`otp-slot-${index}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    className="w-11 h-14 text-center text-xl font-bold text-neutral-800 bg-neutral-50/80 border border-neutral-200 rounded-xl focus:outline-none focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-500/10 transition-all duration-200 shadow-2xs"
                  />
                ))}
              </div>

              <button
                type="button"
                disabled={isVerifyingOtp || otpDigits.join('').length < 6}
                onClick={() => handleVerifyOtp(otpDigits.join(''))}
                className="w-full py-3.5 bg-[#FF6900] hover:bg-[#a82c00] text-white font-bold text-sm rounded-xl shadow-md transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer mb-5"
              >
                {isVerifyingOtp ? 'Verifying Code...' : 'Verify & Continue'}
              </button>

              <div className="flex justify-between items-center text-xs text-neutral-500 font-medium px-1">
                <span>Didn't receive code?</span>
                {otpTimer > 0 ? (
                  <span className="text-neutral-400 font-medium">Resend in {otpTimer}s</span>
                ) : (
                  <button
                    type="button"
                    disabled={isSendingOtp}
                    onClick={handleResendOtp}
                    className="text-orange-600 font-bold hover:underline cursor-pointer"
                  >
                    {isSendingOtp ? 'Sending...' : 'Resend Code'}
                  </button>
                )}
              </div>

            </div>
          </div>
        )}
    </div>
  );
};

export default Login;