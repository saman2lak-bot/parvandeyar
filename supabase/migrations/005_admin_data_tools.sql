-- ابزارهای مدیریتی تنظیمات: داده‌های عملیاتی را مدیریت می‌کنند و profiles/auth.users را حفظ می‌کنند.

create or replace function public.seed_test_cases(requested_count integer default 50)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer;
begin
  if public.current_user_role() <> 'admin' then
    raise exception 'فقط مدیر سیستم می‌تواند داده تست ایجاد کند.' using errcode = '42501';
  end if;

  with new_cases as (
    insert into public.cases (case_year, case_number, insured_name, phone, description, status)
    select
      extract(year from now())::integer,
      (select coalesce(max(case_number), 800000) from public.cases) + series,
      'بیمه‌گذار تست ' || series,
      '0912000' || lpad(series::text, 4, '0'),
      'پرونده ایجادشده برای تست رابط کاربری',
      'needs_review'
    from generate_series(1, greatest(1, least(coalesce(requested_count, 50), 200))) as series
    on conflict (case_year, case_number) do nothing
    returning id
  )
  select count(*)::integer into inserted_count from new_cases;

  return inserted_count;
end;
$$;

create or replace function public.clear_operational_data()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed_count integer;
begin
  if public.current_user_role() <> 'admin' then
    raise exception 'فقط مدیر سیستم می‌تواند داده‌ها را حذف کند.' using errcode = '42501';
  end if;

  select count(*)::integer into removed_count from public.cases;
  truncate table public.case_expert_history, public.activity_logs, public.case_deficiencies, public.cases, public.experts;
  return removed_count;
end;
$$;

revoke all on function public.seed_test_cases(integer) from public, anon;
revoke all on function public.clear_operational_data() from public, anon;
grant execute on function public.seed_test_cases(integer) to authenticated;
grant execute on function public.clear_operational_data() to authenticated;
