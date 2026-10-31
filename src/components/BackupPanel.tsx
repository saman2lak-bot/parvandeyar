import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { AlertTriangle, CheckCircle2, DatabaseBackup, Download, FileJson, HardDriveDownload, History, Loader2, RotateCcw, ShieldCheck, Upload, X } from 'lucide-react';
import type { Case } from '../lib/demoData';
import type { ExpertRecord } from '../services/directory';
import { LAST_BACKUP_KEY, clearDemoSnapshot, createDemoBackup, createSupabaseBackup, hasDemoSnapshot, restoreSupabaseBackup, saveDemoSnapshot, validateBackup, type BackupDocument } from '../services/backup';
import { toPersianDigits } from '../lib/format';

type PendingBackup = { document: BackupDocument; fileName: string; size: number };
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const stamp = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString('fa-IR', { dateStyle: 'medium', timeStyle: 'short' });
};

const fileNameFor = (iso: string) => {
  const date = new Date(iso);
  const part = (value: number) => String(value).padStart(2, '0');
  return `parvandeyar-backup-${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}-${part(date.getHours())}${part(date.getMinutes())}.json`;
};

export default function BackupPanel({ demo, canRestore, demoCases, demoExperts, onRestored }: {
  demo: boolean;
  canRestore: boolean;
  demoCases: Case[];
  demoExperts: ExpertRecord[];
  onRestored?: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [pending, setPending] = useState<PendingBackup | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [lastBackupAt, setLastBackupAt] = useState(() => localStorage.getItem(LAST_BACKUP_KEY) ?? '');
  const [demoRestored, setDemoRestored] = useState(() => demo && hasDemoSnapshot());

  const preview = useMemo(() => pending ? {
    experts: pending.document.experts.length,
    cases: pending.document.cases.length,
    deficiencies: pending.document.deficiencies.length,
    createdAt: stamp(pending.document.createdAt),
    source: pending.document.source === 'supabase' ? 'فضای کاری متصل' : 'حالت نمایشی',
    size: `${(pending.size / 1024).toFixed(1)} کیلوبایت`,
  } : null, [pending]);

  const createBackup = async () => {
    if (creating) return;
    setCreating(true);
    setError('');
    setNotice('');
    try {
      const document = demo ? createDemoBackup(demoCases, demoExperts) : await createSupabaseBackup();
      const url = URL.createObjectURL(new Blob([JSON.stringify(document, null, 2)], { type: 'application/json' }));
      const anchor = window.document.createElement('a');
      anchor.href = url;
      anchor.download = fileNameFor(document.createdAt);
      window.document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      localStorage.setItem(LAST_BACKUP_KEY, document.createdAt);
      setLastBackupAt(document.createdAt);
      setNotice(`فایل پشتیبان با ${toPersianDigits(document.cases.length)} پرونده و ${toPersianDigits(document.deficiencies.length)} نقص ساخته و دانلود شد.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تهیه فایل پشتیبان انجام نشد.');
    } finally {
      setCreating(false);
    }
  };

  const readFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || restoring) return;
    setError('');
    setNotice('');
    if (file.size > MAX_FILE_SIZE) { setError('حجم فایل پشتیبان بیش از ۱۰ مگابایت است.'); return; }
    try {
      const document = validateBackup(JSON.parse((await file.text()).replace(/^\uFEFF/, '')));
      if (!demo && document.source === 'demo') {
        setError('این پشتیبان از حالت نمایشی تهیه شده و قابل بازیابی در فضای کاری متصل نیست.');
        return;
      }
      setPending({ document, fileName: file.name, size: file.size });
    } catch (cause) {
      setPending(null);
      setError(cause instanceof SyntaxError ? 'فایل انتخاب‌شده یک فایل JSON معتبر نیست.' : cause instanceof Error ? cause.message : 'خواندن فایل پشتیبان انجام نشد.');
    }
  };

  const confirmRestore = async () => {
    if (!pending || restoring) return;
    setRestoring(true);
    setError('');
    setNotice('');
    try {
      if (demo) {
        saveDemoSnapshot(pending.document);
        setDemoRestored(true);
        setNotice(`داده‌های نمایشی از فایل «${pending.fileName}» بازگردانی شد. برای دیدن پرونده‌ها وارد صفحه پرونده‌ها شوید.`);
      } else {
        const result = await restoreSupabaseBackup(pending.document);
        setNotice(`بازیابی انجام شد: ${toPersianDigits(result.cases)} پرونده، ${toPersianDigits(result.deficiencies)} نقص و ${toPersianDigits(result.experts)} کارشناس.`);
      }
      setPending(null);
      onRestored?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'بازیابی پشتیبان انجام نشد.');
    } finally {
      setRestoring(false);
    }
  };

  const resetDemo = () => {
    clearDemoSnapshot();
    setDemoRestored(false);
    setPending(null);
    setError('');
    setNotice('داده‌های بازیابی‌شده حذف شد؛ پرونده‌های نمونه اولیه دوباره نمایش داده می‌شوند.');
    onRestored?.();
  };

  return (
    <section className="setting-card backup-card" aria-labelledby="backup-title">
      <div className="backup-head">
        <span className="backup-mark"><DatabaseBackup size={19} /></span>
        <div>
          <small>پشتیبان‌گیری داخلی</small>
          <b id="backup-title">پشتیبان‌گیری و بازیابی اطلاعات</b>
          <p>یک نسخه کامل از کارشناسان، پرونده‌ها و نواقص را در قالب فایل JSON ذخیره کنید و در صورت نیاز همان نسخه را بازگردانید.</p>
        </div>
        <span className={demo ? 'backup-badge gray' : 'backup-badge'}><ShieldCheck size={13} /> {demo ? 'حالت نمایشی' : 'ذخیره‌سازی متصل'}</span>
      </div>

      <div className="backup-stats">
        <div><FileJson size={15} /><span>پرونده‌های آماده پشتیبان</span><b>{demo ? toPersianDigits(demoCases.length) : 'از پایگاه داده'}</b></div>
        <div><History size={15} /><span>آخرین پشتیبان</span><b>{lastBackupAt ? stamp(lastBackupAt) : 'ثبت نشده'}</b></div>
        <div><ShieldCheck size={15} /><span>قالب فایل</span><b>JSON · نسخه ۱</b></div>
      </div>

      <div className="backup-actions">
        <button type="button" className="setting-action setting-action-primary" onClick={() => void createBackup()} disabled={creating || restoring}>
          {creating ? <Loader2 className="spin" size={14} /> : <HardDriveDownload size={14} />} {creating ? 'در حال تهیه فایل...' : 'تهیه و دانلود پشتیبان'}
        </button>
        <button type="button" className="setting-action backup-restore-trigger" onClick={() => { setError(''); setNotice(''); fileInputRef.current?.click(); }} disabled={!canRestore || restoring || creating}>
          <Upload size={14} /> انتخاب فایل برای بازیابی
        </button>
        <input ref={fileInputRef} type="file" accept="application/json,.json" className="backup-file-input" onChange={event => void readFile(event)} />
      </div>
      {!canRestore && <div className="backup-hint"><AlertTriangle size={13} /> بازیابی داده‌ها فقط با نقش مدیر سیستم انجام می‌شود.</div>}
      {demo && demoRestored && (
        <button type="button" className="backup-reset" onClick={resetDemo} disabled={restoring}>
          <RotateCcw size={12} /> بازگشت به پرونده‌های نمونه اولیه
        </button>
      )}

      {preview && pending && (
        <div className="backup-preview">
          <div className="backup-preview-head">
            <FileJson size={16} />
            <div><b>{pending.fileName}</b><small>{preview.size} · تهیه‌شده در {preview.createdAt} · {preview.source}</small></div>
            <button type="button" className="backup-dismiss" onClick={() => setPending(null)} disabled={restoring} aria-label="انصراف از بازیابی"><X size={14} /></button>
          </div>
          <div className="backup-preview-counts">
            <span>{toPersianDigits(preview.cases)} پرونده</span>
            <span>{toPersianDigits(preview.deficiencies)} نقص</span>
            <span>{toPersianDigits(preview.experts)} کارشناس</span>
          </div>
          <p className="backup-warning"><AlertTriangle size={13} /> رکوردهایی که شناسه یکسان دارند به‌روزرسانی می‌شوند و هیچ داده‌ای حذف نمی‌شود. پیش از بازیابی، از وضعیت فعلی یک پشتیبان بگیرید.</p>
          <div className="backup-actions">
            <button type="button" className="setting-action setting-action-danger" onClick={() => void confirmRestore()} disabled={restoring}>
              {restoring ? <Loader2 className="spin" size={14} /> : <Download size={14} />} {restoring ? 'در حال بازیابی...' : 'تأیید و بازیابی'}
            </button>
            <button type="button" className="setting-action" onClick={() => setPending(null)} disabled={restoring}>انصراف</button>
          </div>
        </div>
      )}

      {error && <div className="form-error">{error}</div>}
      {notice && <div className="form-success"><CheckCircle2 size={13} /> {notice}</div>}
    </section>
  );
}
