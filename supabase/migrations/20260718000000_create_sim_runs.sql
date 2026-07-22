-- Saved cinematic 4-act runs. One immutable row per completed run.
-- verdict stores the computed VerdictSignal[] snapshot with its VERDICT_VERSION
-- so what the user saw is frozen even if lib/verdict.ts heuristics change.

create table if not exists public.sim_runs (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null,
  city_id uuid not null references public.cities(id) on delete restrict,
  community_area_id uuid not null references public.community_areas(id) on delete restrict,
  neighborhood text not null,
  year integer not null default 2024,
  profile_snapshot jsonb not null default '{}'::jsonb,
  act_summaries jsonb not null default '{}'::jsonb,
  verdict jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists sim_runs_user_created_idx
  on public.sim_runs (clerk_user_id, created_at desc);

alter table public.sim_runs enable row level security;

-- No policies: service role bypasses RLS; all access goes through the API.
