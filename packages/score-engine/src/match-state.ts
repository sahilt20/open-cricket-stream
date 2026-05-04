import { z } from 'zod';

export const MATCH_STATE_VERSION = 1;

export type TeamId = string;
export type PlayerId = string;
export type MatchId = string;

export type MatchFormat = 'T20' | 'T40' | 'OD' | 'Declaration' | 'Other';

export type MatchStatus =
  | 'pre-match'
  | 'in-progress'
  | 'innings-break'
  | 'rain'
  | 'completed';

export type Player = { id: PlayerId; name: string };

export type Team = {
  id: TeamId;
  name: string;
  shortName: string;
  players: Player[];
};

export type BattingCard = {
  player: Player;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  out?: Dismissal;
};

export type BowlingCard = {
  player: Player;
  ballsBowled: number; // legal deliveries
  runsConceded: number;
  wickets: number;
  maidens: number;
};

export type Extras = {
  kind: 'wide' | 'noBall' | 'bye' | 'legBye';
  runs: number; // total extras runs charged for this delivery
};

export type Dismissal = {
  type:
    | 'bowled'
    | 'caught'
    | 'lbw'
    | 'runOut'
    | 'stumped'
    | 'hitWicket'
    | 'retired'
    | 'other';
  outBatterId: PlayerId;
  bowlerId?: PlayerId;
  fielderId?: PlayerId;
  description?: string;
};

export type BallEvent = {
  id: string; // UUID, idempotency key
  inningsIndex: number;
  over: number; // 0-indexed
  ballInOver: number; // 1-based, includes re-bowls
  isLegal: boolean;
  batterRuns: number;
  extras?: Extras;
  wicket?: Dismissal;
  strikerId: PlayerId;
  nonStrikerId: PlayerId;
  bowlerId: PlayerId;
  timestamp: number;
};

export type Innings = {
  battingTeamId: TeamId;
  bowlingTeamId: TeamId;
  totalRuns: number;
  wickets: number;
  ballsBowled: number;
  oversDisplay: string;
  runRate: number;
  requiredRunRate?: number;
  target?: number;
  currentBatters: { striker: BattingCard; nonStriker: BattingCard };
  currentBowler: BowlingCard;
  recentBalls: BallEvent[];
};

export type MatchState = {
  version: number;
  matchId: MatchId;
  format: MatchFormat;
  teams: { home: Team; away: Team };
  toss?: { wonBy: TeamId; chose: 'bat' | 'bowl' };
  innings: Innings[];
  currentInningsIndex: number;
  status: MatchStatus;
  result?: string;
  lastUpdated: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// Zod schemas — used by the WebSocket adapter to validate untrusted input.
// ─────────────────────────────────────────────────────────────────────────────

const ExtrasSchema = z.object({
  kind: z.enum(['wide', 'noBall', 'bye', 'legBye']),
  runs: z.number().int().nonnegative(),
});

const DismissalSchema = z.object({
  type: z.enum([
    'bowled',
    'caught',
    'lbw',
    'runOut',
    'stumped',
    'hitWicket',
    'retired',
    'other',
  ]),
  outBatterId: z.string(),
  bowlerId: z.string().optional(),
  fielderId: z.string().optional(),
  description: z.string().optional(),
});

export const BallEventSchema = z.object({
  id: z.string().min(1),
  inningsIndex: z.number().int().min(0),
  over: z.number().int().min(0),
  ballInOver: z.number().int().min(1),
  isLegal: z.boolean(),
  batterRuns: z.number().int().min(0),
  extras: ExtrasSchema.optional(),
  wicket: DismissalSchema.optional(),
  strikerId: z.string(),
  nonStrikerId: z.string(),
  bowlerId: z.string(),
  timestamp: z.number().int(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Empty-state factory. Used for new matches and as the seed for replays.
// ─────────────────────────────────────────────────────────────────────────────

export function createInitialState(input: {
  matchId: MatchId;
  format: MatchFormat;
  home: Team;
  away: Team;
}): MatchState {
  return {
    version: MATCH_STATE_VERSION,
    matchId: input.matchId,
    format: input.format,
    teams: { home: input.home, away: input.away },
    innings: [],
    currentInningsIndex: 0,
    status: 'pre-match',
    lastUpdated: Date.now(),
  };
}
