import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ClipboardList, Database, Loader2, LogOut, Menu, RefreshCw, Settings, ShieldCheck, Trash2, UserRoundPlus, UsersRound } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import BackupPanel from '../components/BackupPanel';
import { initialCases } from '../lib/demoData';
import { isSupabaseConfigured } from '../lib/supabase';
import { getCurrentUserRole, getSession, signOut, type UserRole } from '../services/auth';
import { fetchActivity, type ActivityLog } from '../services/activity';
import { createExpert, deleteExpert, fetchExpertCaseCounts, fetchExperts, type ExpertRecord } from '../services/directory';
import { normalizeDigits } from '../services/cases';
import { toPersianDigits } from '../lib/format';
import { clearOperationalData, seedTestCases } from '../services/adminData';
import { loadDemoSnapshot } from '../services/backup';

type PageType = 'experts' | 'activity' | 'settings';

const demoExperts: ExpertRecord[] = [
  { id: 'demo-1', full_name: 'سارا محمدی', phone: null, is_active: true },
  { id: 'demo-2', full_name: 'امیرحسین رضایی', phone: null, is_active: true },
  { id: 'demo-3', full_name: 'نگار احمدی', phone: null, is_active: true },
];

const demoCounts: Record<string, number> = { 'demo-1': 84, 'demo-2': 62, 'demo-3': 47 };

const actionLabels: Record<string, string> = {
  deficiency_resolved: 'یک نقص رفع شد',
  deficiency_reopened: 'یک نقص بازگشایی شد',
  deficiency_added: 'نقص جدید اضافه شد',
  deficiency_deleted: 'یک نقص حذف شد',
  case_created: 'پرونده جدید ثبت شد',
  case_updated: 'اطلاعات پرونده ویرایش شد',
  case_deleted: 'پرونده حذف شد',
  expert_assigned: 'کارشناس پرونده تغییر کرد',
  expert_created: 'کارشناس جدید اضافه شد',
  backup_restored: 'پشتیبان بازیابی شد',
};

const headings: Record<PageType, { title: string; description: string; icon: ReactNode }> = {
  experts: { title: 'مدیریت کارشناسان', description: 'کارشناسان فعال و تعداد پرونده‌های هرکدام', icon: <UsersRound /> },
  activity: { title: 'سوابق فعالیت', description: 'ردیابی تغییرات مهم انجام‌شده در پرونده‌ها', icon: <ClipboardList /> },
  settings: { title: 'تنظیمات', description: 'وضعیت اتصال، حساب کاربری و فضای کاری', icon: <Settings /> },
};

export default function SimplePage({ type }: { type: PageType }) {
  const demo = !isSupabaseConfigured;
  const navigate = useNavigate();
  const heading = headings[type];
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState('');
  const [experts, setExperts] = useState<ExpertRecord[]>(demo ? loadDemoSnapshot()?.experts ?? demoExperts : []);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>(demo ? 'admin' : 'user');
  const [reloadKey, setReloadKey] = useState(0);
  const [newExpertName, setNewExpertName] = useState('');
  const [newExpertPhone, setNewExpertPhone] = useState('');
  const [savingExpert, setSavingExpert] = useState(false);
  const [deletingExpert, setDeletingExpert] = useState<string | null>(null);
  const [expertNotice, setExpertNotice] = useState('');
  const [expertError, setExpertError] = useState('');
  const [dataAction, setDataAction] = useState<'seed' | 'clear' | null>(null);
  const [dataNotice, setDataNotice] = useState('');
  const [dataError, setDataError] = useState('');
  const [dark, setDark] = useState(() => localStorage.getItem('parvandeyar-theme') === 'dark');
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(isSupabaseConfigured);
    setError('');
    (async () => {
      if (!isSupabaseConfigured) return;
      try {
        if (type === 'experts') {
          const [list, caseCounts, currentRole] = await Promise.all([fetchExperts(), fetchExpertCaseCounts(), getCurrentUserRole().catch(() => 'user' as UserRole)]);
          if (!alive) return;
          setExperts(list ?? []);
          setCounts(caseCounts ?? {});
          setRole(currentRole);
        } else if (type === 'activity') {
          const logs = await fetchActivity();
          if (alive) setActivity(logs ?? []);
        } else {
          const [session, currentRole] = await Promise.all([getSession(), getCurrentUserRole()]);
          if (alive) {
            setEmail(session?.user.email ?? '');
            setRole(currentRole);
          }
        }
      } catch (cause) {
        if (alive) setError(cause instanceof Error ? cause.message : 'دریافت اطلاعات انجام نشد.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [type, reloadKey]);

  const logout = async () => { await signOut(); navigate('/login', { replace: true }); };
  const shownExperts = experts;
  const shownCounts = demo ? { ...demoCounts, ...counts } : counts;
  const canManageExperts = demo || role === 'admin';
  const canManageData = !demo && role === 'admin';
  const demoSavedCases = useMemo(() => demo ? loadDemoSnapshot()?.cases ?? initialCases : initialCases, [demo, reloadKey]);

  const runDataAction = async (action: 'seed' | 'clear') => {
    if (!canManageData || dataAction) return;
    if (action === 'clear' && !window.confirm('همه پرونده‌ها، نواقص، کارشناسان، سوابق فعالیت و تاریخچه حذف می‌شوند. اطلاعات ورود و پروفایل‌ها حفظ می‌شوند. ادامه می‌دهید؟')) return;
    setDataAction(action);
    setDataNotice('');
    setDataError('');
    try {
      const count = action === 'seed' ? await seedTestCases() : await clearOperationalData();
      setDataNotice(action === 'seed' ? `${toPersianDigits(count)} پرونده تست با موفقیت اضافه شد.` : `${toPersianDigits(count)} پرونده و داده عملیاتی حذف شد.`);
    } catch (cause) {
      setDataError(cause instanceof Error ? cause.message : 'خطای ناشناخته در عملیات روی داده‌ها.');
    } finally {
      setDataAction(null);
    }
  };

  const removeExpert = async (expert: ExpertRecord) => {
    if (!canManageExperts || deletingExpert) return;
    const assignedCount = shownCounts[expert.id] ?? 0;
    const message = assignedCount > 0
      ? `${expert.full_name} به ${toPersianDigits(assignedCount)} پرونده فعال متصل است. حذف مستقیم این کارشناس ممکن نیست؛ ابتدا کارشناس پرونده‌ها را تغییر دهید.`
      : `کارشناس «${expert.full_name}» حذف شود؟`;
    if (assignedCount > 0) {
      setExpertError(message);
      return;
    }
    if (!window.confirm(message)) return;
    setDeletingExpert(expert.id);
    setExpertError('');
    setExpertNotice('');
    try {
      await deleteExpert(expert.id);
      setExperts(list => list.filter(item => item.id !== expert.id));
      setCounts(current => { const next = { ...current }; delete next[expert.id]; return next; });
      setExpertNotice(`${expert.full_name} با موفقیت حذف شد.`);
    } catch (cause) {
      setExpertError(cause instanceof Error ? cause.message : 'حذف کارشناس انجام نشد.');
    } finally {
      setDeletingExpert(null);
    }
  };

  const submitExpert = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fullName = newExpertName.trim();
    const phone = normalizeDigits(newExpertPhone).replace(/[^\d+]/g, '');
    setExpertNotice('');
    setExpertError('');
    if (fullName.length < 3) {
      setExpertError('نام و نام خانوادگی کارشناس را کامل وارد کنید.');
      return;
    }
    if (shownExperts.some(item => item.full_name.trim() === fullName)) {
      setExpertError('کارشناسی با این نام از قبل ثبت شده است.');
      return;
    }
    setSavingExpert(true);
    try {
      const created = await createExpert({ fullName, phone: phone || undefined });
      setExperts(list => [created, ...list]);
      setCounts(current => ({ ...current, [created.id]: 0 }));
      setNewExpertName('');
      setNewExpertPhone('');
      setExpertNotice(`${created.full_name} با موفقیت به فهرست کارشناسان اضافه شد.`);
    } catch (cause) {
      setExpertError(cause instanceof Error ? cause.message : 'ثبت کارشناس انجام نشد.');
    } finally {
      setSavingExpert(false);
    }
  };

  return (
    <div className={dark ? 'app dark simple-shell' : 'app simple-shell'} dir="rtl">
      <Sidebar dark={dark} onToggleTheme={() => setDark(value => { const next = !value; localStorage.setItem('parvandeyar-theme', next ? 'dark' : 'light'); return next; })} open={menuOpen} onClose={() => setMenuOpen(false)} role={role} />
      {menuOpen && <div className="sidebar-scrim" onClick={() => setMenuOpen(false)} />}
      <main className="simple-main">
        <header>
          <button type="button" className="mobile" onClick={() => setMenuOpen(value => !value)} aria-label="باز کردن منو"><Menu /></button>
          <span>خانه　/　<b>{heading.title}</b></span>
          <span className="header-user">{email || (demo ? 'کاربر نمایشی' : '')}</span>
        </header>
        <div className="simple-page">
      <div className="simple-heading">
        <div>
          <div className="simple-icon">{heading.icon}</div>
          <h1>{heading.title}</h1>
          <p>{heading.description}</p>
        </div>
        <Link className="back-link" to="/"><ArrowRight size={16} /> بازگشت به داشبورد</Link>
      </div>


      {demo && <div className="load-note">این بخش در حالت نمایشی با داده‌های نمونه نمایش داده می‌شود؛ برای اتصال واقعی متغیرهای Supabase را تنظیم کنید.</div>}
      {error && <div className="load-note error-banner">دریافت اطلاعات ناموفق بود: {error} <button type="button" onClick={() => setReloadKey(key => key + 1)}><RefreshCw size={12} /> تلاش دوباره</button></div>}
      {loading && <div className="load-note"><Loader2 className="spin" size={14} /> در حال دریافت اطلاعات...</div>}

      {type === 'experts' && !loading && (
        <>
          {canManageExperts ? (
            <form className="expert-create" onSubmit={submitExpert}>
              <div className="expert-create-head">
                <span><UserRoundPlus size={17} /></span>
                <div>
                  <b>افزودن کارشناس</b>
                  <small>کارشناس جدید بلافاصله در فهرست و فرم ثبت پرونده قابل انتخاب است.</small>
                </div>
              </div>
              <div className="expert-create-fields">
                <label>نام و نام خانوادگی<input value={newExpertName} onChange={event => setNewExpertName(event.target.value)} placeholder="مثلاً مریم کاظمی" /></label>
                <label>شماره تماس (اختیاری)<input value={newExpertPhone} onChange={event => setNewExpertPhone(event.target.value)} placeholder="۰۹۱۲۱۲۳۴۵۶۷" inputMode="tel" /></label>
                <button type="submit" className="primary" disabled={savingExpert}>
                  {savingExpert ? <><Loader2 className="spin" size={15} /> در حال ثبت...</> : <><UserRoundPlus size={15} /> افزودن کارشناس</>}
                </button>
              </div>
              {expertError && <div className="form-error">{expertError}</div>}
              {expertNotice && <div className="form-success">{expertNotice}</div>}
            </form>
          ) : (
            <div className="load-note">افزودن کارشناس تنها توسط مدیر سیستم انجام می‌شود.</div>
          )}
          {shownExperts.length === 0
            ? <div className="empty-panel"><div><UsersRound /></div><h2>کارشناسی ثبت نشده است</h2><p>{canManageExperts ? 'با فرم بالا نخستین کارشناس را اضافه کنید.' : 'هنوز کارشناسی توسط مدیر سیستم اضافه نشده است.'}</p></div>
            : <div className="simple-grid">
                {shownExperts.map((expert, index) => (
                  <div className="expert-card" key={expert.id}>
                    <div className={'expert-avatar e' + (index % 3)}>{expert.full_name.slice(0, 1)}</div>
                    <div><b>{expert.full_name}</b><small>{expert.phone ? toPersianDigits(expert.phone) : 'کارشناس پرونده‌ها'}</small></div>
                    <span className="active-dot">{expert.is_active ? 'فعال' : 'غیرفعال'}</span>
                    <strong>{toPersianDigits(shownCounts[expert.id] ?? 0)} پرونده</strong>
                    {canManageExperts && <button
                      type="button"
                      className="expert-delete"
                      onClick={() => void removeExpert(expert)}
                      disabled={deletingExpert !== null || savingExpert}
                      aria-label={`حذف کارشناس ${expert.full_name}`}
                      title="حذف کارشناس"
                    >
                      {deletingExpert === expert.id ? <Loader2 className="spin" size={13} /> : <Trash2 size={13} />}
                    </button>}
                  </div>
                ))}
              </div>}
        </>
      )}

      {type === 'activity' && !loading && (
        demo || activity.length === 0
          ? <div className="empty-panel"><div><ClipboardList /></div><h2>هنوز فعالیتی ثبت نشده است</h2><p>{demo ? 'در حالت نمایشی سوابق واقعی ذخیره نمی‌شوند.' : 'پس از ثبت پرونده یا تغییر نواقص، سوابق در اینجا نمایش داده می‌شود.'}</p></div>
          : <div className="activity-feed">
              {activity.map(log => {
                const title = typeof log.details?.title === 'string' ? log.details.title : typeof log.details?.number === 'string' ? `پرونده ${log.details.number}` : '';
                return (
                  <div className="activity-row" key={log.id}>
                    <span className={'activity-icon ' + (log.action === 'deficiency_reopened' ? 'warn' : 'ok')}><ShieldCheck size={15} /></span>
                    <div>
                      <b>{actionLabels[log.action] ?? log.action}</b>
                      {title && <small>{title}</small>}
                    </div>
                    <time>{new Date(log.created_at).toLocaleString('fa-IR')}</time>
                  </div>
                );
              })}
            </div>
      )}

      {type === 'settings' && !loading && (
        <div className="settings-grid">
          <BackupPanel
            demo={demo}
            canRestore={role === 'admin'}
            demoCases={demoSavedCases}
            demoExperts={experts}
            onRestored={() => setReloadKey(key => key + 1)}
          />
          <div className="setting-card">
            <small>وضعیت اتصال</small>
            <b>{demo ? 'حالت نمایشی (بدون ذخیره‌سازی)' : 'متصل به Supabase'}</b>
            <p>{demo ? 'برای فعال‌سازی ذخیره‌سازی واقعی، VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY را تنظیم کنید.' : 'پرونده‌ها و نواقص مستقیماً در پایگاه داده ذخیره می‌شوند.'}</p>
          </div>
          <div className="setting-card">
            <small>حساب کاربری</small>
            <b>{email || (demo ? 'کاربر نمایشی' : '—')}</b>
            <p>نقش کاربر و دسترسی‌ها از جدول profiles و سیاست‌های RLS خوانده می‌شود.</p>
            <strong className="role-pill">{role === 'admin' ? 'مدیر سیستم' : 'کاربر عادی'}</strong>
          </div>
          {role === 'admin' && (
            <div className="setting-card data-tools-card">
              <small>ابزار داده‌های پرونده</small>
              <b>مدیریت داده‌های تست</b>
              <p>داده‌های تست فقط برای بررسی جدول پرونده‌ها هستند. عملیات حذف به پروفایل‌ها و اطلاعات ورود دست نمی‌زند.</p>
              <div className="data-actions">
                <button type="button" className="setting-action setting-action-primary" onClick={() => void runDataAction('seed')} disabled={!canManageData || dataAction !== null}>
                  <Database size={14} /> {dataAction === 'seed' ? 'در حال ایجاد...' : 'افزودن ۵۰ پرونده تست'}
                </button>
                <button type="button" className="setting-action setting-action-danger" onClick={() => void runDataAction('clear')} disabled={!canManageData || dataAction !== null}>
                  <Trash2 size={14} /> {dataAction === 'clear' ? 'در حال حذف...' : 'حذف داده‌های عملیاتی'}
                </button>
              </div>
              {dataError && <div className="form-error">{dataError}</div>}
              {dataNotice && <div className="form-success">{dataNotice}</div>}
            </div>
          )}
          <div className="setting-card">
            <small>نشست فعلی</small>
            <b>{role === 'admin' ? 'مدیر سیستم' : 'کاربر عادی'}</b>
            <p>با خروج از حساب، نشست Supabase پاک شده و به صفحه ورود هدایت می‌شوید.</p>
            <button type="button" className="setting-action" onClick={logout}><LogOut size={14} /> خروج از حساب</button>
          </div>
        </div>
      )}
        </div>
      </main>
    </div>
  );
}
