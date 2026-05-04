# @ocs/db — Supabase schema and client

This package owns the **durable** data layer of open-cricket-stream. It does *not* own live in-match state — that lives in the score-engine's local SQLite event log so the rig can score matches when 4G is patchy or absent. See [../../docs/data.md](../../docs/data.md) for the full split.

## What's stored here

| Table | Purpose | Written by |
|---|---|---|
| `clubs` | Cricket clubs using the rig | Manual / club admin |
| `teams` | Team identities (1st XI, 2nd XI, etc.) | Manual / club admin |
| `players` | Player roster, linked to clubs | Manual / Play-Cricket sync |
| `fixtures` | Scheduled matches (pulled from Play-Cricket) | Background sync |
| `matches` | Match records — created when scoring starts | score-engine on match-create |
| `ball_events` | Append-only mirror of every ball | score-engine, best-effort sync |
| `match_snapshots` | Periodic full-state snapshots | score-engine, post-match |
| `user_profiles` | Scorers, club admins; auth via Supabase Auth | Supabase Auth + trigger |

## Why this split

The Pi's SQLite event log is the **source of truth during the match**. Supabase is the **system of record afterwards**. The score-engine treats Supabase as a write-through cache: every ball event is queued and pushed when there's connectivity. If the queue fills (no internet for 4 hours), the match still completes; the queue drains afterwards.

## Local development

```bash
# 1. Install Supabase CLI (one-time)
brew install supabase/tap/supabase

# 2. Boot a local Supabase stack (Postgres + Studio + Auth)
npm run db:start --workspace=@ocs/db

# 3. Apply the schema
npm run db:reset --workspace=@ocs/db
```

Local Supabase URL: `http://localhost:54321`. Studio: `http://localhost:54323`.

## Production setup

1. Create a Supabase project at [supabase.com](https://supabase.com).
2. Run `supabase link --project-ref <ref>` from this directory.
3. `supabase db push` to apply migrations.
4. Copy the project URL + anon key + service role key into the score-engine's and PWA's `.env` files (see `.env.example` in each).

## Security

- The PWA uses the **anon key** + Supabase Auth + Row Level Security. RLS is in [`supabase/migrations/00002_rls.sql`](./supabase/migrations/00002_rls.sql).
- The score-engine on the Pi uses the **service role key** because it writes mirror data with no user context. Keep `.env` on the Pi readable only by the `ocs` user.
- Never commit either key.
