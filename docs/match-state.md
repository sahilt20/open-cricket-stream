# MatchState — the canonical schema

Both source adapters (PWA WebSocket, PCS Pro file watcher) normalise their input into this shape before anything else in the system sees it. The overlay renderer, the persistence layer, and the public match-status endpoint all read from this schema and only this schema.

The TypeScript source of truth is [`packages/score-engine/src/match-state.ts`](../packages/score-engine/src/match-state.ts).

## Top level

```ts
type MatchState = {
  matchId: string;                  // UUID, set on match creation
  format: MatchFormat;              // T20 | T40 | OD | Declaration | Other
  teams: { home: Team; away: Team };
  toss?: { wonBy: TeamId; chose: 'bat' | 'bowl' };
  innings: Innings[];               // [] until first ball
  currentInningsIndex: number;      // 0 or 1 (Test cricket: 0..3, not in scope for v1)
  status: MatchStatus;              // pre-match | in-progress | innings-break | rain | completed
  result?: string;                  // human-readable, set on completion
  lastUpdated: number;              // unix ms
};
```

## Innings

```ts
type Innings = {
  battingTeamId: TeamId;
  bowlingTeamId: TeamId;
  totalRuns: number;
  wickets: number;
  ballsBowled: number;              // legal deliveries only
  oversDisplay: string;             // "12.3" — derived, kept for overlay convenience
  runRate: number;                  // runs per over, derived
  requiredRunRate?: number;         // 2nd innings only
  target?: number;                  // 2nd innings only
  currentBatters: { striker: BattingCard; nonStriker: BattingCard };
  currentBowler: BowlingCard;
  recentBalls: BallEvent[];         // last full over for the "this over: . 1 . 4 W" strip
};
```

## Ball event

This is the atomic unit that flows through the system. Both adapters emit these.

```ts
type BallEvent = {
  id: string;                       // UUID, idempotency key
  inningsIndex: number;
  over: number;                     // 0-indexed
  ballInOver: number;               // 1-based, includes re-bowls (so 7+ is possible after wides)
  isLegal: boolean;                 // counts towards over completion
  batterRuns: number;
  extras?: Extras;
  wicket?: Dismissal;
  strikerId: PlayerId;
  nonStrikerId: PlayerId;
  bowlerId: PlayerId;
  timestamp: number;                // unix ms
};

type Extras = {
  kind: 'wide' | 'noBall' | 'bye' | 'legBye';
  runs: number;                     // including the 1 for wide/no-ball where applicable
};

type Dismissal = {
  type: 'bowled' | 'caught' | 'lbw' | 'runOut' | 'stumped' | 'hitWicket' | 'retired' | 'other';
  outBatterId: PlayerId;
  bowlerId?: PlayerId;
  fielderId?: PlayerId;
  description?: string;             // free text fallback
};
```

## Idempotency

Every ball event has a stable `id`. Replaying the same event must not double-count. This matters because:

- The PWA buffers events when offline and replays on reconnect.
- The PCS Pro file watcher may fire multiple `change` events for the same write.

The reducer is responsible for deduping by `id`.

## Versioning

When the schema changes incompatibly, bump `MATCH_STATE_VERSION` in [`match-state.ts`](../packages/score-engine/src/match-state.ts) and add a migration to the SQLite store. Don't break old recordings.
