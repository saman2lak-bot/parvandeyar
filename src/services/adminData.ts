import { supabase } from '../lib/supabase';

export async function seedTestCases() {
  if (!supabase) throw new Error('اتصال به Supabase فعال نیست.');
  const { data, error } = await supabase.rpc('seed_test_cases', { requested_count: 50 });
  if (error) throw new Error(error.message || error.details || error.hint || 'ایجاد داده‌های تست انجام نشد.');
  return Number(data ?? 50);
}

export async function clearOperationalData() {
  if (!supabase) throw new Error('اتصال به Supabase فعال نیست.');
  const { data, error } = await supabase.rpc('clear_operational_data');
  if (error) throw new Error(error.message || error.details || error.hint || 'حذف داده‌های عملیاتی انجام نشد.');
  return Number(data ?? 0);
}
