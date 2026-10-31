import { useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Save, X } from 'lucide-react';
import type { Case } from '../lib/demoData';
import type { ExpertOption } from '../hooks/useExperts';
import SelectMenu from './SelectMenu';

const schema = z.object({
  insuredName: z.string().min(3, 'نام بیمه‌گذار را وارد کنید'),
  phone: z.string().min(10, 'شماره تماس معتبر نیست'),
  expertId: z.string().optional(),
  description: z.string().optional(),
});

export type CaseFormValues = z.infer<typeof schema>;

type Props = {
  data: Case;
  experts: ExpertOption[];
  onClose: () => void;
  onSubmit: (values: CaseFormValues) => Promise<void>;
};

export default function EditCaseDialog({ data, experts, onClose, onSubmit }: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const defaultExpertId = experts.find(item => item.full_name === data.expert)?.id ?? '';
  const { register, control, handleSubmit, formState: { errors } } = useForm<CaseFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      insuredName: data.name,
      phone: data.phone.replace(/\s+/g, ''),
      expertId: defaultExpertId,
      description: data.description ?? '',
    },
  });

  const submit = async (values: CaseFormValues) => {
    setSaving(true);
    setError('');
    try {
      await onSubmit(values);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ذخیره تغییرات انجام نشد.');
    } finally {
      setSaving(false);
    }
  };

  const submitOnEnter = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLButtonElement || saving) return;
    event.preventDefault();
    event.currentTarget.requestSubmit();
  };

  return createPortal(
    <div className="dialog-overlay">
      <form className="dialog" onSubmit={handleSubmit(submit)} onKeyDown={submitOnEnter}>
        <button type="button" className="dialog-close" onClick={onClose} aria-label="بستن"><X /></button>
        <div className="dialog-kicker">ویرایش پرونده {data.number}</div>
        <h2>ویرایش اطلاعات پرونده</h2>
        <p>شماره و سال پرونده قابل تغییر نیست؛ برای جابه‌جایی پرونده بین کارشناسان از همین فرم استفاده کنید.</p>
        <div className="form-grid">
          <div className="form-pair">
            <label>نام بیمه‌گذار / مالک خودرو<input {...register('insuredName')} placeholder="نام و نام خانوادگی" />{errors.insuredName && <small>{errors.insuredName.message}</small>}</label>
            <label>شماره تماس<input {...register('phone')} placeholder="۰۹۱۲۱۲۳۴۵۶۷" inputMode="tel" />{errors.phone && <small>{errors.phone.message}</small>}</label>
          </div>
          <div className="expert-description-row">
            <div className="expert-menu-field">
              <span className="field-label">کارشناس پرونده</span>
              <Controller
                name="expertId"
                control={control}
                render={({ field }) => (
                  <SelectMenu
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    label="انتخاب کارشناس"
                    options={[{ value: '', label: '— بدون کارشناس —' }, ...experts.map(expert => ({ value: expert.id, label: expert.full_name }))]}
                  />
                )}
              />
            </div>
            <label>توضیحات <textarea {...register('description')} placeholder="توضیحات اختیاری پرونده" /></label>
          </div>
        </div>
        {error && <div className="form-error">{error}</div>}
        <div className="dialog-actions">
          <button type="button" onClick={onClose} disabled={saving}>انصراف</button>
          <button className="primary" disabled={saving}>
            {saving ? <><Loader2 className="spin" size={16} /> در حال ذخیره...</> : <><Save size={16} /> ذخیره تغییرات</>}
          </button>
        </div>
      </form>
    </div>,
    document.querySelector<HTMLElement>('.app') ?? document.body,
  );
}
