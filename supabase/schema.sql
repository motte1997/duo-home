-- =====================================================================
-- Duo Home – Datenbankschema für Supabase (Postgres)
-- Ausführen: Supabase Dashboard -> SQL Editor -> New query -> einfügen -> Run
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Tabellen
-- ---------------------------------------------------------------------
create table if not exists public.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default 'Unser Zuhause',
  timezone    text not null default 'Europe/Berlin',
  invite_code text not null unique
              default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
  created_at  timestamptz not null default now()
);

create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) > 0),
  color        text not null default '#0A84FF',
  emoji        text not null default '🙂',
  created_at   timestamptz not null default now()
);
create index if not exists profiles_household_idx on public.profiles(household_id);

-- Maximal 2 Personen pro Haushalt
create or replace function public.enforce_max_two_members()
returns trigger language plpgsql as $$
begin
  if (select count(*) from public.profiles
       where household_id = new.household_id and id <> new.id) >= 2 then
    raise exception 'Dieser Haushalt ist bereits voll (maximal 2 Personen).';
  end if;
  return new;
end $$;

drop trigger if exists profiles_max_two on public.profiles;
create trigger profiles_max_two
  before insert or update of household_id on public.profiles
  for each row execute function public.enforce_max_two_members();

-- Aufgabenvorlage
create table if not exists public.tasks (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  title         text not null check (length(trim(title)) > 0),
  notes         text,
  points        int  not null default 1 check (points between 0 and 1000),
  -- Zuweisung: fixed = feste Person, open = wer zuerst, alternate = abwechselnd
  assignment    text not null default 'open' check (assignment in ('fixed','open','alternate')),
  assignee      uuid references public.profiles(id) on delete set null,
  -- Wiederholung
  recurrence    text not null default 'none'
                check (recurrence in ('none','daily','weekly','every_n_days','monthly','custom')),
  interval_n    int  not null default 1 check (interval_n between 1 and 365),
  interval_unit text not null default 'day' check (interval_unit in ('day','week','month')), -- nur custom
  weekdays      int[] not null default '{}',   -- ISO: 1 = Montag ... 7 = Sonntag
  month_day     int check (month_day between 1 and 31),
  -- fixed = fester Rhythmus, after_completion = ab Erledigung
  repeat_mode   text not null default 'fixed' check (repeat_mode in ('fixed','after_completion')),
  start_date    date not null default current_date,
  end_date      date,
  reminder_time time not null default '08:00',
  archived      boolean not null default false,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists tasks_household_idx on public.tasks(household_id);

-- Konkrete Aufgabe (Instanz einer Vorlage)
create table if not exists public.task_occurrences (
  id                      uuid primary key default gen_random_uuid(),
  task_id                 uuid not null references public.tasks(id) on delete cascade,
  household_id            uuid not null references public.households(id) on delete cascade,
  due_date                date not null,
  assigned_to             uuid references public.profiles(id) on delete set null,
  status                  text not null default 'open' check (status in ('open','done','skipped')),
  completed_by            uuid references public.profiles(id) on delete set null,
  completed_at            timestamptz,
  points_awarded          int,
  spawned_occurrence_id   uuid,   -- die durch Erledigen/Überspringen erzeugte Folgeinstanz
  created_at              timestamptz not null default now()
);
create index if not exists occ_household_status_idx on public.task_occurrences(household_id, status, due_date);
create index if not exists occ_task_idx on public.task_occurrences(task_id);

-- Punkte-Ledger (Historie). title = Schnappschuss, bleibt auch nach Löschen der Aufgabe erhalten.
create table if not exists public.point_events (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  occurrence_id uuid references public.task_occurrences(id) on delete set null,
  task_id       uuid references public.tasks(id) on delete set null,
  title         text not null,
  points        int  not null,
  local_date    date not null,
  created_at    timestamptz not null default now()
);
create index if not exists events_household_idx on public.point_events(household_id, local_date);
create index if not exists events_occ_idx on public.point_events(occurrence_id);

create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

-- Verhindert doppelte Erinnerungen (nur Service-Role)
create table if not exists public.notification_log (
  user_id       uuid not null,
  occurrence_id uuid not null,
  kind          text not null,
  local_date    date not null,
  sent_at       timestamptz not null default now(),
  primary key (user_id, occurrence_id, kind, local_date)
);

-- ---------------------------------------------------------------------
-- Hilfsfunktionen
-- ---------------------------------------------------------------------
create or replace function public.current_household()
returns uuid language sql stable security definer set search_path = public as $$
  select household_id from public.profiles where id = auth.uid()
$$;

-- Nächstes Fälligkeitsdatum einer Vorlage ausgehend von base
create or replace function public.compute_next_due(t public.tasks, base date)
returns date language plpgsql immutable as $$
declare
  unit text; n int; cand date; wk_start date; i int; dow int;
  first_of_month date; m date; dom int; last_dom int;
begin
  case t.recurrence
    when 'daily'        then unit := 'day';   n := 1;
    when 'every_n_days' then unit := 'day';   n := t.interval_n;
    when 'weekly'       then unit := 'week';  n := t.interval_n;
    when 'monthly'      then unit := 'month'; n := t.interval_n;
    when 'custom'       then unit := t.interval_unit; n := t.interval_n;
    else return null;
  end case;

  if unit = 'day' then
    return base + n;

  elsif unit = 'week' then
    if coalesce(array_length(t.weekdays, 1), 0) = 0 then
      return base + 7 * n;
    end if;
    dow := extract(isodow from base)::int;
    -- späterer Wochentag in derselben Woche?
    for i in 1..(7 - dow) loop
      if (dow + i) = any(t.weekdays) then
        return base + i;
      end if;
    end loop;
    -- sonst: erster passender Wochentag in der Woche n Wochen später
    wk_start := base - (dow - 1) + 7 * n;
    for i in 0..6 loop
      if (i + 1) = any(t.weekdays) then
        return wk_start + i;
      end if;
    end loop;
    return base + 7 * n;

  else -- month
    first_of_month := base - (extract(day from base)::int - 1);
    m := (first_of_month + make_interval(months => n))::date;
    dom := coalesce(t.month_day, extract(day from base)::int);
    last_dom := extract(day from ((m + interval '1 month') - interval '1 day'))::int;
    return m + (least(dom, last_dom) - 1);
  end if;
end $$;

-- Folgeinstanz anlegen (nach Erledigen oder Überspringen)
create or replace function public.spawn_next_occurrence(
  occ public.task_occurrences, t public.tasks, today date, actor uuid
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  base date; nd date; guard int := 0; next_assignee uuid; new_id uuid;
begin
  if t.recurrence = 'none' or t.archived then
    return null;
  end if;

  base := case when t.repeat_mode = 'after_completion' then today else occ.due_date end;
  nd := public.compute_next_due(t, base);
  -- verpasste Termine beim festen Rhythmus überspringen
  while nd is not null and nd < today and guard < 400 loop
    nd := public.compute_next_due(t, nd);
    guard := guard + 1;
  end loop;

  if nd is null or (t.end_date is not null and nd > t.end_date) then
    return null;
  end if;

  if t.assignment = 'fixed' then
    next_assignee := t.assignee;
  elsif t.assignment = 'alternate' then
    select p.id into next_assignee
      from public.profiles p
     where p.household_id = t.household_id
       and p.id <> coalesce(occ.assigned_to, actor)
     limit 1;
    next_assignee := coalesce(next_assignee, occ.assigned_to, actor);
  else
    next_assignee := null;
  end if;

  insert into public.task_occurrences(task_id, household_id, due_date, assigned_to)
  values (t.id, t.household_id, nd, next_assignee)
  returning id into new_id;
  return new_id;
end $$;

-- ---------------------------------------------------------------------
-- Trigger auf tasks
-- ---------------------------------------------------------------------
-- Erste Instanz beim Anlegen
create or replace function public.tasks_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare who uuid;
begin
  who := case new.assignment when 'open' then null else coalesce(new.assignee, new.created_by) end;
  insert into public.task_occurrences(task_id, household_id, due_date, assigned_to)
  values (new.id, new.household_id, new.start_date, who);
  return new;
end $$;

drop trigger if exists tasks_ai on public.tasks;
create trigger tasks_ai after insert on public.tasks
  for each row execute function public.tasks_after_insert();

-- Änderungen an Zuweisung / Archivierung auf offene Instanzen übertragen
create or replace function public.tasks_after_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare tz text; today date; who uuid;
begin
  if new.archived and not old.archived then
    delete from public.task_occurrences where task_id = new.id and status = 'open';

  elsif not new.archived and old.archived then
    select timezone into tz from public.households where id = new.household_id;
    today := (now() at time zone tz)::date;
    if not exists (select 1 from public.task_occurrences where task_id = new.id and status = 'open') then
      who := case new.assignment when 'open' then null else new.assignee end;
      insert into public.task_occurrences(task_id, household_id, due_date, assigned_to)
      values (new.id, new.household_id, greatest(new.start_date, today), who);
    end if;

  elsif new.assignment is distinct from old.assignment or new.assignee is distinct from old.assignee then
    who := case new.assignment when 'open' then null else new.assignee end;
    update public.task_occurrences set assigned_to = who
     where task_id = new.id and status = 'open';
  end if;
  return new;
end $$;

drop trigger if exists tasks_au on public.tasks;
create trigger tasks_au after update on public.tasks
  for each row execute function public.tasks_after_update();

-- ---------------------------------------------------------------------
-- RPC: Haushalt anlegen / beitreten
-- ---------------------------------------------------------------------
create or replace function public.create_household(
  p_name text, p_display_name text, p_color text, p_emoji text, p_tz text
) returns public.households language plpgsql security definer set search_path = public as $$
declare h public.households;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  if exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'Du gehörst bereits zu einem Haushalt.';
  end if;
  insert into public.households(name, timezone)
  values (coalesce(nullif(trim(p_name), ''), 'Unser Zuhause'), coalesce(nullif(p_tz, ''), 'Europe/Berlin'))
  returning * into h;
  insert into public.profiles(id, household_id, display_name, color, emoji)
  values (auth.uid(), h.id, trim(p_display_name), p_color, p_emoji);
  return h;
end $$;

create or replace function public.join_household(
  p_code text, p_display_name text, p_color text, p_emoji text
) returns public.households language plpgsql security definer set search_path = public as $$
declare h public.households;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  if exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'Du gehörst bereits zu einem Haushalt.';
  end if;
  select * into h from public.households where invite_code = upper(trim(p_code));
  if not found then raise exception 'Einladungscode nicht gefunden.'; end if;
  insert into public.profiles(id, household_id, display_name, color, emoji)
  values (auth.uid(), h.id, trim(p_display_name), p_color, p_emoji);
  return h;
end $$;

-- ---------------------------------------------------------------------
-- RPC: Aufgaben erledigen / rückgängig / überspringen
-- ---------------------------------------------------------------------
create or replace function public.complete_occurrence(p_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  occ public.task_occurrences; t public.tasks; h public.households;
  me uuid := auth.uid(); today date; new_id uuid;
begin
  select * into occ from public.task_occurrences where id = p_id for update;
  if not found or occ.household_id is distinct from public.current_household() then
    raise exception 'Aufgabe nicht gefunden.';
  end if;
  if occ.status <> 'open' then
    return occ.spawned_occurrence_id;  -- idempotent
  end if;

  select * into t from public.tasks where id = occ.task_id;
  select * into h from public.households where id = occ.household_id;
  today := (now() at time zone h.timezone)::date;

  insert into public.point_events(household_id, user_id, occurrence_id, task_id, title, points, local_date)
  values (occ.household_id, me, occ.id, t.id, t.title, t.points, today);

  new_id := public.spawn_next_occurrence(occ, t, today, me);

  update public.task_occurrences
     set status = 'done', completed_by = me, completed_at = now(),
         points_awarded = t.points, spawned_occurrence_id = new_id
   where id = p_id;
  return new_id;
end $$;

create or replace function public.undo_occurrence(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare occ public.task_occurrences;
begin
  select * into occ from public.task_occurrences where id = p_id for update;
  if not found or occ.household_id is distinct from public.current_household() then
    raise exception 'Aufgabe nicht gefunden.';
  end if;
  if occ.status = 'open' then return; end if;

  delete from public.point_events where occurrence_id = p_id;
  if occ.spawned_occurrence_id is not null then
    delete from public.task_occurrences where id = occ.spawned_occurrence_id and status = 'open';
  end if;
  update public.task_occurrences
     set status = 'open', completed_by = null, completed_at = null,
         points_awarded = null, spawned_occurrence_id = null
   where id = p_id;
end $$;

create or replace function public.skip_occurrence(p_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  occ public.task_occurrences; t public.tasks; h public.households;
  today date; new_id uuid;
begin
  select * into occ from public.task_occurrences where id = p_id for update;
  if not found or occ.household_id is distinct from public.current_household() then
    raise exception 'Aufgabe nicht gefunden.';
  end if;
  if occ.status <> 'open' then return null; end if;
  select * into t from public.tasks where id = occ.task_id;
  select * into h from public.households where id = occ.household_id;
  today := (now() at time zone h.timezone)::date;

  new_id := public.spawn_next_occurrence(occ, t, today, auth.uid());
  update public.task_occurrences
     set status = 'skipped', completed_by = auth.uid(), completed_at = now(),
         spawned_occurrence_id = new_id
   where id = p_id;
  return new_id;
end $$;

-- ---------------------------------------------------------------------
-- Erinnerungen: wird von der Edge Function (Service-Role) aufgerufen
-- ---------------------------------------------------------------------
create or replace function public.get_due_notifications()
returns table(out_user_id uuid, out_occurrence_id uuid, out_kind text, out_title text)
language plpgsql security definer set search_path = public as $$
begin
  return query
  with cand as (
    select o.id as oid, o.assigned_to, o.household_id, o.due_date, t.title, t.reminder_time,
           (now() at time zone h.timezone) as local_now
      from public.task_occurrences o
      join public.tasks t on t.id = o.task_id
      join public.households h on h.id = o.household_id
     where o.status = 'open'
  ),
  kinds as (
    select c.*,
           case
             when c.due_date = c.local_now::date and c.local_now::time >= c.reminder_time then 'due'
             when c.due_date <  c.local_now::date and c.local_now::time >= time '09:00'    then 'overdue'
           end as kind
      from cand c
  ),
  recips as (
    select k.oid, k.title, k.kind, k.local_now::date as ld, p.id as uid
      from kinds k
      join public.profiles p on p.household_id = k.household_id
     where k.kind is not null
       and (k.assigned_to is null or k.assigned_to = p.id)
  ),
  ins as (
    insert into public.notification_log(user_id, occurrence_id, kind, local_date)
    select uid, oid, kind, ld from recips
    on conflict do nothing
    returning user_id, occurrence_id, kind
  )
  select r.uid, r.oid, r.kind, r.title
    from ins
    join recips r on r.uid = ins.user_id and r.oid = ins.occurrence_id and r.kind = ins.kind;
end $$;

revoke execute on function public.get_due_notifications() from public, anon, authenticated;
revoke execute on function public.spawn_next_occurrence(public.task_occurrences, public.tasks, date, uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.households         enable row level security;
alter table public.profiles           enable row level security;
alter table public.tasks              enable row level security;
alter table public.task_occurrences   enable row level security;
alter table public.point_events       enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_log   enable row level security;

drop policy if exists households_select on public.households;
create policy households_select on public.households for select
  using (id = public.current_household());
drop policy if exists households_update on public.households;
create policy households_update on public.households for update
  using (id = public.current_household()) with check (id = public.current_household());

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (household_id = public.current_household());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and household_id = public.current_household());

drop policy if exists tasks_all on public.tasks;
create policy tasks_all on public.tasks for all
  using (household_id = public.current_household())
  with check (household_id = public.current_household());

drop policy if exists occ_all on public.task_occurrences;
create policy occ_all on public.task_occurrences for all
  using (household_id = public.current_household())
  with check (household_id = public.current_household());

drop policy if exists events_select on public.point_events;
create policy events_select on public.point_events for select
  using (household_id = public.current_household());

drop policy if exists push_own on public.push_subscriptions;
create policy push_own on public.push_subscriptions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- notification_log: keine Policy => nur Service-Role

-- ---------------------------------------------------------------------
-- Realtime (Partner-Änderungen live)
-- ---------------------------------------------------------------------
do $$
declare tbl text;
begin
  foreach tbl in array array['tasks','task_occurrences','point_events','profiles'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', tbl);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
