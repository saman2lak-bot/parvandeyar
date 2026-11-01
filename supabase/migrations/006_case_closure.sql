-- 006: مختومه کردن پرونده
-- این فایل پس از 001 تا 005 اجرا می‌شود و اجرای مجدد آن بی‌خطر است.
-- با مختومه شدن، پرونده در وضعیت «closed» قرار می‌گیرد و تا بازگشایی،
-- هیچ تغییری در نواقص آن وضعیت را جابه‌جا نمی‌کند.

-- 1) ستون‌های لازم برای ثبت مختومه شدن
alter table public.cases add column if not exists closed_at timestamptz;
alter table public.cases add column if not exists closed_by uuid references auth.users(id) on delete set null;
alter table public.cases add column if not exists closure_note text;

create index if not exists cases_closed_at_idx on public.cases(closed_at);
create index if not exists cases_closed_by_idx on public.cases(closed_by);

-- 2) محاسبه وضعیت پرونده فقط بر اساس نواقص آن (بدون توجه به مختومه بودن)
create or replace function public.case_status_from_deficiencies(target_case uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when not exists (select 1 from public.case_deficiencies where case_id = target_case) then 'no_deficiencies'
    when not exists (select 1 from public.case_deficiencies where case_id = target_case and is_resolved = false) then 'completed'
    else 'needs_review'
  end
$$;

revoke all on function public.case_status_from_deficiencies(uuid) from public, anon, authenticated;

-- 3) با تغییر نواقص، وضعیت پرونده به‌روز می‌شود؛ پرونده مختومه وضعیت خود را حفظ می‌کند.
create or replace function public.refresh_case_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_case uuid := coalesce(new.case_id, old.case_id);
  case_is_closed boolean;
begin
  select closed_at is not null into case_is_closed from public.cases where id = target_case;
  update public.cases
     set status = case
                    when coalesce(case_is_closed, false) then 'closed'
                    else public.case_status_from_deficiencies(target_case)
                  end,
         updated_at = now()
   where id = target_case;
  return coalesce(new, old);
end
$$;

revoke all on function public.refresh_case_status() from public, anon, authenticated;

-- 4) تغییر closed_at همان ردیف، وضعیت را همراه خود به‌روز می‌کند
create or replace function public.apply_case_closure_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.closed_at is not null then
    new.status := 'closed';
  elsif old.closed_at is not null then
    new.status := public.case_status_from_deficiencies(new.id);
  end if;
  return new;
end
$$;

revoke all on function public.apply_case_closure_status() from public, anon, authenticated;

drop trigger if exists cases_closure_status_trigger on public.cases;
create trigger cases_closure_status_trigger
  before update on public.cases
  for each row execute function public.apply_case_closure_status();
