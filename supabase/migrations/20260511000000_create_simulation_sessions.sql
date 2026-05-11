-- SimulationSession storage for Clerk-authenticated users.
--
-- Clerk user ids are stored in user_id. When Clerk JWTs are accepted by
-- Supabase, auth.jwt() ->> 'sub' is the Clerk user id used by these policies.

create extension if not exists pgcrypto;

create table if not exists public.simulation_sessions (
  session_id uuid primary key default gen_random_uuid(),
  user_id text not null references public.user_profiles(clerk_user_id) on update cascade on delete cascade,
  community_area_number integer not null check (community_area_number between 1 and 77),
  current_month integer not null default 1 check (current_month between 1 and 12),
  conversation_history jsonb not null default '[]'::jsonb,
  profile_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Adapt the older project schema if this migration is run after schema.sql.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'simulation_sessions'
      and column_name = 'id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'simulation_sessions'
      and column_name = 'session_id'
  ) then
    alter table public.simulation_sessions rename column id to session_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'simulation_sessions'
      and column_name = 'clerk_user_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'simulation_sessions'
      and column_name = 'user_id'
  ) then
    alter table public.simulation_sessions rename column clerk_user_id to user_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'simulation_sessions'
      and column_name = 'persona_snapshot'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'simulation_sessions'
      and column_name = 'profile_snapshot'
  ) then
    alter table public.simulation_sessions rename column persona_snapshot to profile_snapshot;
  end if;
end $$;

alter table public.simulation_sessions
  add column if not exists session_id uuid default gen_random_uuid(),
  add column if not exists user_id text,
  add column if not exists community_area_number integer,
  add column if not exists current_month integer not null default 1,
  add column if not exists conversation_history jsonb not null default '[]'::jsonb,
  add column if not exists profile_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

update public.simulation_sessions
set session_id = gen_random_uuid()
where session_id is null;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'simulation_sessions'
      and column_name = 'user_profile_id'
  ) then
    execute $sql$
      update public.simulation_sessions s
      set user_id = up.clerk_user_id
      from public.user_profiles up
      where s.user_id is null
        and s.user_profile_id = up.id
    $sql$;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'simulation_sessions'
      and column_name = 'community_area_id'
  ) then
    execute $sql$
      update public.simulation_sessions s
      set community_area_number = ca.community_area_number
      from public.community_areas ca
      where s.community_area_number is null
        and s.community_area_id = ca.id
    $sql$;
  end if;
end $$;

do $$
begin
  if to_regclass('public.conversation_messages') is not null then
    update public.simulation_sessions s
    set conversation_history = coalesce(
      (
        select jsonb_agg(
          jsonb_build_object('role', m.role, 'content', m.content)
          order by m.created_at
        )
        from public.conversation_messages m
        where m.session_id = s.session_id
          and m.role in ('user', 'assistant', 'system')
      ),
      '[]'::jsonb
    )
    where s.conversation_history = '[]'::jsonb;
  end if;
end $$;

alter table public.simulation_sessions
  alter column session_id set not null,
  alter column user_id set not null,
  alter column community_area_number set not null,
  alter column current_month set not null,
  alter column conversation_history set not null,
  alter column profile_snapshot set not null,
  alter column created_at set not null,
  alter column updated_at set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.simulation_sessions'::regclass
      and contype = 'p'
  ) then
    alter table public.simulation_sessions
      add constraint simulation_sessions_pkey primary key (session_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.simulation_sessions'::regclass
      and conname = 'simulation_sessions_user_id_fkey'
  ) then
    alter table public.simulation_sessions
      add constraint simulation_sessions_user_id_fkey
      foreign key (user_id)
      references public.user_profiles(clerk_user_id)
      on update cascade
      on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.simulation_sessions'::regclass
      and conname = 'simulation_sessions_current_month_check'
  ) then
    alter table public.simulation_sessions
      add constraint simulation_sessions_current_month_check
      check (current_month between 1 and 12);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.simulation_sessions'::regclass
      and conname = 'simulation_sessions_community_area_number_check'
  ) then
    alter table public.simulation_sessions
      add constraint simulation_sessions_community_area_number_check
      check (community_area_number between 1 and 77);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.simulation_sessions'::regclass
      and conname = 'simulation_sessions_conversation_history_is_array'
  ) then
    alter table public.simulation_sessions
      add constraint simulation_sessions_conversation_history_is_array
      check (jsonb_typeof(conversation_history) = 'array');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.simulation_sessions'::regclass
      and conname = 'simulation_sessions_profile_snapshot_is_object'
  ) then
    alter table public.simulation_sessions
      add constraint simulation_sessions_profile_snapshot_is_object
      check (jsonb_typeof(profile_snapshot) = 'object');
  end if;
end $$;

create index if not exists simulation_sessions_user_id_idx
  on public.simulation_sessions (user_id, updated_at desc);

create index if not exists simulation_sessions_community_area_number_idx
  on public.simulation_sessions (community_area_number);

create index if not exists simulation_sessions_user_area_idx
  on public.simulation_sessions (user_id, community_area_number, updated_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_simulation_sessions_updated_at on public.simulation_sessions;
create trigger set_simulation_sessions_updated_at
before update on public.simulation_sessions
for each row
execute function public.set_updated_at();

create or replace function public.current_clerk_user_id()
returns text
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'sub', '')
$$;

alter table public.simulation_sessions enable row level security;

drop policy if exists "users can read own simulation sessions" on public.simulation_sessions;
create policy "users can read own simulation sessions"
  on public.simulation_sessions
  for select
  to authenticated
  using (user_id = public.current_clerk_user_id());

drop policy if exists "users can create own simulation sessions" on public.simulation_sessions;
create policy "users can create own simulation sessions"
  on public.simulation_sessions
  for insert
  to authenticated
  with check (user_id = public.current_clerk_user_id());

drop policy if exists "users can update own simulation sessions" on public.simulation_sessions;
create policy "users can update own simulation sessions"
  on public.simulation_sessions
  for update
  to authenticated
  using (user_id = public.current_clerk_user_id())
  with check (user_id = public.current_clerk_user_id());

drop policy if exists "users can delete own simulation sessions" on public.simulation_sessions;
create policy "users can delete own simulation sessions"
  on public.simulation_sessions
  for delete
  to authenticated
  using (user_id = public.current_clerk_user_id());

grant select, insert, update, delete on public.simulation_sessions to authenticated;
