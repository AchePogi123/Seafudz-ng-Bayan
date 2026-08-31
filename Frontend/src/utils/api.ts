import { supabase } from './supabase';

export const API_BASE_URL = import.meta.env.VITE_GCP_API_URL || 'http://localhost:5000/api';

/**
 * Returns Authorization headers containing Supabase Bearer JWT token if user is signed in.
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
    }
  } catch (err) {
    console.warn('Failed to retrieve Supabase auth token:', err);
  }

  return headers;
}
