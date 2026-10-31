-- سیاست‌های لازم برای افزودن و حذف نواقص از رابط کاربری
-- افزودن نقص برای همه کاربران واردشده (admin و user) مجاز است
drop policy if exists "staff insert deficiencies" on public.case_deficiencies;
create policy "staff insert deficiencies" on public.case_deficiencies
  for insert to authenticated
  with check (public.current_user_role() in ('admin', 'user'));

-- حذف نقص تنها برای مدیران مجاز است
drop policy if exists "admins delete deficiencies" on public.case_deficiencies;
create policy "admins delete deficiencies" on public.case_deficiencies
  for delete to authenticated
  using (public.current_user_role() = 'admin');

-- اطمینان از وجود سیاست به‌روزرسانی برای تغییر وضعیت نواقص
drop policy if exists "staff update deficiencies" on public.case_deficiencies;
create policy "staff update deficiencies" on public.case_deficiencies
  for update to authenticated
  using (public.current_user_role() in ('admin', 'user'))
  with check (public.current_user_role() in ('admin', 'user'));
