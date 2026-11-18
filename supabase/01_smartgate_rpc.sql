-- SmartGate simplified ERP-ID workflow.
-- Review existing table definitions and RLS policies before running.
-- Required existing tables:
-- student_master(uid text primary key, name, email, mobile, department, year)
-- gate_passes(id uuid, student_uid, reason, destination, status, approved_at, created_at)
-- profiles(id uuid references auth.users, role text, department text)

create or replace function public.smartgate_student_lookup(p_uid text)
returns table(uid text, name text, email text, mobile text, department text, year text)
language sql
security definer
set search_path = public
as $$
  select s.uid, s.name, s.email, s.mobile, s.department, s.year
  from public.student_master s
  where s.uid = p_uid and p_uid ~ '^[0-9]{2,6}$'
  limit 1;
$$;

create or replace function public.smartgate_submit_pass(
  p_uid text, p_reason text, p_destination text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if p_uid is null or p_uid !~ '^[0-9]{2,6}$' then
    raise exception 'Invalid numeric ERP ID';
  end if;
  if length(trim(coalesce(p_reason,''))) < 3 then
    raise exception 'Please enter a valid reason';
  end if;
  if not exists (select 1 from public.student_master where uid = p_uid) then
    raise exception 'ERP ID not found';
  end if;
  if exists (
    select 1 from public.gate_passes
    where student_uid = p_uid and status = 'pending'
      and created_at > now() - interval '30 minutes'
  ) then
    raise exception 'A pending request was already submitted recently';
  end if;
  insert into public.gate_passes(student_uid, reason, destination, status)
  values(p_uid, trim(p_reason), nullif(trim(coalesce(p_destination,'')),''), 'pending')
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.smartgate_security_lookup(p_uid text)
returns table(id uuid, student_uid text, student_name text, reason text,
              destination text, status text, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'security'
  ) then
    raise exception 'Security role required';
  end if;
  return query
    select g.id, g.student_uid, s.name, g.reason, g.destination, g.status, g.created_at
    from public.gate_passes g
    join public.student_master s on s.uid = g.student_uid
    where g.student_uid = p_uid and g.status = 'approved'
    order by g.approved_at desc nulls last
    limit 10;
end;
$$;

revoke all on function public.smartgate_student_lookup(text) from public;
revoke all on function public.smartgate_submit_pass(text,text,text) from public;
revoke all on function public.smartgate_security_lookup(text) from public;
grant execute on function public.smartgate_student_lookup(text) to anon, authenticated;
grant execute on function public.smartgate_submit_pass(text,text,text) to anon, authenticated;
grant execute on function public.smartgate_security_lookup(text) to authenticated;
