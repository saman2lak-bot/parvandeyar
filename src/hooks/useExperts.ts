import { useEffect, useState } from 'react';
import { isSupabaseConfigured } from '../lib/supabase';
import { experts as demoExpertNames } from '../lib/demoData';
import { fetchExperts } from '../services/directory';
import { loadDemoSnapshot } from '../services/backup';

export type ExpertOption = { id: string; full_name: string };

const fallbackExperts: ExpertOption[] = demoExpertNames
  .filter(name => !name.includes('بدون کارشناس'))
  .map((name, index) => ({ id: `demo-${index + 1}`, full_name: name }));

/** Returns real experts when Supabase is configured, otherwise a demo list. */
export function useExperts() {
  const [experts, setExperts] = useState<ExpertOption[]>(() => loadDemoSnapshot()?.experts.map(item => ({ id: item.id, full_name: item.full_name })) ?? fallbackExperts);
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let alive = true;
    fetchExperts()
      .then(list => { if (alive && list) setExperts(list.map(item => ({ id: item.id, full_name: item.full_name }))); })
      .catch(() => { /* keep fallback list when experts cannot be loaded */ });
    return () => { alive = false; };
  }, []);
  return experts;
}
