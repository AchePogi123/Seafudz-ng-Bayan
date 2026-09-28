/**
 * Utility functions for handling cryptographic session tokens and RBAC role permissions.
 */

const SESSION_TOKEN_KEY = 'sfb_crypto_session_token';
const ACTIVE_USER_KEY = 'sfb_active_user_profile';

export type UserRole = 'admin' | 'cashier' | 'kitchen' | 'rider' | 'assistant' | 'customer';

export interface UserProfile {
  id?: string;
  fullname?: string;
  username?: string;
  email?: string;
  phone?: string;
  address?: string;
  role: UserRole | string;
  sessionToken?: string;
  type?: string;
}

/**
 * Role Permission Matrix for Frontend Routes
 */
export const ROLE_ROUTE_PERMISSIONS: Record<string, string[]> = {
  admin: [
    '/admin-dashboard',
    '/admin-sales-report',
    '/admin-customers',
    '/users',
    '/dashboard',
    '/pos',
    '/sales-report',
    '/kitchen',
    '/assistant',
    '/rider',
    '/customer',
    '/customer-dashboard',
    '/account',
    '/about',
  ],
  cashier: ['/pos', '/sales-report', '/customer', '/customer-dashboard', '/account', '/about'],
  kitchen: ['/kitchen', '/account', '/about'],
  rider: ['/rider', '/account', '/about'],
  assistant: ['/assistant', '/account', '/about'],
  customer: ['/customer', '/customer-dashboard', '/account', '/about'],
};

/**
 * Default fallback route by role
 */
export const ROLE_DEFAULT_ROUTES: Record<string, string> = {
  admin: '/admin-dashboard',
  cashier: '/pos',
  kitchen: '/kitchen',
  rider: '/rider',
  assistant: '/assistant',
  customer: '/customer',
};

/**
 * Extracts session_token or token query parameter from current URL window location
 */
export function getSessionTokenFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  return params.get('session_token') || params.get('token');
}

/**
 * Stores the session hash token in sessionStorage and localStorage
 */
export function saveSessionToken(token: string): void {
  if (typeof window !== 'undefined' && token) {
    try {
      sessionStorage.setItem(SESSION_TOKEN_KEY, token);
      localStorage.setItem(SESSION_TOKEN_KEY, token);
      localStorage.setItem('seafudz_token', token);
    } catch { }
  }
}

/**
 * Stores active user profile in sessionStorage and localStorage
 */
export function saveActiveUser(user: UserProfile): void {
  if (typeof window !== 'undefined' && user) {
    try {
      const userStr = JSON.stringify(user);
      sessionStorage.setItem(ACTIVE_USER_KEY, userStr);
      localStorage.setItem(ACTIVE_USER_KEY, userStr);
      localStorage.setItem('seafudz_user', userStr);
    } catch { }
    if (user.sessionToken) {
      saveSessionToken(user.sessionToken);
    }
  }
}

export function isUuidString(str?: string): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str.trim());
}

/**
 * Checks token timestamp expiration (24h validity window)
 */
export function isTokenExpired(token: string): boolean {
  if (!token) return true;
  try {
    const payloadPart = token.split('.')[0];
    if (!payloadPart) return true;
    let base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) {
      base64 += '=';
    }
    const decoded = typeof atob === 'function' ? atob(base64) : '';
    if (!decoded) return true;
    const parsed = JSON.parse(decoded);
    if (!parsed || typeof parsed.ts !== 'number') return false;
    const age = Date.now() - parsed.ts;
    return age > 24 * 60 * 60 * 1000 || age < -60000;
  } catch {
    return true;
  }
}

/**
 * Parses JWT / base64 payload from token string
 */
export function parseTokenPayload(token: string): UserProfile | null {
  if (!token) return null;
  try {
    if (isTokenExpired(token)) return null;

    const payloadPart = token.split('.')[0];
    if (!payloadPart) return null;
    let base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) {
      base64 += '=';
    }
    const decoded = typeof atob === 'function' ? atob(base64) : '';
    if (decoded) {
      const parsed = JSON.parse(decoded);
      if (parsed && typeof parsed === 'object') {
        const normRole = (parsed.role || 'customer').toLowerCase();
        const rawName = parsed.fullname || parsed.username || '';
        const cleanName = (rawName && !isUuidString(rawName))
          ? rawName
          : (parsed.email ? parsed.email.split('@')[0] : 'Customer');

        return {
          id: parsed.userId || parsed.id || 'user',
          fullname: cleanName,
          username: parsed.username && !isUuidString(parsed.username) ? parsed.username : (parsed.email ? parsed.email.split('@')[0] : 'user'),
          email: parsed.email || undefined,
          role: normRole,
          sessionToken: token,
        };
      }
    }
  } catch (err) {
    console.warn('Could not parse session token payload:', err);
  }
  return null;
}

/**
 * Retrieves active user profile from sessionStorage or localStorage
 */
export function getActiveUser(): UserProfile | null {
  if (typeof window === 'undefined') return null;

  let userFromStorage: UserProfile | null = null;

  // 1. Check sessionStorage (unique to each browser tab)
  try {
    const sessionStored = sessionStorage.getItem(ACTIVE_USER_KEY);
    if (sessionStored) {
      const parsed = JSON.parse(sessionStored) as UserProfile;
      if (parsed && parsed.role) {
        if (parsed.sessionToken && isTokenExpired(parsed.sessionToken)) {
          clearSession();
          return null;
        }
        userFromStorage = parsed;
      }
    }
  } catch { }

  // 2. Check localStorage (browser-wide fallback)
  if (!userFromStorage) {
    try {
      const localStored = localStorage.getItem(ACTIVE_USER_KEY) || localStorage.getItem('seafudz_user');
      if (localStored) {
        const parsed = JSON.parse(localStored) as UserProfile;
        if (parsed && parsed.role) {
          if (parsed.sessionToken && isTokenExpired(parsed.sessionToken)) {
            clearSession();
            return null;
          }
          userFromStorage = parsed;
        }
      }
    } catch { }
  }

  if (userFromStorage) return userFromStorage;

  // 3. Token fallback from stored session token
  const token = getStoredSessionToken();
  if (token) {
    const parsed = parseTokenPayload(token);
    if (parsed) {
      try {
        sessionStorage.setItem(ACTIVE_USER_KEY, JSON.stringify(parsed));
      } catch { }
      return parsed;
    }
  }
  return null;
}

/**
 * Clears user session
 */
export function clearSession(): void {
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.removeItem(SESSION_TOKEN_KEY);
      sessionStorage.removeItem(ACTIVE_USER_KEY);
      localStorage.removeItem(SESSION_TOKEN_KEY);
      localStorage.removeItem(ACTIVE_USER_KEY);
      localStorage.removeItem('seafudz_user');
      localStorage.removeItem('seafudz_token');
      localStorage.removeItem('seafudz_active_online_order');
    } catch { }
  }
}

/**
 * Retrieves the currently active session hash token
 */
export function getStoredSessionToken(): string | null {
  if (typeof window === 'undefined') return null;
  const token =
    sessionStorage.getItem(SESSION_TOKEN_KEY) ||
    localStorage.getItem(SESSION_TOKEN_KEY) ||
    localStorage.getItem('seafudz_token');
  if (token && isTokenExpired(token)) {
    clearSession();
    return null;
  }
  return token;
}

/**
 * Generates client-side hash token fallback if offline
 */
export function generateClientHashToken(
  userId: string = 'user',
  role: string = 'customer',
  extraData: Partial<UserProfile> = {}
): string {
  const timestamp = Date.now();
  const nonce = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  const fakeHash = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

  const payloadObj = {
    userId: userId.slice(0, 16),
    fullname: extraData.fullname || userId,
    email: extraData.email || null,
    role: role || 'customer',
    ts: timestamp,
    nonce,
  };

  const payloadEncoded =
    typeof btoa === 'function'
      ? btoa(JSON.stringify(payloadObj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
      : 'eyJ1c2VySWQiOiJ1c2VyIiwidHMiOjF9';

  return `${payloadEncoded}.${fakeHash}`;
}

/**
 * Clean URL navigation without exposing tokens in query parameters
 */
export function buildTokenizedUrl(path: string, _token?: string): string {
  return path;
}

/**
 * Checks if a given role has permission to access a target path
 */
export function hasRoutePermission(role: string | undefined, path: string): boolean {
  const normRole = (role || 'customer').toLowerCase();
  const allowedPaths = ROLE_ROUTE_PERMISSIONS[normRole] || ROLE_ROUTE_PERMISSIONS['customer'];
  return allowedPaths.some((p) => path.startsWith(p));
}

export default {
  getSessionTokenFromUrl,
  saveSessionToken,
  saveActiveUser,
  parseTokenPayload,
  getActiveUser,
  clearSession,
  getStoredSessionToken,
  generateClientHashToken,
  buildTokenizedUrl,
  hasRoutePermission,
  isTokenExpired,
  ROLE_ROUTE_PERMISSIONS,
  ROLE_DEFAULT_ROUTES,
};
