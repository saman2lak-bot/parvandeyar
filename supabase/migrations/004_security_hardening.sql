-- 004: سخت‌سازی امنیتی، ساخت خودکار پروفایل و بهینه‌سازی سیاست‌ها
-- این فایل پس از 001، 002 و 003 اجرا می‌شود و اجرای مجدد آن بی‌خطر است.

-- 1) محدودکردن دسترسی توابع SECURITY DEFINER
revoke all on function public.current_user_role() from public;
revoke all on function public.current_user_role() from anon;
grant execute on function public.current_user_role() to authenticated;

revoke all on function public.refresh_case_status() from public;
revoke all on function public.refresh_case_status() from anon;
revoke all on function public.refresh_case_status() from authenticated;

revoke all on function public.rls_auto_enable() from public;
revoke all on function public.rls_auto_enable() from anon;
revoke all on function public.rls_auto_enable() from authenticated;

-- 2) ساخت خودکار پروفایل برای هر کاربر جدید
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(coalesce(new.email, ''), '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.profiles (id, full_name)
select u.id, coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), split_part(coalesce(u.email, ''), '@', 1))
from auth.users u
on conflict (id) do nothing;

-- 3) سیاست‌های پرونده‌ها: خواندن برای همه، ثبت برای کارکنان، ویرایش/حذف برای مدیر
drop policy if exists "staff read cases" on public.cases;
drop policy if exists "admins manage cases" on public.cases;
drop policy if exists "cases read" on public.cases;
drop policy if exists "staff insert cases" on public.cases;
drop policy if exists "admins update cases" on public.cases;
drop policy if exists "admins delete cases" on public.cases;

create policy "cases read" on public.cases
  for select to authenticated
  using (deleted_at is null or (select public.current_user_role()) = 'admin');

create policy "staff insert cases" on public.cases
  for insert to authenticated
  with check ((select public.current_user_role()) in ('admin', 'user'));

create policy "admins update cases" on public.cases
  for update to authenticated
  using ((select public.current_user_role()) = 'admin')
  with check ((select public.current_user_role()) = 'admin');

create policy "admins delete cases" on public.cases
  for delete to authenticated
  using ((select public.current_user_role()) = 'admin');

-- 4) سیاست‌های کارشناسان
drop policy if exists "staff read experts" on public.experts;
drop policy if exists "admins manage experts" on public.experts;
drop policy if exists "experts read" on public.experts;
drop policy if exists "admins insert experts" on public.experts;
drop policy if exists "admins update experts" on public.experts;
drop policy if exists "admins delete experts" on public.experts;

create policy "experts read" on public.experts
  for select to authenticated using (true);

create policy "admins insert experts" on public.experts
  for insert to authenticated
  with check ((select public.current_user_role()) = 'admin');

create policy "admins update experts" on public.experts
  for update to authenticated
  using ((select public.current_user_role()) = 'admin')
  with check ((select public.current_user_role()) = 'admin');

create policy "admins delete experts" on public.experts
  for delete to authenticated
  using ((select public.current_user_role()) = 'admin');

-- 5) سیاست‌های پروفایل‌ها
drop policy if exists "users read own profile" on public.profiles;
drop policy if exists "admins manage profiles" on public.profiles;
drop policy if exists "profiles read own or admin" on public.profiles;
drop policy if exists "admins insert profiles" on public.profiles;
drop policy if exists "admins update profiles" on public.profiles;
drop policy if exists "admins delete profiles" on public.profiles;

create policy "profiles read own or admin" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.current_user_role()) = 'admin');

create policy "admins insert profiles" on public.profiles
  for insert to authenticated
  with check ((select public.current_user_role()) = 'admin');

create policy "admins update profiles" on public.profiles
  for update to authenticated
  using ((select public.current_user_role()) = 'admin')
  with check ((select public.current_user_role()) = 'admin');

create policy "admins delete profiles" on public.profiles
  for delete to authenticated
  using ((select public.current_user_role()) = 'admin');

-- 6) بازسازی سیاست‌های نواقص با ارزیابی یک‌باره نقش
drop policy if exists "staff read deficiencies" on public.case_deficiencies;
drop policy if exists "staff update deficiencies" on public.case_deficiencies;
drop policy if exists "staff insert deficiencies" on public.case_deficiencies;
drop policy if exists "admins delete deficiencies" on public.case_deficiencies;

create policy "staff read deficiencies" on public.case_deficiencies
  for select to authenticated using (true);

create policy "staff insert deficiencies" on public.case_deficiencies
  for insert to authenticated
  with check ((select public.current_user_role()) in ('admin', 'user'));

create policy "staff update deficiencies" on public.case_deficiencies
  for update to authenticated
  using ((select public.current_user_role()) in ('admin', 'user'))
  with check ((select public.current_user_role()) in ('admin', 'user'));

create policy "admins delete deficiencies" on public.case_deficiencies
  for delete to authenticated
  using ((select public.current_user_role()) = 'admin');

-- 7) ایندکس کلیدهای خارجی برای کارایی
create index if not exists cases_expert_id_idx on public.cases(expert_id);
create index if not exists activity_logs_user_id_idx on public.activity_logs(user_id);
create index if not exists deficiencies_resolved_by_idx on public.case_deficiencies(resolved_by);
create index if not exists case_history_case_id_idx on public.case_expert_history(case_id);
create index if not exists case_history_changed_by_idx on public.case_expert_history(changed_by);
create index if not exists case_history_new_expert_idx on public.case_expert_history(new_expert_id);
create index if not exists case_history_previous_expert_idx on public.case_expert_history(previous_expert_id);
