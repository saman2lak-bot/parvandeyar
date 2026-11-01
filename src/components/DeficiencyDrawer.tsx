import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Archive, ArchiveRestore, Check, Files, Loader2, Lock, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { Case } from '../lib/demoData';
import { toPersianDigits } from '../lib/format';

/** Deficiencies agents add over and over; one tap inserts the full title. */
const QUICK_DEFICIENCIES = ['برگ سبز', 'گواهینامه', 'کارت ماشین', 'بیمه‌نامه', 'قبول تقصیر', 'اقرارنامه', 'بازدید سلامت', 'تحقیقات', 'فاکتور', 'حقوقی', 'فرم شبا', 'نامه لیزینگ', 'نامه بیمه'];

/**
 * Collapses ZWNJ, spaces and Arabic letter variants so «بیمه‌نامه» matches «بیمه نامه»
 * and a quick-add button is not used twice for the same document.
 */
function deficiencyKey(value: string) {
  return value
    .replace(/[\u200b-\u200f\u202a-\u202e]/g, '')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\s+/g, '')
    .trim();
}

type Props = {
  data: Case;
  onClose: () => void;
  onToggle: (id: string | number) => void;
  onAdd: (title: string) => Promise<boolean>;
  onDelete: (id: string | number) => void;
  onEdit: () => void;
  onDeleteCase: () => Promise<void>;
  onCloseCase: (note?: string) => Promise<boolean>;
  onReopenCase: () => Promise<boolean>;
  canEditCase: boolean;
  canDeleteDeficiency: boolean;
  canDeleteCase: boolean;
  canCloseCase: boolean;
  savingId: string | number | null;
};

export default function DeficiencyDrawer({ data, onClose, onToggle, onAdd, onDelete, onEdit, onDeleteCase, onCloseCase, onReopenCase, canEditCase, canDeleteDeficiency, canDeleteCase, canCloseCase, savingId }: Props) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [addError, setAddError] = useState('');
  const [addingBusy, setAddingBusy] = useState(false);
  const [confirmDeleteCase, setConfirmDeleteCase] = useState(false);
  const [deletingCase, setDeletingCase] = useState(false);
  const [closureFormOpen, setClosureFormOpen] = useState(false);
  const [closureNote, setClosureNote] = useState('');
  const [closureError, setClosureError] = useState('');
  const [closingCase, setClosingCase] = useState(false);
  const [confirmReopen, setConfirmReopen] = useState(false);
  const [reopeningCase, setReopeningCase] = useState(false);
  const [quickBusy, setQuickBusy] = useState<string | null>(null);
  const [quickError, setQuickError] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  // One pass over the list instead of one filter per counter.
  const { open: openTotal, resolved: resolvedTotal } = data.deficiencies.reduce(
    (totals, item) => {
      if (item.resolved) totals.resolved += 1;
      else totals.open += 1;
      return totals;
    },
    { open: 0, resolved: 0 },
  );
  const open = toPersianDigits(openTotal);
  const resolved = toPersianDigits(resolvedTotal);
  const closed = Boolean(data.closed);
  const hasOpenDeficiencies = openTotal > 0;
  const busy = savingId !== null;
  // Normalized titles already on the case; quick-add chips for them are disabled.
  const existingTitles = useMemo(() => new Set(data.deficiencies.map(item => deficiencyKey(item.title))), [data.deficiencies]);

  const openAddForm = useCallback(() => {
    if (closed || addingBusy || busy) return;
    setAdding(true);
    setAddError('');
    window.requestAnimationFrame(() => titleInputRef.current?.focus());
  }, [addingBusy, busy, closed]);

  const cancelAdding = () => {
    setAdding(false);
    setTitle('');
    setAddError('');
  };

  /** Adds a preset deficiency in one click, without opening the manual form. */
  const addQuickDeficiency = async (quickTitle: string) => {
    if (closed || addingBusy || quickBusy || busy) return;
    if (existingTitles.has(deficiencyKey(quickTitle))) {
      setQuickError(`«${quickTitle}» قبلاً برای این پرونده ثبت شده است.`);
      return;
    }
    setQuickBusy(quickTitle);
    setQuickError('');
    try {
      const saved = await onAdd(quickTitle);
      if (!saved) setQuickError(`ثبت «${quickTitle}» انجام نشد؛ لطفاً دوباره تلاش کنید.`);
    } catch {
      setQuickError(`ثبت «${quickTitle}» انجام نشد؛ لطفاً دوباره تلاش کنید.`);
    } finally {
      setQuickBusy(null);
    }
  };

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      // Use the physical key code so the shortcut also works with a Persian keyboard layout.
      const isAKey = event.code === 'KeyA';
      const quickAdd = (event.ctrlKey || event.metaKey) && event.shiftKey && isAKey;
      const altAdd = event.altKey && isAKey;
      if (!quickAdd && !altAdd) return;
      event.preventDefault();
      if (!event.repeat) openAddForm();
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [openAddForm]);

  // Move focus into the dialog on open and hand it back to the page on close.
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    drawerRef.current?.focus();
    return () => previous?.focus();
  }, []);

  // Escape backs out of the innermost layer first: form → confirmation → drawer.
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.isComposing) return;
      if (closureFormOpen) {
        setClosureFormOpen(false);
        setClosureNote('');
        setClosureError('');
        return;
      }
      if (adding) {
        setAdding(false);
        setTitle('');
        setAddError('');
        return;
      }
      if (confirmDeleteCase) {
        setConfirmDeleteCase(false);
        return;
      }
      if (confirmReopen) {
        setConfirmReopen(false);
        return;
      }
      onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [adding, closureFormOpen, confirmDeleteCase, confirmReopen, onClose]);

  const submitDeficiency = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = title.trim();
    if (value.length < 3) {
      setAddError('عنوان نقص باید حداقل ۳ نویسه باشد.');
      return;
    }
    setAddingBusy(true);
    setAddError('');
    try {
      const saved = await onAdd(value);
      if (!saved) {
        setAddError('ثبت نقص انجام نشد؛ لطفاً دوباره تلاش کنید.');
        return;
      }
      setTitle('');
      // Keep the form open for rapid consecutive entry and move focus to the next title.
      window.requestAnimationFrame(() => titleInputRef.current?.focus());
    } catch {
      setAddError('ثبت نقص انجام نشد؛ لطفاً دوباره تلاش کنید.');
    } finally {
      setAddingBusy(false);
    }
  };

  const removeCase = async () => {
    setDeletingCase(true);
    try {
      await onDeleteCase();
    } finally {
      setDeletingCase(false);
      setConfirmDeleteCase(false);
    }
  };

  const submitClosure = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (closingCase) return;
    setClosingCase(true);
    setClosureError('');
    try {
      const saved = await onCloseCase(closureNote.trim() || undefined);
      if (saved) {
        setClosureFormOpen(false);
        setClosureNote('');
      } else {
        setClosureError('مختومه کردن پرونده انجام نشد؛ لطفاً دوباره تلاش کنید.');
      }
    } catch {
      setClosureError('مختومه کردن پرونده انجام نشد؛ لطفاً دوباره تلاش کنید.');
    } finally {
      setClosingCase(false);
    }
  };

  const reopenCase = async () => {
    setReopeningCase(true);
    try {
      const done = await onReopenCase();
      if (done) setConfirmReopen(false);
    } finally {
      setReopeningCase(false);
    }
  };

  const cancelClosure = () => {
    setClosureFormOpen(false);
    setClosureNote('');
    setClosureError('');
  };

  /** Keeps Tab focus inside the modal drawer instead of leaking to the page behind it. */
  const trapFocus = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Tab' || !drawerRef.current) return;
    const focusable = Array.from(
      drawerRef.current.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])',
      ),
    ).filter(element => element.offsetParent !== null);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="drawer-layer">
      <div className="overlay" onClick={onClose} aria-hidden="true" />
      <aside
        ref={drawerRef}
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`مدیریت نواقص پرونده ${data.number}`}
        tabIndex={-1}
        onKeyDown={trapFocus}
      >
        <button type="button" className="close" onClick={onClose} aria-label="بستن" title="بستن (Esc)"><X /></button>
        <small>مدیریت سریع نواقص</small>
        <div className="borderBottom"></div>
        <h2>{data.number}</h2>
        <div className="drawer-user"><Files /><b>{data.name}<small>{data.phone}</small></b></div>
        {closed && (
          <div className="closure-banner" role="status">
            <div className="closure-banner-head">
              <Lock size={14} aria-hidden="true" />
              <b>این پرونده مختومه شده است</b>
            </div>
            {data.closedAt && <small>تاریخ مختومه شدن: {data.closedAt}</small>}
            {data.closureNote && <p>{data.closureNote}</p>}
            <small>تا زمان بازگشایی، نواقص این پرونده قابل تغییر نیستند.</small>
          </div>
        )}
        {/* <div className="summary">
          <b>{open}<small>نقص باز</small></b>
          <b>{resolved}<small>رفع‌شده</small></b>
          <b>{toPersianDigits(data.completion)}٪<small>پیشرفت</small></b>
        </div> */}
        <h3>لیست نواقص</h3>
        {data.deficiencies.length === 0 && <p className="drawer-empty">برای این پرونده نقصی ثبت نشده است.</p>}
        {data.deficiencies.map(item => (
          <div key={item.id}>
            <div className="item-row">
              <button
                type="button"
                className={`item ${item.resolved ? 'resolved' : ''} ${savingId === item.id ? 'busy' : ''}`}
                onClick={() => onToggle(item.id)}
                disabled={busy || closed}
              >
                <i>{savingId === item.id ? <Loader2 className="spin" size={12} /> : item.resolved && <Check />}</i>
                <span>{item.title}<small>{item.resolved ? 'این مورد رفع شده است' : 'در انتظار دریافت مدرک'}</small></span>
              </button>
              {canDeleteDeficiency && <button
                type="button"
                className="remove"
                onClick={() => onDelete(item.id)}
                disabled={busy || addingBusy || quickBusy !== null || closed}
                aria-label={`حذف نقص ${item.title}`}
                title={closed ? 'پرونده مختومه است' : 'حذف نقص مستقیم'}
              >
                <Trash2 size={13} />
              </button>}
            </div>
          </div>
        ))}

        {!closed && (
          <section className="quick-deficiencies" aria-labelledby="quick-deficiencies-title">
            <div className="quick-deficiencies-head">
              <h3 id="quick-deficiencies-title">افزودن سریع</h3>
              <small>با یک کلیک ثبت می‌شود</small>
            </div>
            <div className="quick-deficiency-list">
              {QUICK_DEFICIENCIES.map(quickTitle => {
                const alreadyAdded = existingTitles.has(deficiencyKey(quickTitle));
                const isSaving = quickBusy === quickTitle;
                return (
                  <button
                    type="button"
                    className="quick-deficiency"
                    key={quickTitle}
                    onClick={() => void addQuickDeficiency(quickTitle)}
                    disabled={busy || addingBusy || quickBusy !== null || alreadyAdded}
                    aria-label={alreadyAdded ? `${quickTitle} قبلاً ثبت شده است` : `افزودن نقص ${quickTitle}`}
                    title={alreadyAdded ? 'این نقص قبلاً ثبت شده است' : `افزودن ${quickTitle}`}
                  >
                    {isSaving ? <Loader2 className="spin" size={13} /> : <Plus size={13} />}
                    <span>{quickTitle}</span>
                    {alreadyAdded && <Check size={12} aria-label="ثبت شده" />}
                  </button>
                );
              })}
            </div>
            {quickError && <small className="form-error-inline" role="alert">{quickError}</small>}
          </section>
        )}

        {closed ? (
          <p className="drawer-closed-hint">
            <Lock size={12} aria-hidden="true" /> برای افزودن یا تغییر نواقص، ابتدا پرونده را بازگشایی کنید.
          </p>
        ) : adding ? (
          <form className="add-form" onSubmit={submitDeficiency}>
            <input
              value={title}
              onChange={event => setTitle(event.target.value)}
              placeholder="عنوان نقص، مثلاً: کپی برابر اصل بیمه‌نامه"
              aria-label="عنوان نقص جدید"
              ref={titleInputRef}
              maxLength={120}
              autoFocus
              disabled={addingBusy}
            />
            {addError && <small className="form-error-inline">{addError}</small>}
            <small className="add-form-hint">با زدن Enter ثبت می‌شود و فرم بعدی باز می‌ماند.</small>
            <div className="add-form-actions">
              <button type="button" onClick={cancelAdding} disabled={addingBusy}>انصراف</button>
              <button className="primary" disabled={addingBusy}>
                {addingBusy ? <><Loader2 className="spin" size={13} /> در حال ثبت...</> : 'ثبت نقص'}
              </button>
            </div>
          </form>
        ) : (
          <button type="button" className="add" onClick={openAddForm} disabled={savingId !== null}>
            <Plus />
            <span>افزودن نقص جدید</span>
            <kbd>Ctrl/⌘ + Shift + A</kbd>
          </button>
        )}

        {(canEditCase || canDeleteCase || canCloseCase) && <div className="drawer-actions">
          {closed && canCloseCase && <button type="button" className="ghost" onClick={() => setConfirmReopen(true)} disabled={reopeningCase}><ArchiveRestore size={14} /> بازگشایی پرونده</button>}
          {!closed && canEditCase && <button type="button" className="ghost" onClick={onEdit}><Pencil size={14} /> ویرایش اطلاعات</button>}
          {!closed && canCloseCase && <button type="button" className="close-case" onClick={() => setClosureFormOpen(true)} disabled={closingCase}><Archive size={14} /> مختومه کردن پرونده</button>}
          {canDeleteCase && <button type="button" className="danger-text" onClick={() => setConfirmDeleteCase(true)} disabled={deletingCase}><Trash2 size={14} /> حذف پرونده</button>}
        </div>}
        {closureFormOpen && !closed && canCloseCase && (
          <form className="closure-form" onSubmit={submitClosure}>
            <b><Archive size={13} /> مختومه کردن پرونده</b>
            <small>پس از مختومه شدن، پرونده بایگانی می‌شود و تا بازگشایی، نواقص آن قابل تغییر نیست.</small>
            {hasOpenDeficiencies && (
              <small className="closure-warning">توجه: این پرونده {open} نقص باز دارد و پس از مختومه شدن در فیلتر «نیازمند پیگیری» نمایش داده نمی‌شود.</small>
            )}
            <textarea
              value={closureNote}
              onChange={event => setClosureNote(event.target.value)}
              placeholder="توضیح مختومه شدن (اختیاری)"
              aria-label="توضیح مختومه شدن پرونده"
              maxLength={500}
              rows={2}
              disabled={closingCase}
            />
            {closureError && <small className="form-error-inline">{closureError}</small>}
            <div className="add-form-actions">
              <button type="button" onClick={cancelClosure} disabled={closingCase}>انصراف</button>
              <button className="primary" disabled={closingCase}>
                {closingCase ? <><Loader2 className="spin" size={13} /> در حال ثبت...</> : <><Archive size={13} /> تأیید مختومه شدن</>}
              </button>
            </div>
          </form>
        )}
        {confirmReopen && (
          <div className="drawer-confirm">
            <span>این پرونده از حالت مختومه خارج شود؟ نواقص آن دوباره قابل ویرایش می‌شود.</span>
            <div>
              <button type="button" className="ghost" onClick={reopenCase} disabled={reopeningCase}>
                {reopeningCase ? <><Loader2 className="spin" size={12} /> در حال بازگشایی...</> : 'بازگشایی پرونده'}
              </button>
              <button type="button" onClick={() => setConfirmReopen(false)} disabled={reopeningCase}>انصراف</button>
            </div>
          </div>
        )}
        {confirmDeleteCase && (
          <div className="drawer-confirm">
            <span>این پرونده از فهرست حذف شود؟ این عمل قابل بازگشت نیست.</span>
            <div>
              <button type="button" className="danger" onClick={removeCase} disabled={deletingCase}>
                {deletingCase ? <><Loader2 className="spin" size={12} /> در حال حذف...</> : 'تأیید حذف'}
              </button>
              <button type="button" onClick={() => setConfirmDeleteCase(false)} disabled={deletingCase}>انصراف</button>
            </div>
          </div>
        )}
        <small className="drawer-hint">تغییرات پس از تأیید بلافاصله در پایگاه داده ذخیره می‌شوند.</small>
      </aside>
    </div>
  );
}
