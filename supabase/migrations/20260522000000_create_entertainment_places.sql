create table if not exists public.entertainment_places (
  id uuid primary key default gen_random_uuid(),
  city_id uuid references public.cities(id) on delete cascade,
  community_area_id uuid references public.community_areas(id) on delete set null,
  neighborhood text,
  name text not null,
  category text not null check (category in ('food', 'bar', 'park', 'civic', 'entertainment')),
  address text,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  source text not null default 'local cache',
  description text,
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists entertainment_places_lookup_idx
  on public.entertainment_places (city_id, community_area_id, category);

create index if not exists entertainment_places_neighborhood_idx
  on public.entertainment_places (neighborhood, category);

alter table public.entertainment_places enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'entertainment_places'
      and policyname = 'public read entertainment places'
  ) then
    create policy "public read entertainment places"
      on public.entertainment_places
      for select
      using (true);
  end if;
end $$;
