-- Shared rate-limit store so limits hold across serverless instances.
-- Accessed only via the rate_limit_hit RPC from the service role.

create table if not exists public.rate_limits (
  key text primary key,
  count integer not null default 0,
  reset_at timestamptz not null,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.rate_limits enable row level security;

-- No policies: service role bypasses RLS; anon/authenticated get nothing.

create or replace function public.rate_limit_hit(p_key text, p_max integer, p_window_ms integer)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_row public.rate_limits;
begin
  insert into public.rate_limits as rl (key, count, reset_at)
  values (p_key, 1, v_now + make_interval(secs => p_window_ms / 1000.0))
  on conflict (key) do update set
    count = case when rl.reset_at <= v_now then 1 else rl.count + 1 end,
    reset_at = case when rl.reset_at <= v_now
                    then v_now + make_interval(secs => p_window_ms / 1000.0)
                    else rl.reset_at end,
    updated_at = v_now
  returning * into v_row;

  -- Opportunistic GC: ~1% of calls sweep keys expired for over an hour.
  if random() < 0.01 then
    delete from public.rate_limits where reset_at < v_now - interval '1 hour';
  end if;

  return query select
    v_row.count <= p_max,
    greatest(1, ceil(extract(epoch from (v_row.reset_at - v_now))))::integer;
end
$$;

revoke execute on function public.rate_limit_hit(text, integer, integer) from anon, authenticated;
