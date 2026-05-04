-- Row Level Security policies for open-cricket-stream
--
-- Reading match data (matches, ball_events, fixtures, teams, players, clubs)
-- is intentionally public — the streams are public on YouTube anyway, and
-- club fixtures live on Play-Cricket. Writing requires authenticated club admins
-- or scorers; the score-engine's service-role key bypasses RLS for backfills.

alter table clubs           enable row level security;
alter table teams           enable row level security;
alter table players         enable row level security;
alter table fixtures        enable row level security;
alter table matches         enable row level security;
alter table ball_events     enable row level security;
alter table match_snapshots enable row level security;
alter table user_profiles   enable row level security;

-- ─── Public read access for cricket data ────────────────────────────────────
create policy "public read clubs"
  on clubs for select using (true);

create policy "public read teams"
  on teams for select using (true);

create policy "public read players"
  on players for select using (
    -- Hide juniors from public read; clubs can override per-policy if they want
    not is_junior or auth.role() = 'authenticated'
  );

create policy "public read fixtures"
  on fixtures for select using (true);

create policy "public read matches"
  on matches for select using (true);

create policy "public read ball events"
  on ball_events for select using (true);

create policy "public read snapshots"
  on match_snapshots for select using (true);

-- ─── Profiles: users see and edit their own row ─────────────────────────────
create policy "users read own profile"
  on user_profiles for select
  using (auth.uid() = id);

create policy "users update own profile"
  on user_profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ─── Helper: is the current user a club_admin or super_admin for this club? ─
create or replace function public.is_club_admin(target_club uuid)
returns boolean
language sql security definer set search_path = public
as $$
  select exists (
    select 1 from user_profiles
    where id = auth.uid()
      and role in ('club_admin','super_admin')
      and (club_id = target_club or role = 'super_admin')
  );
$$;

-- ─── Club admin write access ────────────────────────────────────────────────
create policy "club_admin writes teams"
  on teams for all
  using (public.is_club_admin(club_id))
  with check (public.is_club_admin(club_id));

create policy "club_admin writes players"
  on players for all
  using (public.is_club_admin(club_id))
  with check (public.is_club_admin(club_id));

create policy "club_admin writes fixtures"
  on fixtures for all
  using (
    public.is_club_admin((select club_id from teams where id = home_team_id))
    or public.is_club_admin((select club_id from teams where id = away_team_id))
  )
  with check (
    public.is_club_admin((select club_id from teams where id = home_team_id))
    or public.is_club_admin((select club_id from teams where id = away_team_id))
  );

-- Note: matches and ball_events are written by the score-engine using the
-- service-role key, which bypasses RLS. We deliberately do *not* expose write
-- access to authenticated users — there's only one writer (the rig) by design.
