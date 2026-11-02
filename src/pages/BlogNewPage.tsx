import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, Check, FileText, Menu } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { createBlogPost, DEFAULT_BLOG_CATEGORIES, fetchBlogCategories, type BlogStatus } from '../services/blog';
import { getCurrentUserRole, type UserRole } from '../services/auth';
import { isSupabaseConfigured } from '../lib/supabase';

export default function BlogNewPage() {
  const demo = !isSupabaseConfigured;
  const navigate = useNavigate();
  const [dark, setDark] = useState(() => localStorage.getItem('parvandeyar-theme') === 'dark');
  const [menuOpen, setMenuOpen] = useState(false);
  const [role, setRole] = useState<UserRole>(demo ? 'admin' : 'user');
  const [title, setTitle] = useState(''); const [excerpt, setExcerpt] = useState(''); const [content, setContent] = useState(''); const [category, setCategory] = useState(''); const [categories, setCategories] = useState<string[]>([]); const [status, setStatus] = useState<BlogStatus>('draft'); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  useEffect(() => { if (!demo) void getCurrentUserRole().then(setRole).catch(() => setRole('user')); }, [demo]);
  useEffect(() => {
    void fetchBlogCategories()
      .catch(() => DEFAULT_BLOG_CATEGORIES)
      .then(list => {
        const available = list.length > 0 ? list : DEFAULT_BLOG_CATEGORIES;
        setCategories(available);
        setCategory(current => available.includes(current) ? current : available[0]);
      });
  }, []);
  const toggleTheme = () => setDark(value => { const next = !value; localStorage.setItem('parvandeyar-theme', next ? 'dark' : 'light'); return next; });
  const submit = async (event: FormEvent) => { event.preventDefault(); if (!title.trim() || !content.trim()) { setError('عنوان و متن پست را وارد کنید.'); return; } setSaving(true); setError(''); try { await createBlogPost({ title: title.trim(), excerpt: excerpt.trim(), content: content.trim(), category, status }); navigate('/blog'); } catch (err) { setError(err instanceof Error ? err.message : 'ذخیره پست ناموفق بود.'); } finally { setSaving(false); } };
  return <div className={dark ? 'app dark' : 'app'} dir="rtl"><Sidebar dark={dark} onToggleTheme={toggleTheme} open={menuOpen} onClose={() => setMenuOpen(false)} role={role} />{menuOpen && <div className="sidebar-scrim" onClick={() => setMenuOpen(false)} />}<main><header><button type="button" className="mobile" onClick={() => setMenuOpen(value => !value)} aria-label="باز کردن منو"><Menu /></button><span>خانه　/　<Link to="/blog">بلاگ</Link>　/　<b>افزودن پست</b></span><span>روز بخیر مدیر سیستم</span></header><section className="content blog-content"><div className="title"><div><h1>افزودن پست</h1><p>یک مطلب جدید برای وبلاگ پرونده‌یار ایجاد کنید</p></div><Link className="blog-back" to="/blog"><ArrowRight size={16} /> بازگشت به بلاگ</Link></div><form className="blog-form panel" onSubmit={submit}><div className="blog-form-heading"><div className="blog-form-icon"><FileText size={20} /></div><div><b>اطلاعات پست</b><small>عنوان، دسته‌بندی و محتوای مطلب را وارد کنید.</small></div></div><label>عنوان پست<input value={title} onChange={event => setTitle(event.target.value)} placeholder="مثلاً: مدارک ضروری برای تشکیل پرونده" /></label><div className="blog-form-row"><label>دسته‌بندی<select value={category} onChange={event => setCategory(event.target.value)} disabled={categories.length === 0}>{categories.map(item => <option key={item}>{item}</option>)}</select>{categories.length === 0 && <small>هیچ دسته‌بندی‌ای ثبت نشده؛ از صفحهٔ بلاگ دسته جدید اضافه کنید.</small>}</label><label>وضعیت انتشار<select value={status} onChange={event => setStatus(event.target.value as BlogStatus)}><option value="draft">پیش‌نویس</option><option value="published">انتشار در وبلاگ</option></select></label></div><label>خلاصه مطلب<span className="label-hint">اختیاری؛ در کارت پست نمایش داده می‌شود</span><textarea rows={3} value={excerpt} onChange={event => setExcerpt(event.target.value)} placeholder="یک توضیح کوتاه درباره این مطلب..." /></label><label>متن کامل پست<textarea className="blog-editor" rows={12} value={content} onChange={event => setContent(event.target.value)} placeholder="متن مطلب را اینجا بنویسید..." /></label>{error && <div className="form-error">{error}</div>}<div className="blog-form-actions"><Link className="secondary" to="/blog">انصراف</Link><button className="primary" type="submit" disabled={saving}><Check size={16} /> {saving ? 'در حال ذخیره...' : status === 'published' ? 'انتشار پست' : 'ذخیره پیش‌نویس'}</button></div></form></section></main></div>;
}
