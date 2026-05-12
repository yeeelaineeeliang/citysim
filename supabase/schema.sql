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

-- CityLiving Sim core schema.
-- Additive only: the existing cta_bus_ridership_v1 proof table above remains intact.

create extension if not exists pgcrypto;

create table if not exists public.cities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  state text,
  country text not null default 'US',
  timezone text not null default 'America/Chicago',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.community_areas (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities(id) on delete cascade,
  community_area_number integer not null,
  name text not null,
  slug text not null,
  centroid_lat double precision,
  centroid_lng double precision,
  population integer,
  area_sq_miles numeric(10, 4),
  descriptors text[] not null default '{}',
  boundary_geojson jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (city_id, community_area_number),
  unique (city_id, slug)
);

create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null unique,
  budget_min integer,
  budget_max integer,
  workplace_name text,
  workplace_address text,
  workplace_lat double precision,
  workplace_lng double precision,
  commute_preference text not null default 'transit',
  priority_safety integer not null default 3 check (priority_safety between 1 and 5),
  priority_transit integer not null default 3 check (priority_transit between 1 and 5),
  priority_affordability integer not null default 3 check (priority_affordability between 1 and 5),
  priority_city_services integer not null default 3 check (priority_city_services between 1 and 5),
  priority_entertainment integer not null default 3 check (priority_entertainment between 1 and 5),
  lifestyle_tags text[] not null default '{}',
  notes text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.simulation_sessions (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities(id) on delete restrict,
  community_area_id uuid not null references public.community_areas(id) on delete restrict,
  user_profile_id uuid references public.user_profiles(id) on delete set null,
  clerk_user_id text,
  status text not null default 'active',
  start_year integer not null default 2024,
  current_month integer not null default 1 check (current_month between 1 and 12),
  persona_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.simulation_sessions(id) on delete cascade,
  city_id uuid not null references public.cities(id) on delete restrict,
  community_area_id uuid not null references public.community_areas(id) on delete restrict,
  month integer not null check (month between 1 and 12),
  year integer not null,
  role text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content text not null,
  tool_name text,
  tool_result jsonb,
  citations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.crime_monthly (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities(id) on delete cascade,
  community_area_id uuid not null references public.community_areas(id) on delete cascade,
  year integer not null,
  month integer not null check (month between 1 and 12),
  incident_count integer not null default 0,
  by_type jsonb not null default '{}'::jsonb,
  violent_count integer not null default 0,
  property_count integer not null default 0,
  trend_label text,
  source text not null default 'Chicago Data Portal Crimes',
  updated_at timestamptz not null default timezone('utc', now()),
  unique (city_id, community_area_id, year, month)
);

create table if not exists public.transit_monthly (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities(id) on delete cascade,
  community_area_id uuid not null references public.community_areas(id) on delete cascade,
  year integer not null,
  month integer not null check (month between 1 and 12),
  bus_ridership integer not null default 0,
  l_ridership integer not null default 0,
  metra_ridership integer not null default 0,
  crowding_level text not null default 'unknown',
  avg_peak_wait_minutes numeric(6, 2),
  route_summary jsonb not null default '{}'::jsonb,
  stop_summary jsonb not null default '{}'::jsonb,
  source text not null default 'CTA ridership',
  updated_at timestamptz not null default timezone('utc', now()),
  unique (city_id, community_area_id, year, month)
);

create table if not exists public.service_requests_311_monthly (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities(id) on delete cascade,
  community_area_id uuid not null references public.community_areas(id) on delete cascade,
  year integer not null,
  month integer not null check (month between 1 and 12),
  total_requests integer not null default 0,
  by_type jsonb not null default '{}'::jsonb,
  avg_response_days numeric(8, 2),
  median_response_days numeric(8, 2),
  open_request_count integer not null default 0,
  source text not null default 'Chicago Data Portal 311',
  updated_at timestamptz not null default timezone('utc', now()),
  unique (city_id, community_area_id, year, month)
);

create table if not exists public.housing_metrics (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities(id) on delete cascade,
  community_area_id uuid not null references public.community_areas(id) on delete cascade,
  year integer not null,
  affordable_units integer not null default 0,
  affordable_developments integer not null default 0,
  avg_rent_estimate integer,
  median_rent_estimate integer,
  source text not null default 'Affordable Rental Housing Developments',
  updated_at timestamptz not null default timezone('utc', now()),
  unique (city_id, community_area_id, year)
);

create table if not exists public.entertainment_metrics (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities(id) on delete cascade,
  community_area_id uuid not null references public.community_areas(id) on delete cascade,
  year integer not null,
  restaurants integer not null default 0,
  bars integer not null default 0,
  parks jsonb not null default '[]'::jsonb,
  libraries jsonb not null default '[]'::jsonb,
  farmers_markets boolean not null default false,
  source text not null default 'Chicago Data Portal amenities',
  updated_at timestamptz not null default timezone('utc', now()),
  unique (city_id, community_area_id, year)
);

create table if not exists public.street_view_cache (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities(id) on delete cascade,
  community_area_id uuid not null references public.community_areas(id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  heading integer,
  pitch integer,
  fov integer,
  image_url text,
  storage_path text,
  metadata jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  unique (city_id, community_area_id)
);

create table if not exists public.model_predictions (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities(id) on delete cascade,
  community_area_id uuid not null references public.community_areas(id) on delete cascade,
  prediction_type text not null,
  target_year integer not null,
  target_month integer not null check (target_month between 1 and 12),
  value jsonb not null default '{}'::jsonb,
  confidence numeric(5, 4),
  model_name text,
  model_version text,
  generated_at timestamptz not null default timezone('utc', now()),
  unique (city_id, community_area_id, prediction_type, target_year, target_month, model_version)
);

create table if not exists public.demo_qa_cache (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities(id) on delete cascade,
  community_area_id uuid not null references public.community_areas(id) on delete cascade,
  year integer not null,
  month integer not null check (month between 1 and 12),
  question text not null,
  answer text not null,
  tools_used text[] not null default '{}',
  data_context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  unique (city_id, community_area_id, year, month, question)
);

create index if not exists community_areas_city_name_idx
  on public.community_areas (city_id, name);

create index if not exists user_profiles_clerk_user_id_idx
  on public.user_profiles (clerk_user_id);

create index if not exists simulation_sessions_user_profile_idx
  on public.simulation_sessions (user_profile_id, created_at desc);

create index if not exists simulation_sessions_clerk_user_area_year_idx
  on public.simulation_sessions (clerk_user_id, community_area_id, start_year, status, created_at desc);

create index if not exists conversation_messages_session_created_idx
  on public.conversation_messages (session_id, created_at);

create index if not exists crime_monthly_lookup_idx
  on public.crime_monthly (city_id, community_area_id, year, month);

create index if not exists transit_monthly_lookup_idx
  on public.transit_monthly (city_id, community_area_id, year, month);

create index if not exists service_requests_311_monthly_lookup_idx
  on public.service_requests_311_monthly (city_id, community_area_id, year, month);

create index if not exists housing_metrics_lookup_idx
  on public.housing_metrics (city_id, community_area_id, year);

create index if not exists entertainment_metrics_lookup_idx
  on public.entertainment_metrics (city_id, community_area_id, year);

create index if not exists street_view_cache_lookup_idx
  on public.street_view_cache (city_id, community_area_id);

create index if not exists model_predictions_lookup_idx
  on public.model_predictions (city_id, community_area_id, prediction_type, target_year, target_month);

create index if not exists demo_qa_cache_lookup_idx
  on public.demo_qa_cache (city_id, community_area_id, year, month);

alter table public.cities enable row level security;
alter table public.community_areas enable row level security;
alter table public.user_profiles enable row level security;
alter table public.simulation_sessions enable row level security;
alter table public.conversation_messages enable row level security;
alter table public.crime_monthly enable row level security;
alter table public.transit_monthly enable row level security;
alter table public.service_requests_311_monthly enable row level security;
alter table public.housing_metrics enable row level security;
alter table public.entertainment_metrics enable row level security;
alter table public.street_view_cache enable row level security;
alter table public.model_predictions enable row level security;
alter table public.demo_qa_cache enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'cities' and policyname = 'public read cities') then
    create policy "public read cities" on public.cities for select using (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'community_areas' and policyname = 'public read community areas') then
    create policy "public read community areas" on public.community_areas for select using (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'crime_monthly' and policyname = 'public read crime monthly') then
    create policy "public read crime monthly" on public.crime_monthly for select using (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'transit_monthly' and policyname = 'public read transit monthly') then
    create policy "public read transit monthly" on public.transit_monthly for select using (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'service_requests_311_monthly' and policyname = 'public read 311 monthly') then
    create policy "public read 311 monthly" on public.service_requests_311_monthly for select using (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'housing_metrics' and policyname = 'public read housing metrics') then
    create policy "public read housing metrics" on public.housing_metrics for select using (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'entertainment_metrics' and policyname = 'public read entertainment metrics') then
    create policy "public read entertainment metrics" on public.entertainment_metrics for select using (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'street_view_cache' and policyname = 'public read street view cache') then
    create policy "public read street view cache" on public.street_view_cache for select using (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'model_predictions' and policyname = 'public read model predictions') then
    create policy "public read model predictions" on public.model_predictions for select using (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'demo_qa_cache' and policyname = 'public read demo qa cache') then
    create policy "public read demo qa cache" on public.demo_qa_cache for select using (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'user_profiles' and policyname = 'service role manages user profiles') then
    create policy "service role manages user profiles" on public.user_profiles for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'simulation_sessions' and policyname = 'service role manages simulation sessions') then
    create policy "service role manages simulation sessions" on public.simulation_sessions for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'conversation_messages' and policyname = 'service role manages conversation messages') then
    create policy "service role manages conversation messages" on public.conversation_messages for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
  end if;
end $$;

insert into public.cities (slug, name, state, country, timezone)
values ('chicago', 'Chicago', 'IL', 'US', 'America/Chicago')
on conflict (slug) do nothing;

insert into public.community_areas (city_id, community_area_number, name, slug)
select c.id, v.community_area_number, v.name, v.slug
from public.cities c
cross join (
  values
    (1, 'Rogers Park', 'rogers-park'),
    (2, 'West Ridge', 'west-ridge'),
    (3, 'Uptown', 'uptown'),
    (4, 'Lincoln Square', 'lincoln-square'),
    (5, 'North Center', 'north-center'),
    (6, 'Lake View', 'lake-view'),
    (7, 'Lincoln Park', 'lincoln-park'),
    (8, 'Near North Side', 'near-north-side'),
    (9, 'Edison Park', 'edison-park'),
    (10, 'Norwood Park', 'norwood-park'),
    (11, 'Jefferson Park', 'jefferson-park'),
    (12, 'Forest Glen', 'forest-glen'),
    (13, 'North Park', 'north-park'),
    (14, 'Albany Park', 'albany-park'),
    (15, 'Portage Park', 'portage-park'),
    (16, 'Irving Park', 'irving-park'),
    (17, 'Dunning', 'dunning'),
    (18, 'Montclare', 'montclare'),
    (19, 'Belmont Cragin', 'belmont-cragin'),
    (20, 'Hermosa', 'hermosa'),
    (21, 'Avondale', 'avondale'),
    (22, 'Logan Square', 'logan-square'),
    (23, 'Humboldt Park', 'humboldt-park'),
    (24, 'West Town', 'west-town'),
    (25, 'Austin', 'austin'),
    (26, 'West Garfield Park', 'west-garfield-park'),
    (27, 'East Garfield Park', 'east-garfield-park'),
    (28, 'Near West Side', 'near-west-side'),
    (29, 'North Lawndale', 'north-lawndale'),
    (30, 'South Lawndale', 'south-lawndale'),
    (31, 'Lower West Side', 'lower-west-side'),
    (32, 'Loop', 'loop'),
    (33, 'Near South Side', 'near-south-side'),
    (34, 'Armour Square', 'armour-square'),
    (35, 'Douglas', 'douglas'),
    (36, 'Oakland', 'oakland'),
    (37, 'Fuller Park', 'fuller-park'),
    (38, 'Grand Boulevard', 'grand-boulevard'),
    (39, 'Kenwood', 'kenwood'),
    (40, 'Washington Park', 'washington-park'),
    (41, 'Hyde Park', 'hyde-park'),
    (42, 'Woodlawn', 'woodlawn'),
    (43, 'South Shore', 'south-shore'),
    (44, 'Chatham', 'chatham'),
    (45, 'Avalon Park', 'avalon-park'),
    (46, 'South Chicago', 'south-chicago'),
    (47, 'Burnside', 'burnside'),
    (48, 'Calumet Heights', 'calumet-heights'),
    (49, 'Roseland', 'roseland'),
    (50, 'Pullman', 'pullman'),
    (51, 'South Deering', 'south-deering'),
    (52, 'East Side', 'east-side'),
    (53, 'West Pullman', 'west-pullman'),
    (54, 'Riverdale', 'riverdale'),
    (55, 'Hegewisch', 'hegewisch'),
    (56, 'Garfield Ridge', 'garfield-ridge'),
    (57, 'Archer Heights', 'archer-heights'),
    (58, 'Brighton Park', 'brighton-park'),
    (59, 'McKinley Park', 'mckinley-park'),
    (60, 'Bridgeport', 'bridgeport'),
    (61, 'New City', 'new-city'),
    (62, 'West Elsdon', 'west-elsdon'),
    (63, 'Gage Park', 'gage-park'),
    (64, 'Clearing', 'clearing'),
    (65, 'West Lawn', 'west-lawn'),
    (66, 'Chicago Lawn', 'chicago-lawn'),
    (67, 'West Englewood', 'west-englewood'),
    (68, 'Englewood', 'englewood'),
    (69, 'Greater Grand Crossing', 'greater-grand-crossing'),
    (70, 'Ashburn', 'ashburn'),
    (71, 'Auburn Gresham', 'auburn-gresham'),
    (72, 'Beverly', 'beverly'),
    (73, 'Washington Heights', 'washington-heights'),
    (74, 'Mount Greenwood', 'mount-greenwood'),
    (75, 'Morgan Park', 'morgan-park'),
    (76, 'O''Hare', 'ohare'),
    (77, 'Edgewater', 'edgewater')
) as v(community_area_number, name, slug)
where c.slug = 'chicago'
on conflict (city_id, community_area_number) do nothing;
