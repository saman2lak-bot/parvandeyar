-- 007: Blog posts
create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 2 and 180),
  excerpt text not null default '',
  content text not null check (char_length(trim(content)) >= 2),
  category text not null default 'آموزش بیمه',
  status text not null default 'draft' check (status in ('draft', 'published')),
  author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists blog_posts_category_idx on public.blog_posts(category);
create index if not exists blog_posts_status_created_idx on public.blog_posts(status, created_at desc);

alter table public.blog_posts enable row level security;

drop policy if exists "blog posts readable by authenticated users" on public.blog_posts;
create policy "blog posts readable by authenticated users" on public.blog_posts
  for select to authenticated using (true);

drop policy if exists "blog posts manageable by admins" on public.blog_posts;
create policy "blog posts manageable by admins" on public.blog_posts
  for all to authenticated using ((select public.current_user_role()) = 'admin') with check ((select public.current_user_role()) = 'admin');

create or replace function public.blog_posts_set_updated_at()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists blog_posts_updated_at on public.blog_posts;
create trigger blog_posts_updated_at before update on public.blog_posts
  for each row execute function public.blog_posts_set_updated_at();
