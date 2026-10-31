import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AUTH_SESSION_EXPIRED_EVENT, supabase } from '../lib/supabase';

const SESSION_ERROR_TEXT = /jwt\s+expired|token\s+expired|invalid\s+jwt|session\s+expired/i;

type AuthEvent = string;

/** Keeps every protected route in sync when Supabase can no longer refresh a session. */
export default function AuthSessionGuard() {
  const navigate = useNavigate();
  const location = useLocation();
  const handlingExpiry = useRef(false);

  useEffect(() => {
    const client = supabase;
    if (!client) return;

    const expireAndRedirect = async () => {
      if (handlingExpiry.current || location.pathname === '/login') return;
      handlingExpiry.current = true;
      try {
        await client.auth.signOut({ scope: 'local' });
      } finally {
        navigate('/login', {
          replace: true,
          state: { from: `${location.pathname}${location.search}` },
        });
        handlingExpiry.current = false;
      }
    };

    const onAuthStateChange = (event: AuthEvent, session: unknown) => {
      if (event === 'TOKEN_REFRESH_FAILED' || (event === 'SIGNED_OUT' && !session)) {
        void expireAndRedirect();
      }
    };
    const onSessionExpired = () => void expireAndRedirect();

    const { data } = client.auth.onAuthStateChange(onAuthStateChange);
    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, onSessionExpired);
    return () => {
      data.subscription.unsubscribe();
      window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, onSessionExpired);
    };
  }, [location.pathname, location.search, navigate]);

  // Also exposes a small reusable check for errors that are handled by callers.
  useEffect(() => {
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const message = event.reason instanceof Error ? event.reason.message : String(event.reason ?? '');
      if (SESSION_ERROR_TEXT.test(message)) void supabase?.auth.signOut({ scope: 'local' });
    };
    window.addEventListener('unhandledrejection', onUnhandledRejection);
    return () => window.removeEventListener('unhandledrejection', onUnhandledRejection);
  }, []);

  return null;
}
