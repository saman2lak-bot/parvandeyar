import { logActivity } from './activity';
import { supabase } from '../lib/supabase';
import type { Case, Deficiency } from '../lib/demoData';
import { toPersianDigits } from '../lib/format';

const expertColors = ['mint', 'peach', 'lavender', 'gray'];
const colorFor = (name: string) => expertColors[[...name].reduce((total, char) => total + char.charCodeAt(0), 0) % expertColors.length];

export function mapDatabaseCase(row: any): Case {
  const deficiencies: Deficiency[] = (row.case_deficiencies ?? []).map((item: any) => ({ id: item.id, title: item.title, resolved: Boolean(item.is_resolved), note: item.description ?? undefined }));
  const resolvedCount = deficiencies.filter(item => item.resolved).length;
  const completion = deficiencies.length ? Math.round((resolvedCount / deficiencies.length) * 100) : 100;
  const expert = row.experts?.full_name ?? '— بدون کارشناس —';
  const statusLabels: Record<string, string> = { completed: 'تکمیل شده', needs_review: 'نیازمند پیگیری', no_deficiencies: 'بدون نقص' };
  const fallbackStatus = deficiencies.length === 0 ? 'بدون نقص' : completion === 100 ? 'تکمیل شده' : resolvedCount > 0 ? 'در حال بررسی' : 'نیازمند پیگیری';
  const status = expert.includes('بدون کارشناس') ? 'بدون کارشناس' : statusLabels[row.status as string] ?? fallbackStatus;
  return {
    id: row.id,
    number: `${toPersianDigits(row.case_year)}-${toPersianDigits(row.case_number)}`, 
    name: row.insured_name,
    phone: toPersianDigits(row.phone ?? ''),
    description: row.description ?? undefined,
    expert,
    expertColor: expert.includes('بدون کارشناس') ? 'gray' : colorFor(expert),
    status,
    updated: new Date(row.updated_at ?? row.created_at ?? Date.now()).toLocaleString('fa-IR', { dateStyle: 'short', timeStyle: 'short' }),
    deficiencies,
    completion,
  };
}

const digits = (value: string | number) => String(value).replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
export const normalizeDigits = digits;

export async function createCase(input: { caseYear: number; caseNumber: number; insuredName: string; phone: string; expertId?: string; expertName?: string; description?: string }) {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const expertId = input.expertId && uuidPattern.test(input.expertId) ? input.expertId : null;
  if (!supabase) {
    // Demo mode: return a temporary record so the dashboard updates without a backend.
    return {
      id: `demo-${Date.now()}`,
      case_year: input.caseYear,
      case_number: input.caseNumber,
      insured_name: input.insuredName,
      phone: input.phone,
      description: input.description ?? null,
      expert_id: expertId,
      experts: input.expertName ? { full_name: input.expertName } : null,
      case_deficiencies: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
  const { data, error } = await supabase.from('cases').insert({ case_year: input.caseYear, case_number: input.caseNumber, insured_name: input.insuredName, phone: input.phone, expert_id: expertId, description: input.description || null }).select('*, experts(full_name)').single();
  if (error) throw new Error(error.code === '23505' ? 'این شماره پرونده در سال انتخابی قبلاً ثبت شده است.' : error.message);
  await logActivity({ action: 'case_created', caseId: data?.id ?? null, details: { number: `${input.caseYear}-${input.caseNumber}`, insuredName: input.insuredName } });
  return data;
}


export async function updateDeficiency(deficiency: Deficiency & { caseId?: string }, resolved: boolean) {
  if (!supabase) return;
  const { data: user } = await supabase.auth.getUser();
  const { error } = await supabase.from('case_deficiencies').update({ is_resolved: resolved, resolved_at: resolved ? new Date().toISOString() : null, resolved_by: resolved ? user.user?.id ?? null : null, updated_at: new Date().toISOString() }).eq('id', String(deficiency.id));
  if (error) throw error;
  await logActivity({ action: resolved ? 'deficiency_resolved' : 'deficiency_reopened', caseId: deficiency.caseId ?? null, details: { title: deficiency.title, deficiencyId: deficiency.id } });
}

export async function addDeficiency(input: { caseId: string; title: string; description?: string }) {
  if (!supabase) {
    // Demo mode: return a temporary record so the drawer updates without a backend.
    return { id: `demo-def-${Date.now()}`, title: input.title, description: input.description ?? null, is_resolved: false, case_id: input.caseId, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  }
  const { data, error } = await supabase.from('case_deficiencies').insert({ case_id: input.caseId, title: input.title, description: input.description || null }).select('*').single();
  if (error) throw error;
  await logActivity({ action: 'deficiency_added', caseId: input.caseId, details: { title: input.title } });
  return data;
}

export async function deleteDeficiency(deficiency: Deficiency & { caseId?: string }) {
  if (!supabase) return;
  const { error } = await supabase.from('case_deficiencies').delete().eq('id', String(deficiency.id));
  if (error) throw error;
  await logActivity({ action: 'deficiency_deleted', caseId: deficiency.caseId ?? null, details: { title: deficiency.title } });
}

export async function updateCase(input: { id: string; insuredName: string; phone: string; expertId?: string; description?: string }) {
  if (!supabase) return null;
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const expertId = input.expertId && uuidPattern.test(input.expertId) ? input.expertId : null;
  const { data, error } = await supabase.from('cases').update({ insured_name: input.insuredName, phone: input.phone, expert_id: expertId, description: input.description || null, updated_at: new Date().toISOString() }).eq('id', input.id).select('*, experts(full_name)').single();
  if (error) throw error;
  await logActivity({ action: 'case_updated', caseId: input.id, details: { insuredName: input.insuredName, expertId } });
  return data;
}

export async function softDeleteCase(caseId: string) {
  if (!supabase) return;
  const { error } = await supabase.from('cases').update({ deleted_at: new Date().toISOString() }).eq('id', caseId);
  if (error) throw error;
  await logActivity({ action: 'case_deleted', caseId, details: {} });
}

export async function fetchCases() {
  if (!supabase) return null;
  const { data, error } = await supabase.from('cases').select('*, experts(full_name), case_deficiencies(*)').is('deleted_at', null).order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}