import { supabase } from '../lib/supabase';

export type ActivityLog = { id: string; action: string; details: Record<string, unknown>; created_at: string; case_id: string | null; user_id: string | null };

export async function logActivity(input: { action: string; caseId?: string | null; details?: Record<string, unknown> }) {
  if (!supabase) return;
  const { data } = await supabase.auth.getUser();
  const { error } = await supabase.from('activity_logs').insert({ user_id: data.user?.id ?? null, case_id: input.caseId ?? null, action: input.action, details: input.details ?? {} });
  if (error) throw error;
}

export async function fetchActivity(limit = 40) {
  if (!supabase) return null;
  const { data, error } = await supabase.from('activity_logs').select('id, action, details, created_at, case_id, user_id').order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return data as ActivityLog[];
}
