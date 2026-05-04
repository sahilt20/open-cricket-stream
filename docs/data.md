# Data architecture

open-cricket-stream uses **two storage tiers** with different responsibilities. Understanding the split is the key to reasoning about reliability.

## The split

| Tier | Where | What lives there | Reachability requirement |
|---|---|---|---|
| **Live** | SQLite on the Pi (`/var/ocs/match.sqlite`) | The current match's append-only ball event log + derived in-memory `MatchState` | Must work **offline** at the ground |
| **Durable** | Supabase (Postgres) | Clubs, teams, players, fixtures, finished matches, all historical ball events, user accounts | Must work **anywhere** with internet |

```
                   ┌─────────────────────────┐
   live scoring →  │  score-engine on Pi     │
                   │   in-memory MatchState  │
                   │   SQLite event log      │  ◄── source of truth DURING the match
                   └────────────┬────────────┘
                                │  best-effort mirror (queued, retried)
                                ▼
                   ┌─────────────────────────┐
                   │  Supabase (Postgres)    │  ◄── source of truth AFTER the match
                   │   matches, ball_events, │
                   │   players, fixtures, …  │
                   └────────────┬────────────┘
                                │
            ┌───────────────────┼─────────────────────┐
            ▼                   ▼                     ▼
       Scoring PWA         Public match            Captain's
       (at home,           viewer page             dashboard
       reviewing)
```

## Why two tiers, not one

**Why not just SQLite on the Pi?**
The Pi is a single point of storage. SD card corruption, theft, or a dead Pi loses the season's data. Also, the captain at home can't see last week's match.

**Why not just Supabase?**
The plan's whole reliability story (`AP mode`, `4G optional`, `local recording always on`) depends on the rig working without internet. If live scoring requires Supabase to be reachable on every ball, a 30-second 4G outage corrupts the match. That's exactly what we're trying to avoid.

**The split resolves both:** the rig is self-contained for the 6 hours that matter most, and the data lives forever in a place everyone can reach afterwards.

## How the mirror works

1. PWA or PCS Pro emits a ball event.
2. `MatchStateStore.apply()` updates in-memory state and appends to SQLite. **Synchronous, sub-millisecond.** The match continues.
3. The store emits `event.applied`. The Supabase mirror enqueues the event.
4. Mirror drains the queue with exponential backoff on failure (1s → 60s).
5. If Supabase is unreachable for the whole match, the queue persists and drains when connectivity returns.

The mirror is implemented in [`packages/score-engine/src/supabase-mirror.ts`](../packages/score-engine/src/supabase-mirror.ts).

## What lives where, in detail

### SQLite on the Pi (`@ocs/score-engine`)

- `events` table — append-only ball event log for the **current match only**.
- After a match completes and the snapshot is mirrored, the Pi can rotate the file (archive locally, start fresh). Decision deferred to Phase 4.

### Supabase (`@ocs/db`)

- `clubs`, `teams`, `players` — managed by club admins via the PWA.
- `fixtures` — synced nightly from the Play-Cricket REST API (Phase 6).
- `matches` — one row per scored match, upserted by the score-engine on first ball.
- `ball_events` — every event ever scored, full history, queryable.
- `match_snapshots` — full `MatchState` JSON at end-of-innings and end-of-match for fast playback / VOD overlay regeneration.
- `user_profiles` — links Supabase Auth users to clubs and roles.

## Failure modes and behaviour

| Scenario | Live tier | Durable tier | User-visible effect |
|---|---|---|---|
| 4G drops mid-match | Continues | Queues | None |
| Supabase has an outage | Continues | Queues | None |
| Pi reboots mid-match | Continues from event log on disk | Resumes draining queue | Brief overlay glitch |
| SD card corruption | Match data lost from this point | Whatever was already mirrored survives | Worst case — drives toward Phase 4 hardware reliability work |
| 4G works, Supabase env missing | Continues | Disabled | Live works, no historical record (mirror is opt-in) |

## Generating types

The PWA and score-engine import typed schemas from [`@ocs/db`](../packages/db/). Regenerate from a running Supabase stack:

```bash
npm run gen-types --workspace=@ocs/db
```

The hand-written placeholder in `packages/db/src/types.ts` keeps the codebase compiling before anyone has a Supabase project linked.
