import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getSession } from '../services/auth';
import { isSupabaseConfigured } from '../lib/supabase';

export default function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [authenticated, setAuthenticated] = useState(!isSupabaseConfigured);
  useEffect(() => { let alive = true; if (!isSupabaseConfigured) return; getSession().then(session => { if (alive) { setAuthenticated(Boolean(session)); setLoading(false); } }); return () => { alive = false; }; }, []);
  if (loading) return <div className="auth-loading" dir="rtl">در حال بررسی نشست کاربر...</div>;
  if (!authenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}
