import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const isSupabaseConfigured = Boolean(url && key);

/** Event emitted when an API request proves that the local session is no longer valid. */
export const AUTH_SESSION_EXPIRED_EVENT = 'parvandeyar:auth-session-expired';

function isExpiredSessionResponse(response: Response, body: string) {
  return response.status === 401 && /jwt\s+expired|token\s+expired|invalid\s+jwt|session\s+expired/i.test(body);
}

/**
 * Supabase refreshes access tokens automatically. This fetch wrapper covers the
 * remaining case where a request still reaches the API with an expired JWT.
 */
async function authAwareFetch(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);
  if (response.status === 401) {
    const body = await response.clone().text().catch(() => '');
    if (isExpiredSessionResponse(response, body)) {
      window.dispatchEvent(new CustomEvent(AUTH_SESSION_EXPIRED_EVENT));
    }
  }
  return response;
}

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, key!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
      global: { fetch: authAwareFetch },
    })
  : null;
