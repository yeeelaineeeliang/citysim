-- wards: one row per City Council ward (Chicago has 50, 2023-present boundaries)
create table if not exists public.wards (
  ward_id           integer primary key,
  boundary_version  text not null default '2023-present',
  created_at        timestamptz not null default timezone('utc', now())
);

-- community_area_ward_overlap: genuine M:N verified by GIS overlay of official
-- City of Chicago boundary datasets (cauq-8yn6 × p293-wvbd).
create table if not exists public.community_area_ward_overlap (
  community_area_id     uuid    not null references public.community_areas(id) on delete cascade,
  ward_id               integer not null references public.wards(ward_id)      on delete cascade,
  overlap_sq_miles      numeric(10, 6) not null,
  pct_of_community_area numeric(6, 3),
  pct_of_ward           numeric(6, 3),
  primary key (community_area_id, ward_id),
  check (overlap_sq_miles > 0),
  check (pct_of_community_area between 0 and 100),
  check (pct_of_ward between 0 and 100)
);

create index if not exists ward_overlap_ward_id_idx
  on public.community_area_ward_overlap (ward_id);

alter table public.wards enable row level security;
alter table public.community_area_ward_overlap enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'wards'
      and policyname = 'public read wards'
  ) then
    create policy "public read wards"
      on public.wards for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'community_area_ward_overlap'
      and policyname = 'public read ward overlap'
  ) then
    create policy "public read ward overlap"
      on public.community_area_ward_overlap for select using (true);
  end if;
end $$;
