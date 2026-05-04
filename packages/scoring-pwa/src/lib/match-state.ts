/**
 * Mirror of the score-engine's MatchState shape for the PWA.
 *
 * Why duplicated: keeping the PWA package free of a hard dependency on the
 * score-engine package means the PWA can be deployed independently (e.g. as
 * a hosted web app on Vercel pointing at a public Supabase project). The
 * shapes are kept aligned by a shared schema doc — see /docs/match-state.md.
 *
 * If we ever extract these types into a shared package, they go in @ocs/db
 * alongside the Supabase types so all consumers import from one place.
 */

export type Player = { id: string; name: string };

export type BattingCard = {
  player: Player;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
};

export type BowlingCard = {
  player: Player;
  ballsBowled: number;
  runsConceded: number;
  wickets: number;
  maidens: number;
};

export type Innings = {
  battingTeamId: string;
  bowlingTeamId: string;
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

export type BallEvent = {
  id: string;
  inningsIndex: number;
  over: number;
  ballInOver: number;
  isLegal: boolean;
  batterRuns: number;
  extras?: { kind: 'wide' | 'noBall' | 'bye' | 'legBye'; runs: number };
  wicket?: {
    type: string;
    outBatterId: string;
    bowlerId?: string;
    fielderId?: string;
    description?: string;
  };
  strikerId: string;
  nonStrikerId: string;
  bowlerId: string;
  timestamp: number;
};

export type MatchState = {
  version: number;
  matchId: string;
  format: 'T20' | 'T40' | 'OD' | 'Declaration' | 'Other';
  teams: {
    home: { id: string; name: string; shortName: string; players: Player[] };
    away: { id: string; name: string; shortName: string; players: Player[] };
  };
  innings: Innings[];
  currentInningsIndex: number;
  status: 'pre-match' | 'in-progress' | 'innings-break' | 'rain' | 'completed';
  result?: string;
  lastUpdated: number;
};
