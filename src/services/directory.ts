import { supabase } from '../lib/supabase';
import { logActivity } from './activity';

export type ExpertRecord = { id: string; full_name: string; phone: string | null; is_active: boolean };

export async function fetchExperts() {
  if (!supabase) return null;
  const { data, error } = await supabase.from('experts').select('id, full_name, phone, is_active').order('full_name');
  if (error) throw error;
  return data as ExpertRecord[];
}

export async function createExpert(input: { fullName: string; phone?: string }) {
  const payload = { full_name: input.fullName.trim(), phone: input.phone?.trim() || null };
  if (!supabase) {
    // Demo mode: return a temporary record so the list updates without a backend.
    return { id: `demo-expert-${Date.now()}`, ...payload, is_active: true } as ExpertRecord;
  }
  const { data, error } = await supabase.from('experts').insert(payload).select('id, full_name, phone, is_active').single();
  if (error) throw new Error(error.message);
  await logActivity({ action: 'expert_created', details: { fullName: payload.full_name } }).catch(() => { /* activity log failure must not block expert creation */ });
  return data as ExpertRecord;
}

export async function deleteExpert(id: string) {
  if (!supabase) return;
  const { count, error: countError } = await supabase
    .from('cases')
    .select('id', { count: 'exact', head: true })
    .eq('expert_id', id)
    .is('deleted_at', null);
  if (countError) throw new Error(countError.message);
  if ((count ?? 0) > 0) throw new Error('این کارشناس به پرونده فعال متصل است؛ ابتدا کارشناس پرونده‌ها را تغییر دهید.');
  const { error } = await supabase.from('experts').delete().eq('id', id);
  if (error) throw new Error(error.message);
  await logActivity({ action: 'expert_deleted', details: { expertId: id } }).catch(() => { /* activity log failure must not block deletion */ });
}

export async function fetchExpertCaseCounts() {
  if (!supabase) return null;
  const { data, error } = await supabase.from('cases').select('expert_id').is('deleted_at', null);
  if (error) throw error;
  return (data ?? []).reduce<Record<string, number>>((counts, row) => {
    if (row.expert_id) counts[row.expert_id] = (counts[row.expert_id] ?? 0) + 1;
    return counts;
  }, {});
}
