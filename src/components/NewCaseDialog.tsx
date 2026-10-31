import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus, X } from 'lucide-react';
import { createCase, normalizeDigits } from '../services/cases';
import { useExperts } from '../hooks/useExperts';

const schema = z.object({
  year: z.string().regex(/^[0-9۰-۹]{4}$/, 'سال را به صورت ۴ رقمی وارد کنید'),
  number: z.string().regex(/^[0-9۰-۹]{1,6}$/, 'شماره پرونده را با ارقام وارد کنید'),
  name: z.string().min(3, 'نام بیمه‌گذار را وارد کنید'),
  phone: z.string().min(10, 'شماره تماس معتبر نیست'),
  expertId: z.string().optional(),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function NewCaseDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (created: unknown) => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const experts = useExperts();
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { expertId: '' } });

  const submit = async (values: FormValues) => {
    setSaving(true);
    setError('');
    try {
      const created = await createCase({
        caseYear: Number(normalizeDigits(values.year)),
        caseNumber: Number(normalizeDigits(values.number)),
        insuredName: values.name.trim(),
        phone: normalizeDigits(values.phone),
        expertId: values.expertId || undefined,
        expertName: experts.find(item => item.id === values.expertId)?.full_name,
        description: values.description?.trim() || undefined,
      });
      onCreated(created);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ثبت پرونده انجام نشد');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="dialog-overlay">
      <form className="dialog" onSubmit={handleSubmit(submit)}>
        <button type="button" className="dialog-close" onClick={onClose} aria-label="بستن"><X /></button>
        <div className="dialog-kicker">پرونده جدید</div>
        <h2>ثبت پرونده بیمه</h2>
        <p>اطلاعات پایه پرونده را وارد کنید. شماره پرونده در هر سال باید یکتا باشد.</p>
        <div className="form-grid">
          <label>سال پرونده<input {...register('year')} placeholder="۱۴۰۵" inputMode="numeric" />{errors.year && <small>{errors.year.message}</small>}</label>
          <label>شماره پرونده<input {...register('number')} placeholder="۱۲۳" inputMode="numeric" />{errors.number && <small>{errors.number.message}</small>}</label>
          <label className="full">نام بیمه‌گذار / مالک خودرو<input {...register('name')} placeholder="نام و نام خانوادگی" />{errors.name && <small>{errors.name.message}</small>}</label>
          <label className="full">شماره تماس<input {...register('phone')} placeholder="۰۹۱۲۱۲۳۴۵۶۷" inputMode="tel" />{errors.phone && <small>{errors.phone.message}</small>}</label>
          <label className="full">کارشناس پرونده
            <select {...register('expertId')}>
              <option value="">— بدون کارشناس —</option>
              {experts.map(expert => <option key={expert.id} value={expert.id}>{expert.full_name}</option>)}
            </select>
          </label>
          <label className="full">توضیحات <textarea {...register('description')} placeholder="توضیحات اختیاری پرونده" /></label>
        </div>
        {error && <div className="form-error">{error}</div>}
        <div className="dialog-actions">
          <button type="button" onClick={onClose}>انصراف</button>
          <button className="primary" disabled={saving}>
            {saving ? <><Loader2 className="spin" size={16} /> در حال ثبت...</> : <><Plus size={16} /> ثبت پرونده</>}
          </button>
        </div>
      </form>
    </div>
  );
}
