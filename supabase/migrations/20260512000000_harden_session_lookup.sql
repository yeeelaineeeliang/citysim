create index if not exists simulation_sessions_clerk_user_area_year_idx
  on public.simulation_sessions (clerk_user_id, community_area_id, start_year, status, created_at desc);
