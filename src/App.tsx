import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronDown, ClipboardCheck, Clock3, Files, Loader2, Menu, Plus, UserRound } from 'lucide-react';
import Sidebar from './components/Sidebar';
import CasesTable, { filterCases, type StatusFilter } from './components/CasesTable';
import DeficiencyDrawer from './components/DeficiencyDrawer';
import EditCaseDialog, { type CaseFormValues } from './components/EditCaseDialog';
import { NewCaseDialog } from './components/NewCaseDialog';
import { addDeficiency, deleteDeficiency, fetchCases, mapDatabaseCase, normalizeDigits, softDeleteCase, updateCase, updateDeficiency } from './services/cases';
import { useExperts } from './hooks/useExperts';
import { isSupabaseConfigured } from './lib/supabase';
import { initialCases, type Case, type Deficiency } from './lib/demoData';
import { loadDemoSnapshot } from './services/backup';
import { toPersianDigits } from './lib/format';
import { getCurrentUserRole, type UserRole } from './services/auth';

type Page = 'dashboard' | 'cases';

const openCount = (item: Case) => item.deficiencies.filter(deficiency => !deficiency.resolved).length;
const completionOf = (deficiencies: Deficiency[]) => deficiencies.length
  ? Math.round((deficiencies.filter(item => item.resolved).length / deficiencies.length) * 100)
  : 100;

function Stat({ icon, title, value, caption }: { icon: ReactNode; title: string; value: string; caption: string }) {
  return <div className="stat"><div>{icon}</div><span>{title}</span><b>{value}</b><small>{caption}</small></div>;
}

export default function App({ page = 'dashboard' }: { page?: Page }) {
  const demo = !isSupabaseConfigured;
  const [cases, setCases] = useState<Case[]>(() => isSupabaseConfigured ? initialCases : loadDemoSnapshot()?.cases ?? initialCases);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [drawer, setDrawer] = useState<Case | null>(null);
  const [editingCase, setEditingCase] = useState<Case | null>(null);
  const [savingId, setSavingId] = useState<string | number | null>(null);
  const [dark, setDark] = useState(() => localStorage.getItem('parvandeyar-theme') === 'dark');
  const [menuOpen, setMenuOpen] = useState(false);
  const [newCase, setNewCase] = useState(false);
  const [toast, setToast] = useState('');
  const [role, setRole] = useState<UserRole>(demo ? 'admin' : 'user');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const experts = useExperts();
  const canEditCase = demo || role === 'admin';
  const canDeleteDeficiency = demo || role === 'admin';
  const canDeleteCase = demo || role === 'admin';

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    try {
      const rows = await fetchCases();
      setCases((rows ?? []).map(mapDatabaseCase));
      setLoadError('');
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'دریافت پرونده‌ها انجام نشد.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    void getCurrentUserRole().then(setRole).catch(() => setRole('user'));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '');
      if (isTyping || event.ctrlKey || event.metaKey || event.altKey || !event.shiftKey) return;
      if (document.querySelector('.dialog-overlay, .drawer-layer')) return;
      // Physical key codes keep the shortcuts working on a Persian keyboard layout.
      if (event.code === 'KeyS') {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }
      if (event.code === 'KeyA') {
        event.preventDefault();
        setNewCase(true);
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  const toggleDeficiency = async (id: string | number) => {
    if (!drawer || savingId !== null) return;
    const current = drawer.deficiencies.find(item => item.id === id);
    if (!current) return;
    const previous = drawer;
    const nextResolved = !current.resolved;
    const deficiencies = drawer.deficiencies.map(item => item.id === id ? { ...item, resolved: nextResolved } : item);
    const next: Case = {
      ...drawer,
      deficiencies,
      completion: completionOf(deficiencies),
    };
    setSavingId(id);
    setDrawer(next);
    setCases(list => list.map(item => item.id === next.id ? next : item));
    try {
      await updateDeficiency({ ...current, caseId: String(drawer.id).startsWith('demo-') ? undefined : String(drawer.id) }, nextResolved);
      setToast(nextResolved ? 'نقص به عنوان رفع‌شده ثبت شد.' : 'وضعیت نقص به «در انتظار مدرک» بازگشت.');
    } catch {
      setDrawer(previous);
      setCases(list => list.map(item => item.id === previous.id ? previous : item));
      setToast('ذخیره تغییر انجام نشد؛ وضعیت قبلی بازگردانده شد.');
    } finally {
      setSavingId(null);
    }
  };

  /** Applies the same version of a case to the table and to the open drawer. */
  const patchCase = (target: Case, next: Case) => {
    setCases(list => list.map(item => item.id === target.id ? next : item));
    setDrawer(current => current && current.id === target.id ? next : current);
  };

  const handleAddDeficiency = async (title: string) => {
    if (!drawer) return false;
    const target = drawer;
    const tempId = `temp-${Date.now()}`;
    const deficiencies: Deficiency[] = [...target.deficiencies, { id: tempId, title, resolved: false }];
    const optimistic: Case = { ...target, deficiencies, completion: completionOf(deficiencies) };
    patchCase(target, optimistic);
    try {
      const created = await addDeficiency({ caseId: String(target.id), title });
      const rawId = created && typeof created === 'object' && 'id' in created ? (created as { id: string | number }).id : tempId;
      const savedId = String(rawId);
      const finalized: Case = { ...optimistic, deficiencies: optimistic.deficiencies.map(item => item.id === tempId ? { ...item, id: savedId } : item) };
      patchCase(optimistic, finalized);
      setToast('نقص جدید به پرونده اضافه شد.');
      return true;
    } catch (cause) {
      patchCase(optimistic, target);
      setToast(cause instanceof Error ? cause.message : 'افزودن نقص انجام نشد.');
      return false;
    }
  };

  const handleDeleteDeficiency = async (id: string | number) => {
    if (!drawer || savingId !== null || !canDeleteDeficiency) return;
    const target = drawer;
    const current = target.deficiencies.find(item => item.id === id);
    if (!current) return;
    const remaining = target.deficiencies.filter(item => item.id !== id);
    const optimistic: Case = { ...target, deficiencies: remaining, completion: completionOf(remaining) };
    setSavingId(id);
    patchCase(target, optimistic);
    try {
      await deleteDeficiency({ ...current, caseId: String(target.id).startsWith('demo-') ? undefined : String(target.id) });
      setToast('نقص از پرونده حذف شد.');
    } catch (cause) {
      patchCase(optimistic, target);
      setToast(cause instanceof Error ? cause.message : 'حذف نقص انجام نشد.');
    } finally {
      setSavingId(null);
    }
  };

  const saveCase = async (values: CaseFormValues) => {
    if (!editingCase || !canEditCase) return;
    const target = editingCase;
    const expertName = experts.find(item => item.id === values.expertId)?.full_name ?? '— بدون کارشناس —';
    const withoutExpert = expertName.includes('بدون کارشناس');
    const optimistic: Case = {
      ...target,
      name: values.insuredName.trim(),
      phone: toPersianDigits(normalizeDigits(values.phone)),
      expert: expertName,
      expertColor: withoutExpert ? 'gray' : target.expertColor === 'gray' ? 'mint' : target.expertColor,
      status: withoutExpert
        ? 'بدون کارشناس'
        : target.status === 'بدون کارشناس'
          ? (target.completion === 100 ? 'تکمیل شده' : 'در حال بررسی')
          : target.status,
      description: values.description?.trim() || undefined,
    };
    patchCase(target, optimistic);
    try {
      await updateCase({ id: String(target.id), insuredName: optimistic.name, phone: normalizeDigits(values.phone), expertId: values.expertId, description: values.description?.trim() || undefined });
      setEditingCase(null);
      setDrawer(null);
      setToast(demo ? 'تغییرات در حالت نمایشی اعمال شد (بدون ذخیره‌سازی).' : 'اطلاعات پرونده به‌روزرسانی شد.');
      if (!demo) await load();
    } catch (cause) {
      patchCase(optimistic, target);
      setToast(cause instanceof Error ? cause.message : 'ذخیره تغییرات انجام نشد.');
      throw cause;
    }
  };

  const deleteCase = async () => {
    if (!drawer || !canDeleteCase) return;
    const target = drawer;
    setCases(list => list.filter(item => item.id !== target.id));
    setDrawer(null);
    try {
      await softDeleteCase(String(target.id));
      setToast(demo ? 'پرونده از نمای نمایشی حذف شد (بدون ذخیره‌سازی).' : 'پرونده حذف شد.');
    } catch (cause) {
      setCases(list => [target, ...list.filter(item => item.id !== target.id)]);
      setToast(cause instanceof Error ? cause.message : 'حذف پرونده انجام نشد.');
    }
  };

  const handleCreated = (created: unknown) => {
    if (!created) {
      setToast('ثبت پرونده انجام نشد.');
      return;
    }
    const createdCase = mapDatabaseCase(created);
    setCases(list => [createdCase, ...list.filter(item => String(item.id) !== String(createdCase.id))]);
    setToast(demo ? 'پرونده در حالت نمایشی اضافه شد (بدون ذخیره‌سازی).' : 'پرونده جدید با موفقیت ثبت شد.');
  };

  const total = cases.length;
  const completed = cases.filter(item => item.completion === 100).length;
  const followUp = cases.filter(item => item.completion < 100).length;
  const withoutExpert = cases.filter(item => item.expert.includes('بدون کارشناس')).length;
  const percent = (value: number) => toPersianDigits(total ? Math.round((value / total) * 100) : 0);
  const followUpCases = filterCases(cases, '', 'open').slice(0, 3);
  const isCasesPage = page === 'cases';

  return (
    <div className={dark ? 'app dark' : 'app'} dir="rtl">
      <Sidebar dark={dark} onToggleTheme={() => setDark(value => { const next = !value; localStorage.setItem('parvandeyar-theme', next ? 'dark' : 'light'); return next; })} open={menuOpen} onClose={() => setMenuOpen(false)} role={role} />
      {menuOpen && <div className="sidebar-scrim" onClick={() => setMenuOpen(false)} />}
      <main>
        <header>
          <button type="button" className="mobile" onClick={() => setMenuOpen(value => !value)} aria-label="باز کردن منو"><Menu /></button>
          <span>خانه　/　<b>{isCasesPage ? 'پرونده‌ها' : 'داشبورد'}</b></span>
          <span className="header-user">روز بخیر {role === 'admin' ? 'مدیر سیستم' : 'کاربر عادی'} 👋</span>
        </header>
        <section className="content">
          <div className="title">
            <div>
              <h1>{isCasesPage ? 'پرونده‌ها' : 'داشبورد'}</h1>
              <p>{isCasesPage ? 'جست‌وجو، فیلتر و مدیریت سریع نواقص همه پرونده‌ها' : 'نمای کلی از وضعیت پرونده‌ها و فعالیت‌های اخیر شما'}</p>
            </div>
            <button type="button" className="primary new-case-button" onClick={() => setNewCase(true)}><Plus /> ثبت پرونده جدید <kbd>Shift + A</kbd></button>
          </div>

          {!isCasesPage && (
            <>
              {/* <div className="welcome">
                <b>✦　روز بخیر، مدیر سیستم 👋</b>
                <span>امروز <strong>{toPersianDigits(followUp)} پرونده</strong> نیاز به پیگیری دارند.</span>
                <small>آخرین بروزرسانی: همین حالا　 <b>مشاهده گزارش روزانه ←</b></small>
              </div> */}
              <div className="stats">
                <Stat icon={<Files />} title="کل پرونده‌ها" value={toPersianDigits(total)} caption={`${toPersianDigits(completed)} پرونده تکمیل شده`} />
                <Stat icon={<ClipboardCheck />} title="تکمیل‌شده" value={toPersianDigits(completed)} caption={`${percent(completed)}٪ از کل پرونده‌ها`} />
                <Stat icon={<Clock3 />} title="نیازمند پیگیری" value={toPersianDigits(followUp)} caption={`${percent(followUp)}٪ از کل پرونده‌ها`} />
                <Stat icon={<UserRound />} title="بدون کارشناس" value={toPersianDigits(withoutExpert)} caption="نیاز به تعیین مسئول" />
              </div>
              {/* <div className="columns">
                <div className="panel chart">
                  <h2>روند ثبت پرونده‌ها<small>تعداد پرونده‌های ثبت شده در ۶ ماه اخیر</small></h2>
                  <svg viewBox="0 0 600 180" preserveAspectRatio="none">
                    <path d="M0 130C60 125 70 145 130 95S190 120 250 80S300 130 370 65S430 90 480 55S550 20 600 35V180H0Z" fill="#35b6a522" />
                    <path d="M0 130C60 125 70 145 130 95S190 120 250 80S300 130 370 65S430 90 480 55S550 20 600 35" fill="none" stroke="#24a895" strokeWidth="3" />
                  </svg>
                  <small>آذر　　 دی　　 بهمن　　 اسفند　　 فروردین　　 اردیبهشت</small>
                </div>
                <div className="panel">
                  <h2>نیازمند پیگیری<small>پرونده‌هایی که باید بررسی شوند</small></h2>
                  {followUpCases.map(item => (
                    <button type="button" className="follow" key={item.id} onClick={() => setDrawer(item)}>
                      <Files />
                      <b>{item.number}<small>{item.name}</small></b>
                      <em>{toPersianDigits(openCount(item))} نقص باز</em>
                      <ChevronDown />
                    </button>
                  ))}
                  {followUpCases.length === 0 && <p className="panel-empty">{cases.length === 0 ? 'هنوز پرونده‌ای ثبت نشده است.' : 'همه پرونده‌ها تکمیل شده‌اند.'}</p>}
                  <Link className="all" to="/cases">مشاهده همه پرونده‌ها ←</Link>
                </div>
              </div> */}
            </>
          )}


          {(loadError || loading) && (
            <div className={loadError ? 'load-note error-banner' : 'load-note'}>
              {loadError
                ? <>دریافت اطلاعات از Supabase ناموفق بود: {loadError} <button type="button" onClick={() => void load()}>تلاش دوباره</button></>
                : <><Loader2 className="spin" size={14} /> در حال دریافت پرونده‌ها از Supabase...</>}
            </div>
          )}

          <CasesTable
            cases={cases}
            query={query}
            onQueryChange={setQuery}
            status={status}
            onStatusChange={setStatus}
            onOpen={setDrawer}
            loading={loading}
            title={isCasesPage ? 'همه پرونده‌ها' : 'آخرین پرونده‌ها'}
            subtitle={isCasesPage ? 'برای دیدن نواقص، روی ستون وضعیت نقص کلیک کنید' : 'نمایش آخرین پرونده‌های به‌روزرسانی شده'}
            searchInputRef={searchInputRef}
          />
        </section>
      </main>

      {drawer && (
        <DeficiencyDrawer
          data={drawer}
          onClose={() => setDrawer(null)}
          onToggle={toggleDeficiency}
          onAdd={handleAddDeficiency}
          onDelete={handleDeleteDeficiency}
          onEdit={() => { setDrawer(null); setEditingCase(drawer); }}
          onDeleteCase={deleteCase}
          canEditCase={canEditCase}
          canDeleteDeficiency={canDeleteDeficiency}
          canDeleteCase={canDeleteCase}
          savingId={savingId}
        />
      )}
      {editingCase && <EditCaseDialog data={editingCase} experts={experts} onClose={() => setEditingCase(null)} onSubmit={saveCase} />}
      {newCase && <NewCaseDialog onClose={() => setNewCase(false)} onCreated={handleCreated} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
