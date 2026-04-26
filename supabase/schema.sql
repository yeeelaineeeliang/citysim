create table if not exists public.cta_bus_ridership_v1 (
  route text not null,
  service_date date not null,
  day_type text not null,
  rides integer not null,
  community_area integer not null default 41,
  neighborhood text not null default 'Hyde Park',
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (route, service_date)
);

create index if not exists cta_bus_ridership_v1_community_area_service_date_idx
  on public.cta_bus_ridership_v1 (community_area, service_date);

alter table public.cta_bus_ridership_v1 enable row level security;

drop policy if exists "public read cta bus ridership v1" on public.cta_bus_ridership_v1;
create policy "public read cta bus ridership v1"
  on public.cta_bus_ridership_v1
  for select
  using (true);
