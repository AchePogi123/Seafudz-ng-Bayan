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
  role: UserRole | string;
  sessionToken?: string;
  type?: string;
}

/**
 * Role Permission Matrix for Frontend Routes
 */
export const ROLE_ROUTE_PERMISSIONS: Record<string, string[]> = {
  admin: ['/dashboard', '/users', '/pos', '/sales-report', '/kitchen', '/assistant', '/rider', '/customer', '/account', '/about'],
  cashier: ['/pos', '/sales-report', '/customer', '/account', '/about'],
  kitchen: ['/kitchen', '/account', '/about'],
  rider: ['/rider', '/account', '/about'],
  assistant: ['/assistant', '/account', '/about'],
  customer: ['/customer', '/account', '/about'],
};

/**
 * Default fallback route by role
 */
export const ROLE_DEFAULT_ROUTES: Record<string, string> = {
  admin: '/dashboard',
  cashier: '/sales-report',
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
 * Stores the session hash token in sessionStorage
 */
export function saveSessionToken(token: string): void {
  if (typeof window !== 'undefined' && token) {
    sessionStorage.setItem(SESSION_TOKEN_KEY, token);
  }
}

/**
 * Stores active user profile in sessionStorage
 */
export function saveActiveUser(user: UserProfile): void {
  if (typeof window !== 'undefined' && user) {
    sessionStorage.setItem(ACTIVE_USER_KEY, JSON.stringify(user));
    if (user.sessionToken) {
      saveSessionToken(user.sessionToken);
    }
  }
}

/**
 * Retrieves active user profile from sessionStorage
 */
export function getActiveUser(): UserProfile | null {
  if (typeof window === 'undefined') return null;
  const stored = sessionStorage.getItem(ACTIVE_USER_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as UserProfile;
  } catch {
    return null;
  }
}

/**
 * Clears user session
 */
export function clearSession(): void {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
    sessionStorage.removeItem(ACTIVE_USER_KEY);
  }
}

/**
 * Retrieves the currently active session hash token
 */
export function getStoredSessionToken(): string | null {
  if (typeof window === 'undefined') return null;
  return getSessionTokenFromUrl() || sessionStorage.getItem(SESSION_TOKEN_KEY);
}

/**
 * Generates client-side hash token fallback if offline
 */
export function generateClientHashToken(userId: string = 'user'): string {
  const timestamp = Date.now();
  const nonce = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  const fakeHash = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  
  const payloadObj = {
    userId: userId.slice(0, 16),
    email: null,
    role: 'customer',
    ts: timestamp,
    nonce,
  };
  
  const payloadEncoded = typeof btoa === 'function'
    ? btoa(JSON.stringify(payloadObj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    : 'eyJ1c2VySWQiOiJ1c2VyIiwidHMiOjF9';

  return `${payloadEncoded}.${fakeHash}`;
}

/**
 * Appends session_token to a target route path
 */
export function buildTokenizedUrl(path: string, token: string): string {
  if (!token) return path;
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}session_token=${encodeURIComponent(token)}`;
}

/**
 * Checks if a given role has permission to access a target path
 */
export function hasRoutePermission(role: string | undefined, path: string): boolean {
  const normRole = (role || 'customer').toLowerCase();
  const allowedPaths = ROLE_ROUTE_PERMISSIONS[normRole] || ROLE_ROUTE_PERMISSIONS['customer'];
  return allowedPaths.some(p => path.startsWith(p));
}

export default {
  getSessionTokenFromUrl,
  saveSessionToken,
  saveActiveUser,
  getActiveUser,
  clearSession,
  getStoredSessionToken,
  generateClientHashToken,
  buildTokenizedUrl,
  hasRoutePermission,
  ROLE_ROUTE_PERMISSIONS,
  ROLE_DEFAULT_ROUTES,
};
