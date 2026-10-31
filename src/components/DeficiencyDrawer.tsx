import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Check, Files, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { Case } from '../lib/demoData';
import { toPersianDigits } from '../lib/format';

type Props = {
  data: Case;
  onClose: () => void;
  onToggle: (id: string | number) => void;
  onAdd: (title: string) => Promise<boolean>;
  onDelete: (id: string | number) => void;
  onEdit: () => void;
  onDeleteCase: () => Promise<void>;
  canEditCase: boolean;
  canDeleteDeficiency: boolean;
  canDeleteCase: boolean;
  savingId: string | number | null;
};

export default function DeficiencyDrawer({ data, onClose, onToggle, onAdd, onDelete, onEdit, onDeleteCase, canEditCase, canDeleteDeficiency, canDeleteCase, savingId }: Props) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [addError, setAddError] = useState('');
  const [addingBusy, setAddingBusy] = useState(false);
  const [confirmId, setConfirmId] = useState<string | number | null>(null);
  const [confirmDeleteCase, setConfirmDeleteCase] = useState(false);
  const [deletingCase, setDeletingCase] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const open = toPersianDigits(data.deficiencies.filter(item => !item.resolved).length);
  const resolved = toPersianDigits(data.deficiencies.filter(item => item.resolved).length);

  const openAddForm = () => {
    setAdding(true);
    setAddError('');
    window.requestAnimationFrame(() => titleInputRef.current?.focus());
  };

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const quickAdd = (event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'a';
      const altAdd = event.altKey && event.key.toLowerCase() === 'a';
      if (!quickAdd && !altAdd) return;
      event.preventDefault();
      if (!addingBusy) openAddForm();
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [addingBusy]);

  const submitDeficiency = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = title.trim();
    if (value.length < 3) {
      setAddError('عنوان نقص باید حداقل ۳ نویسه باشد.');
      return;
    }
    setAddingBusy(true);
    setAddError('');
    const saved = await onAdd(value);
    setAddingBusy(false);
    if (saved) {
      setTitle('');
      setAddError('');
      // Keep the form open for rapid consecutive entry and move focus to the next title.
      setAdding(true);
      window.requestAnimationFrame(() => titleInputRef.current?.focus());
    } else {
      setAddError('ثبت نقص انجام نشد؛ لطفاً دوباره تلاش کنید.');
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

  return (
    <div className="drawer-layer">
      <div className="overlay" onClick={onClose} aria-hidden="true" />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={`مدیریت نواقص پرونده ${data.number}`}>
        <button type="button" className="close" onClick={onClose} aria-label="بستن"><X /></button>
        <small>مدیریت سریع نواقص</small>
        <h2>{data.number}</h2>
        <div className="drawer-user"><Files /><b>{data.name}<small>{data.phone}</small></b></div>
        <div className="summary">
          <b>{open}<small>نقص باز</small></b>
          <b>{resolved}<small>رفع‌شده</small></b>
          <b>{toPersianDigits(data.completion)}٪<small>پیشرفت</small></b>
        </div>
        <h3>لیست نواقص</h3>
        {data.deficiencies.length === 0 && <p className="drawer-empty">برای این پرونده نقصی ثبت نشده است.</p>}
        {data.deficiencies.map(item => (
          <div key={item.id}>
            <div className="item-row">
              <button
                type="button"
                className={`item ${item.resolved ? 'resolved' : ''} ${savingId === item.id ? 'busy' : ''}`}
                onClick={() => onToggle(item.id)}
                disabled={savingId !== null}
              >
                <i>{savingId === item.id ? <Loader2 className="spin" size={12} /> : item.resolved && <Check />}</i>
                <span>{item.title}<small>{item.resolved ? 'این مورد رفع شده است' : 'در انتظار دریافت مدرک'}</small></span>
              </button>
              {canDeleteDeficiency && <button
                type="button"
                className="remove"
                onClick={() => setConfirmId(item.id)}
                disabled={savingId !== null || addingBusy}
                aria-label={`حذف نقص ${item.title}`}
                title="حذف نقص"
              >
                <Trash2 size={13} />
              </button>}
            </div>
            {confirmId === item.id && (
              <div className="confirm-inline">
                <span>این نقص حذف شود؟</span>
                <button type="button" className="danger" onClick={() => { setConfirmId(null); onDelete(item.id); }}>حذف</button>
                <button type="button" onClick={() => setConfirmId(null)}>انصراف</button>
              </div>
            )}
          </div>
        ))}

        {adding ? (
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
              <button type="button" onClick={() => { setAdding(false); setTitle(''); setAddError(''); }} disabled={addingBusy}>انصراف</button>
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

        {(canEditCase || canDeleteCase) && <div className="drawer-actions">
          {canEditCase && <button type="button" className="ghost" onClick={onEdit}><Pencil size={14} /> ویرایش اطلاعات</button>}
          {canDeleteCase && <button type="button" className="danger-text" onClick={() => setConfirmDeleteCase(true)} disabled={deletingCase}><Trash2 size={14} /> حذف پرونده</button>}
        </div>}
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
