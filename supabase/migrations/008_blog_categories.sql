-- 008: Blog categories
create table if not exists public.blog_categories (
  name text primary key,
  created_by uuid not null default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.blog_categories enable row level security;

drop policy if exists "blog categories readable by authenticated users" on public.blog_categories;
create policy "blog categories readable by authenticated users"
  on public.blog_categories for select to authenticated using (true);

drop policy if exists "blog categories manageable by admins" on public.blog_categories;
create policy "blog categories manageable by admins"
  on public.blog_categories for all to authenticated
  using ((select public.current_user_role()) = 'admin')
  with check ((select public.current_user_role()) = 'admin');

-- Seed default categories (idempotent).
insert into public.blog_categories (name) values
  ('آموزش بیمه'),
  ('راهنمای پرونده'),
  ('اخبار و اطلاعیه'),
  ('نکات کارشناسی')
on conflict (name) do nothing;
