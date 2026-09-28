import { supabase } from './supabase';

export const API_BASE_URL = import.meta.env.VITE_GCP_API_URL || 'http://localhost:5000/api';

/**
 * Returns Authorization headers containing Supabase Bearer JWT token or stored Session token.
 */
export async function getAuthHeaders(extraHeaders: Record<string, string> = {}): Promise<HeadersInit> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  };

  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      return headers;
    }
  } catch (err) {
    console.warn('Failed to retrieve Supabase auth token:', err);
  }

  // Fallback to stored cryptographic session token
  if (typeof window !== 'undefined') {
    const storedToken =
      sessionStorage.getItem('sfb_crypto_session_token') ||
      localStorage.getItem('sfb_crypto_session_token') ||
      localStorage.getItem('seafudz_token');
    if (storedToken) {
      headers['Authorization'] = `Bearer ${storedToken}`;
    }
  }

  return headers;
}
