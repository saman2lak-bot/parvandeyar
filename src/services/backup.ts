import { supabase } from '../lib/supabase';
import { logActivity } from './activity';
import type { Case, Deficiency } from '../lib/demoData';
import type { ExpertRecord } from './directory';
import { toPersianDigits } from '../lib/format';

export const BACKUP_FORMAT = 'parvande-yar-backup';
export const BACKUP_VERSION = 1;
export const DEMO_SNAPSHOT_KEY = 'parvandeyar-demo-snapshot';
export const LAST_BACKUP_KEY = 'parvandeyar-last-backup-at';

export type BackupDocument = {
  format: typeof BACKUP_FORMAT;
  version: number;
  createdAt: string;
  source: 'demo' | 'supabase';
  experts: Array<{ id: string; full_name: string; phone: string | null; is_active: boolean }>;
  cases: Array<Record<string, unknown>>;
  deficiencies: Array<Record<string, unknown>>;
};

export function createDemoBackup(cases: Case[], experts: ExpertRecord[]): BackupDocument {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    source: 'demo',
    experts,
    cases: cases.map(item => {
      const [year, number] = item.number.replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))).split('-');
      const expert = experts.find(candidate => candidate.full_name === item.expert);
      return { id: String(item.id), case_year: Number(year), case_number: Number(number), insured_name: item.name, phone: item.phone, expert_id: expert?.id ?? null, description: item.description ?? null, status: item.status, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), deleted_at: null };
    }),
    deficiencies: cases.flatMap(item => item.deficiencies.map(deficiency => ({ id: String(deficiency.id), case_id: String(item.id), title: deficiency.title, description: deficiency.note ?? null, is_resolved: deficiency.resolved, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), resolved_at: deficiency.resolved ? new Date().toISOString() : null, resolved_by: null }))),
  };
}

const PAGE_SIZE = 1000;

/** PostgREST returns at most 1000 rows per request, so backups page through every table. */
async function fetchAllRows(table: 'experts' | 'cases' | 'case_deficiencies', columns: string) {
  if (!supabase) throw new Error('اتصال به Supabase فعال نیست.');
  const rows: Array<Record<string, unknown>> = [];
  for (let from = 0; from < 500000; from += PAGE_SIZE) {
    const { data, error } = await supabase.from(table).select(columns).order('id').range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as unknown as Array<Record<string, unknown>>));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

export async function createSupabaseBackup(): Promise<BackupDocument> {
  if (!supabase) throw new Error('اتصال به Supabase فعال نیست.');
  const [experts, cases, deficiencies] = await Promise.all([
    fetchAllRows('experts', 'id, full_name, phone, is_active'),
    fetchAllRows('cases', 'id, case_year, case_number, insured_name, phone, expert_id, description, status, created_at, updated_at, deleted_at'),
    fetchAllRows('case_deficiencies', 'id, case_id, title, description, is_resolved, created_at, updated_at, resolved_at, resolved_by'),
  ]);
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    source: 'supabase',
    experts: experts as unknown as BackupDocument['experts'],
    cases,
    deficiencies,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }

export function validateBackup(value: unknown): BackupDocument {
  if (!isRecord(value) || value.format !== BACKUP_FORMAT || value.version !== BACKUP_VERSION || !Array.isArray(value.experts) || !Array.isArray(value.cases) || !Array.isArray(value.deficiencies)) throw new Error('فرمت فایل پشتیبان معتبر نیست یا با نسخه فعلی برنامه سازگار نیست.');
  const hasBadExpert = value.experts.some(item => !isRecord(item) || typeof item.id !== 'string' || typeof item.full_name !== 'string');
  const hasBadCase = value.cases.some(item => !isRecord(item) || typeof item.id !== 'string' || typeof item.insured_name !== 'string' || !Number.isFinite(Number(item.case_year)) || !Number.isFinite(Number(item.case_number)));
  const hasBadDeficiency = value.deficiencies.some(item => !isRecord(item) || typeof item.id !== 'string' || typeof item.case_id !== 'string' || typeof item.title !== 'string');
  if (hasBadExpert || hasBadCase || hasBadDeficiency) throw new Error('ساختار اطلاعات فایل پشتیبان ناقص است.');
  return value as unknown as BackupDocument;
}

const text = (value: unknown, fallback = '') => typeof value === 'string' ? value : fallback;
const nullableText = (value: unknown) => typeof value === 'string' && value ? value : null;
const timestamp = (value: unknown) => typeof value === 'string' && value ? value : new Date().toISOString();

export async function restoreSupabaseBackup(backup: BackupDocument) {
  if (!supabase) throw new Error('اتصال به Supabase فعال نیست.');
  const experts = backup.experts.map(item => ({ id: item.id, full_name: item.full_name.trim(), phone: item.phone || null, is_active: item.is_active !== false }));
  const cases = backup.cases.map(item => ({
    id: String(item.id),
    case_year: Number(item.case_year),
    case_number: Number(item.case_number),
    insured_name: text(item.insured_name),
    phone: text(item.phone),
    expert_id: nullableText(item.expert_id),
    description: nullableText(item.description),
    status: text(item.status, 'needs_review'),
    created_at: timestamp(item.created_at),
    updated_at: timestamp(item.updated_at),
    deleted_at: nullableText(item.deleted_at),
  }));
  // resolved_by points to auth.users, so it is cleared to avoid cross-project foreign-key failures.
  const deficiencies = backup.deficiencies.map(item => ({
    id: String(item.id),
    case_id: String(item.case_id),
    title: text(item.title),
    description: nullableText(item.description),
    is_resolved: item.is_resolved === true,
    created_at: timestamp(item.created_at),
    updated_at: timestamp(item.updated_at),
    resolved_at: nullableText(item.resolved_at),
    resolved_by: null,
  }));
  const expertIds = new Set(experts.map(item => item.id));
  cases.forEach(item => { if (item.expert_id && !expertIds.has(item.expert_id)) item.expert_id = null; });
  const caseIds = new Set(cases.map(item => item.id));
  const validDeficiencies = deficiencies.filter(item => caseIds.has(item.case_id));
  const upsert = async (table: 'experts' | 'cases' | 'case_deficiencies', rows: Array<Record<string, unknown>>) => {
    if (!rows.length) return;
    const { error } = await supabase!.from(table).upsert(rows, { onConflict: 'id' });
    if (!error) return;
    if (error.code === '23505') throw new Error('یکی از پرونده‌های فایل با شماره پرونده موجود در همان سال تداخل دارد؛ بازیابی متوقف شد.');
    if (error.code === '23503') throw new Error('برخی شناسه‌های کارشناس یا پرونده در فایل پشتیبان با این فضای کاری هم‌خوان نیستند؛ بازیابی متوقف شد.');
    if (error.code === '42501') throw new Error('دسترسی کافی برای بازیابی داده‌ها وجود ندارد؛ این عملیات فقط با نقش مدیر سیستم مجاز است.');
    throw new Error(error.message);
  };
  await upsert('experts', experts);
  await upsert('cases', cases);
  await upsert('case_deficiencies', validDeficiencies);
  await logActivity({ action: 'backup_restored', details: { experts: experts.length, cases: cases.length, deficiencies: validDeficiencies.length } }).catch(() => { /* auditing must not fail the restore */ });
  return { experts: experts.length, cases: cases.length, deficiencies: validDeficiencies.length };
}

const expertColors = ['mint', 'peach', 'lavender', 'gray'];
const colorFor = (name: string) => expertColors[[...name].reduce((total, char) => total + char.charCodeAt(0), 0) % expertColors.length];
const statusLabels: Record<string, string> = { completed: 'تکمیل شده', needs_review: 'نیازمند پیگیری', no_deficiencies: 'بدون نقص' };

function demoCasesFromBackup(backup: BackupDocument): Case[] {
  const expertNames = new Map(backup.experts.map(item => [item.id, item.full_name]));
  return backup.cases.filter(row => !row.deleted_at).map(row => {
    const deficiencies: Deficiency[] = backup.deficiencies
      .filter(item => String(item.case_id) === String(row.id))
      .map(item => ({ id: String(item.id), title: String(item.title ?? ''), resolved: item.is_resolved === true, note: typeof item.description === 'string' ? item.description : undefined }));
    const resolvedCount = deficiencies.filter(item => item.resolved).length;
    const completion = deficiencies.length ? Math.round((resolvedCount / deficiencies.length) * 100) : 100;
    const expert = expertNames.get(String(row.expert_id)) ?? '— بدون کارشناس —';
    const fallbackStatus = deficiencies.length === 0 ? 'بدون نقص' : completion === 100 ? 'تکمیل شده' : resolvedCount > 0 ? 'در حال بررسی' : 'نیازمند پیگیری';
    return {
      id: String(row.id),
      number: `${toPersianDigits(Number(row.case_year))}-${toPersianDigits(Number(row.case_number))}`,
      name: String(row.insured_name ?? ''),
      phone: toPersianDigits(String(row.phone ?? '')),
      description: typeof row.description === 'string' ? row.description : undefined,
      expert,
      expertColor: expert.includes('بدون کارشناس') ? 'gray' : colorFor(expert),
      status: expert.includes('بدون کارشناس') ? 'بدون کارشناس' : statusLabels[String(row.status)] ?? fallbackStatus,
      updated: new Date(String(row.updated_at ?? row.created_at ?? Date.now())).toLocaleString('fa-IR', { dateStyle: 'short', timeStyle: 'short' }),
      deficiencies,
      completion,
    };
  });
}

/** Demo mode keeps the restored snapshot in the browser so every page can read it. */
export function saveDemoSnapshot(backup: BackupDocument) {
  localStorage.setItem(DEMO_SNAPSHOT_KEY, JSON.stringify(backup));
}

export function hasDemoSnapshot() {
  return Boolean(localStorage.getItem(DEMO_SNAPSHOT_KEY));
}

export function clearDemoSnapshot() {
  localStorage.removeItem(DEMO_SNAPSHOT_KEY);
}

export function loadDemoSnapshot(): { cases: Case[]; experts: ExpertRecord[] } | null {
  try {
    const raw = localStorage.getItem(DEMO_SNAPSHOT_KEY);
    if (!raw) return null;
    const backup = validateBackup(JSON.parse(raw));
    return { cases: demoCasesFromBackup(backup), experts: backup.experts.map(item => ({ id: item.id, full_name: item.full_name, phone: item.phone ?? null, is_active: item.is_active !== false })) };
  } catch {
    return null;
  }
}

