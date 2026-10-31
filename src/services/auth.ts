import { supabase } from '../lib/supabase';

export type UserRole = 'admin' | 'user';

export async function signOut() { if (supabase) await supabase.auth.signOut(); }
export async function getSession() { if (!supabase) return null; const { data } = await supabase.auth.getSession(); return data.session; }

export async function getCurrentUserRole(): Promise<UserRole> {
  if (!supabase) return 'admin';
  const session = await getSession();
  if (!session?.user.id) return 'user';
  const { data, error } = await supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle();
  if (error) throw error;
  return data?.role === 'admin' ? 'admin' : 'user';
}
