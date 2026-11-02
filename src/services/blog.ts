import { supabase } from '../lib/supabase';

export type BlogStatus = 'draft' | 'published';
export type BlogPost = {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  status: BlogStatus;
  created_at: string;
  updated_at: string;
};

export const DEFAULT_BLOG_CATEGORIES = ['آموزش بیمه', 'راهنمای پرونده', 'اخبار و اطلاعیه', 'نکات کارشناسی'];

const POSTS_KEY = 'parvandeyar-blog-posts';
const DELETED_KEY = 'parvandeyar-blog-deleted';
const CATEGORIES_KEY = 'parvandeyar-blog-categories';

const readStore = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};
const writeStore = (key: string, value: unknown) => localStorage.setItem(key, JSON.stringify(value));

export const demoPosts: BlogPost[] = [
  { id: 'demo-post-1', title: 'چطور یک پرونده بیمه را سریع‌تر بررسی کنیم؟', excerpt: 'چند نکته کاربردی برای نظم‌دهی به مدارک و کاهش زمان پیگیری پرونده.', content: 'با آماده‌سازی مدارک اصلی و ثبت دقیق نواقص، روند بررسی پرونده بسیار سریع‌تر می‌شود.', category: 'راهنمای پرونده', status: 'published', created_at: '2026-10-28T09:30:00.000Z', updated_at: '2026-10-28T09:30:00.000Z' },
  { id: 'demo-post-2', title: 'مدارک ضروری برای تشکیل پرونده', excerpt: 'فهرست مدارکی که بهتر است قبل از شروع فرایند آماده کنید.', content: 'برگ سبز، کارت ماشین، بیمه‌نامه و گواهینامه را پیش از ثبت پرونده آماده کنید.', category: 'آموزش بیمه', status: 'published', created_at: '2026-10-25T09:30:00.000Z', updated_at: '2026-10-25T09:30:00.000Z' },
];

/** دسته‌بندی‌های ذخیره‌شده به‌همراه دسته‌های پیش‌فرض، بدون تکرار. */
const uniqueCategories = (items: string[]) => {
  const seen = new Set<string>();
  return items.filter(item => item && !seen.has(item) && seen.add(item)).map(item => item.trim());
};

export async function fetchBlogPosts(): Promise<BlogPost[]> {
  if (!supabase) {
    const saved = readStore<BlogPost[]>(POSTS_KEY, []);
    const deleted = readStore<string[]>(DELETED_KEY, []);
    return [...saved, ...demoPosts].filter(post => !deleted.includes(post.id));
  }
  const { data, error } = await supabase.from('blog_posts').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as BlogPost[];
}

export async function createBlogPost(input: Pick<BlogPost, 'title' | 'excerpt' | 'content' | 'category' | 'status'>) {
  if (!supabase) {
    const post: BlogPost = { ...input, id: `demo-post-${Date.now()}`, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    writeStore(POSTS_KEY, [post, ...readStore<BlogPost[]>(POSTS_KEY, [])]);
    return post;
  }
  const { data, error } = await supabase.from('blog_posts').insert(input).select('*').single();
  if (error) throw error;
  return data as BlogPost;
}

export async function deleteBlogPost(id: string) {
  if (!supabase) {
    const saved = readStore<BlogPost[]>(POSTS_KEY, []);
    if (saved.some(post => post.id === id)) {
      writeStore(POSTS_KEY, saved.filter(post => post.id !== id));
    } else {
      writeStore(DELETED_KEY, uniqueCategories([...readStore<string[]>(DELETED_KEY, []), id]));
    }
    return;
  }
  const { error } = await supabase.from('blog_posts').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchBlogCategories(): Promise<string[]> {
  if (!supabase) {
    const saved = readStore<string[]>(CATEGORIES_KEY, DEFAULT_BLOG_CATEGORIES);
    return uniqueCategories(saved);
  }
  const { data, error } = await supabase.from('blog_categories').select('name').order('name');
  if (error) throw error;
  const names = uniqueCategories((data ?? []).map(row => String(row.name)));
  return uniqueCategories([...DEFAULT_BLOG_CATEGORIES, ...names]);
}

export async function createBlogCategory(name: string): Promise<string[]> {
  const clean = name.trim();
  if (clean.length < 2) throw new Error('نام دسته‌بندی باید حداقل ۲ حرف باشد.');
  if (!supabase) {
    const next = uniqueCategories([...readStore<string[]>(CATEGORIES_KEY, DEFAULT_BLOG_CATEGORIES), clean]);
    writeStore(CATEGORIES_KEY, next);
    return next;
  }
  const { error } = await supabase.from('blog_categories').insert({ name: clean });
  if (error && error.code !== '23505') throw error;
  return fetchBlogCategories();
}

export async function deleteBlogCategory(name: string): Promise<string[]> {
  if (!supabase) {
    const next = readStore<string[]>(CATEGORIES_KEY, DEFAULT_BLOG_CATEGORIES).filter(item => item !== name);
    writeStore(CATEGORIES_KEY, next);
    return next;
  }
  const { error } = await supabase.from('blog_categories').delete().eq('name', name);
  if (error) throw error;
  return fetchBlogCategories();
}

