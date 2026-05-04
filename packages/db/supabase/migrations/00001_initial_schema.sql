-- open-cricket-stream — initial schema
-- Idempotent where possible so repeated `db reset` runs are safe.

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ─── Clubs ───────────────────────────────────────────────────────────────────
create table if not exists clubs (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  short_name    text not null,
  play_cricket_id text unique,
  created_at    timestamptz not null default now()
);

-- ─── Teams (a club can have several: 1st XI, 2nd XI, Sunday, U17 etc.) ──────
create table if not exists teams (
  id            uuid primary key default uuid_generate_v4(),
  club_id       uuid not null references clubs(id) on delete cascade,
  name          text not null,
  short_name    text not null,
  created_at    timestamptz not null default now()
);
create index if not exists idx_teams_club on teams(club_id);

-- ─── Players ─────────────────────────────────────────────────────────────────
create table if not exists players (
  id              uuid primary key default uuid_generate_v4(),
  club_id         uuid not null references clubs(id) on delete cascade,
  full_name       text not null,
  preferred_name  text,
  play_cricket_id text unique,
  is_junior       boolean not null default false,
  created_at      timestamptz not null default now()
);
create index if not exists idx_players_club on players(club_id);

-- ─── Fixtures (scheduled matches, pulled from Play-Cricket) ─────────────────
create table if not exists fixtures (
  id              uuid primary key default uuid_generate_v4(),
  home_team_id    uuid not null references teams(id),
  away_team_id    uuid not null references teams(id),
  starts_at       timestamptz not null,
  venue           text,
  format          text not null check (format in ('T20','T40','OD','Declaration','Other')),
  play_cricket_id text unique,
  created_at      timestamptz not null default now()
);
create index if not exists idx_fixtures_starts_at on fixtures(starts_at desc);

-- ─── Matches (created when scoring actually starts) ──────────────────────────
create table if not exists matches (
  id            uuid primary key,                    -- matches MatchState.matchId
  fixture_id    uuid references fixtures(id),
  home_team_id  uuid not null references teams(id),
  away_team_id  uuid not null references teams(id),
  format        text not null check (format in ('T20','T40','OD','Declaration','Other')),
  status        text not null default 'in-progress'
                check (status in ('pre-match','in-progress','innings-break','rain','completed')),
  toss          jsonb,
  result        text,
  started_at    timestamptz not null default now(),
  completed_at  timestamptz,
  meta          jsonb not null default '{}'
);
create index if not exists idx_matches_started_at on matches(started_at desc);

-- ─── Ball events (append-only mirror of the Pi's local log) ─────────────────
create table if not exists ball_events (
  id            uuid primary key,
  match_id      uuid not null references matches(id) on delete cascade,
  innings_idx   smallint not null,
  over_num      smallint not null,
  ball_in_over  smallint not null,
  is_legal      boolean not null,
  batter_runs   smallint not null,
  extras        jsonb,
  wicket        jsonb,
  striker_id    text not null,
  non_striker_id text not null,
  bowler_id     text not null,
  ts            timestamptz not null,
  payload       jsonb not null,
  synced_at     timestamptz not null default now()
);
create index if not exists idx_ball_events_match_ts on ball_events(match_id, ts);

-- ─── Match snapshots (full state captures, e.g. end of innings, post-match) ─
create table if not exists match_snapshots (
  id            uuid primary key default uuid_generate_v4(),
  match_id      uuid not null references matches(id) on delete cascade,
  reason        text not null,
  state         jsonb not null,
  taken_at      timestamptz not null default now()
);
create index if not exists idx_snapshots_match on match_snapshots(match_id, taken_at desc);

-- ─── User profiles (Supabase Auth → app-level role/club mapping) ────────────
create table if not exists user_profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text,
  club_id       uuid references clubs(id),
  role          text not null default 'viewer'
                check (role in ('viewer','scorer','club_admin','super_admin')),
  created_at    timestamptz not null default now()
);

-- Auto-create a profile row when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.user_profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.email));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
