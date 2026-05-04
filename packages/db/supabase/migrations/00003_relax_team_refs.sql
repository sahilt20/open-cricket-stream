-- v0 — relax team references on matches and fixtures.
--
-- The original schema required matches.home_team_id and away_team_id to be
-- non-null UUIDs that reference the teams table. That's the right model when
-- a club admin has pre-registered teams and is scoring a known fixture. For
-- ad-hoc matches (a casual or net-session, or any rig that hasn't seeded
-- teams yet), it makes the durable mirror impossible.
--
-- This migration:
--   1. Drops the NOT NULL on matches.home/away_team_id and fixtures.home/away_team_id.
--   2. Drops the foreign keys, so the columns become "soft" UUID hints.
--   3. The team identity (name, short name, players) is still captured in
--      matches.meta JSONB by the score-engine, so nothing is lost.
--
-- Phase 4 will reintroduce strict integrity by adding an "ensure teams exist"
-- upsert step in the score-engine's Supabase mirror.

alter table matches drop constraint if exists matches_home_team_id_fkey;
alter table matches drop constraint if exists matches_away_team_id_fkey;
alter table matches alter column home_team_id drop not null;
alter table matches alter column away_team_id drop not null;

alter table fixtures drop constraint if exists fixtures_home_team_id_fkey;
alter table fixtures drop constraint if exists fixtures_away_team_id_fkey;
alter table fixtures alter column home_team_id drop not null;
alter table fixtures alter column away_team_id drop not null;
