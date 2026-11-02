import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, CalendarDays, Loader2, Menu, Plus, RefreshCw, Tag, Trash2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { createBlogCategory, deleteBlogCategory, deleteBlogPost, demoPosts, fetchBlogCategories, fetchBlogPosts, type BlogPost } from '../services/blog';
import { getCurrentUserRole, type UserRole } from '../services/auth';
import { isSupabaseConfigured } from '../lib/supabase';

const ALL_CATEGORIES = 'همه دسته‌ها';

type PostModalProps = { post: BlogPost; onClose: () => void };

function PostModal({ post, onClose }: PostModalProps) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  const paragraphs = post.content.split(/\n+/).map(item => item.trim()).filter(Boolean);

  return createPortal(
    <div className="dialog-overlay" role="presentation" onClick={onClose}>
      <article className="dialog blog-modal" role="dialog" aria-modal="true" aria-labelledby="blog-modal-title" onClick={event => event.stopPropagation()}>
        <button type="button" className="dialog-close" onClick={onClose} aria-label="بستن مودال"><X /></button>
        <div className="blog-card-top">
          <span className="blog-category">{post.category}</span>
          <span className={post.status === 'published' ? 'blog-status published' : 'blog-status'}>{post.status === 'published' ? 'منتشر شده' : 'پیش‌نویس'}</span>
        </div>
        <h2 id="blog-modal-title">{post.title}</h2>
        <div className="blog-modal-meta"><CalendarDays size={14} /><time>{new Date(post.created_at).toLocaleDateString('fa-IR')}</time></div>
        {post.excerpt && <p className="blog-modal-excerpt">{post.excerpt}</p>}
        <div className="blog-modal-body">{paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
        <div className="dialog-actions"><button type="button" onClick={onClose}>بستن</button></div>
      </article>
    </div>,
    document.querySelector<HTMLElement>('.app') ?? document.body,
  );
}

export default function BlogPage() {
  const demo = !isSupabaseConfigured;
  const [dark, setDark] = useState(() => localStorage.getItem('parvandeyar-theme') === 'dark');
  const [menuOpen, setMenuOpen] = useState(false);
  const [role, setRole] = useState<UserRole>(demo ? 'admin' : 'user');
  const [posts, setPosts] = useState<BlogPost[]>(demo ? demoPosts : []);
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [openPost, setOpenPost] = useState<BlogPost | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [busyPostId, setBusyPostId] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState('');
  const [categoryBusy, setCategoryBusy] = useState(false);
  const canManage = demo || role === 'admin';

  const load = async () => {
    setLoading(true);
    try {
      const [list, cats] = await Promise.all([fetchBlogPosts(), fetchBlogCategories().catch(() => [])]);
      setPosts(list);
      setCategories(cats);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'دریافت پست‌ها ناموفق بود.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); if (!demo) void getCurrentUserRole().then(setRole).catch(() => setRole('user')); }, []);

  const availableCategories = useMemo(() => {
    const merged = [...categories];
    posts.forEach(post => { if (post.category && !merged.includes(post.category)) merged.push(post.category); });
    return merged;
  }, [categories, posts]);
  const filtered = useMemo(() => category === ALL_CATEGORIES ? posts : posts.filter(post => post.category === category), [category, posts]);
  const toggleTheme = () => setDark(value => { const next = !value; localStorage.setItem('parvandeyar-theme', next ? 'dark' : 'light'); return next; });

  const handleDeletePost = async (post: BlogPost) => {
    setBusyPostId(post.id);
    setError('');
    try {
      await deleteBlogPost(post.id);
      setPosts(current => current.filter(item => item.id !== post.id));
      setNotice(`پست «${post.title}» حذف شد.`);
      if (openPost?.id === post.id) setOpenPost(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حذف پست ناموفق بود.');
    } finally {
      setBusyPostId(null);
      setConfirmingId(null);
    }
  };

  const handleAddCategory = async () => {
    const name = newCategory.trim();
    if (!name) return;
    if (availableCategories.includes(name)) { setError(`دسته‌بندی «${name}» قبلاً وجود دارد.`); return; }
    setCategoryBusy(true);
    setError('');
    try {
      setCategories(await createBlogCategory(name));
      setNewCategory('');
      setNotice(`دسته‌بندی «${name}» اضافه شد.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'افزودن دسته‌بندی ناموفق بود.');
    } finally {
      setCategoryBusy(false);
    }
  };

  const handleRemoveCategory = async (name: string) => {
    setCategoryBusy(true);
    setError('');
    try {
      setCategories(await deleteBlogCategory(name));
      if (category === name) setCategory(ALL_CATEGORIES);
      setNotice(`دسته‌بندی «${name}» حذف شد؛ پست‌های آن دسته همچنان باقی‌اند.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حذف دسته‌بندی ناموفق بود.');
    } finally {
      setCategoryBusy(false);
    }
  };

  return <div className={dark ? 'app dark' : 'app'} dir="rtl">
    <Sidebar dark={dark} onToggleTheme={toggleTheme} open={menuOpen} onClose={() => setMenuOpen(false)} role={role} />
    {menuOpen && <div className="sidebar-scrim" onClick={() => setMenuOpen(false)} />}
    <main><header><button type="button" className="mobile" onClick={() => setMenuOpen(value => !value)} aria-label="باز کردن منو"><Menu /></button><span>خانه　/　<b>بلاگ</b></span><span>روز بخیر مدیر سیستم</span></header>
      <section className="content blog-content">
        <div className="title"><div><h1>بلاگ</h1><p>مطالب آموزشی، راهنماها و آخرین نکات پرونده‌های بیمه</p></div><Link className="primary" to="/blog/new"><Plus size={17} /> افزودن پست</Link></div>
        <div className="blog-toolbar"><div className="blog-toolbar-title"><BookOpen size={20} /><b>مطالب پرونده‌یار</b><small>{posts.length} پست</small></div><label className="blog-filter"><Tag size={15} /><select value={category} onChange={event => setCategory(event.target.value)}><option>{ALL_CATEGORIES}</option>{availableCategories.map(item => <option key={item}>{item}</option>)}</select></label></div>
        {canManage && (
          <section className="blog-categories panel">
            <div className="blog-categories-head"><div><b>مدیریت دسته‌بندی‌ها</b><small>حذف دسته، پست‌های آن دسته را حذف نمی‌کند.</small></div></div>
            <div className="blog-category-list">
              {availableCategories.map(name => (
                <span className="blog-category-chip" key={name}>
                  {name}
                  <small>{posts.filter(post => post.category === name).length} پست</small>
                  <button type="button" onClick={() => void handleRemoveCategory(name)} disabled={categoryBusy} aria-label={`حذف دسته‌بندی ${name}`}><X size={12} /></button>
                </span>
              ))}
            </div>
            <form className="blog-category-add" onSubmit={event => { event.preventDefault(); void handleAddCategory(); }}>
              <input value={newCategory} onChange={event => setNewCategory(event.target.value)} placeholder="نام دسته‌بندی جدید، مثلاً: بیمه بدنه" />
              <button type="submit" className="primary" disabled={categoryBusy || newCategory.trim().length < 2}>{categoryBusy ? <Loader2 className="spin" size={15} /> : <Plus size={15} />} افزودن دسته</button>
            </form>
          </section>
        )}
        {error && <div className="error-banner">{error} <button type="button" onClick={() => void load()}><RefreshCw size={14} /> تلاش دوباره</button></div>}
        {notice && !error && <div className="form-success">{notice}</div>}
        {loading ? <div className="panel blog-empty">در حال دریافت پست‌ها...</div> : filtered.length === 0 ? <div className="panel blog-empty">پستی در این دسته‌بندی وجود ندارد.</div> : (
          <div className="blog-grid">
            {filtered.map(post => (
              <article className="blog-card" key={post.id}>
                <div className="blog-card-top"><span className="blog-category">{post.category}</span><span className={post.status === 'published' ? 'blog-status published' : 'blog-status'}>{post.status === 'published' ? 'منتشر شده' : 'پیش‌نویس'}</span></div>
                <h2>{post.title}</h2>
                <p>{post.excerpt || post.content}</p>
                <footer>
                  <time>{new Date(post.created_at).toLocaleDateString('fa-IR')}</time>
                  <div className="blog-card-actions">
                    {confirmingId === post.id ? (
                      <span className="blog-confirm">
                        <small>حذف شود؟</small>
                        <button type="button" className="danger-button" onClick={() => void handleDeletePost(post)} disabled={busyPostId === post.id}>{busyPostId === post.id ? <Loader2 className="spin" size={13} /> : 'بله، حذف'}</button>
                        <button type="button" onClick={() => setConfirmingId(null)}>انصراف</button>
                      </span>
                    ) : (
                      <>
                        <button type="button" className="blog-read-more" onClick={() => setOpenPost(post)}>ادامه مطلب ←</button>
                        {canManage && <button type="button" className="blog-delete" onClick={() => setConfirmingId(post.id)} aria-label={`حذف ${post.title}`}><Trash2 size={14} /></button>}
                      </>
                    )}
                  </div>
                </footer>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
    {openPost && <PostModal post={openPost} onClose={() => setOpenPost(null)} />}
  </div>;
}

