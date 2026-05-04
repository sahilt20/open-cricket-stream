import type {
  BallEvent,
  BattingCard,
  BowlingCard,
  Innings,
  MatchState,
  Player,
} from './match-state.js';

const RECENT_BALLS_WINDOW = 12; // last two overs is plenty for the overlay

/**
 * Pure function: given current state and a new ball event, return the next state.
 * Throws on invalid transitions (e.g. event for an innings that doesn't exist yet).
 *
 * Idempotency is the *caller's* responsibility — check whether the event id has
 * already been applied before calling this. The reducer does not dedupe.
 */
export function applyBallEvent(state: MatchState, event: BallEvent): MatchState {
  const innings = state.innings[event.inningsIndex];
  if (!innings) {
    throw new Error(
      `Cannot apply event to innings ${event.inningsIndex}: innings does not exist (have ${state.innings.length})`,
    );
  }

  const extrasRuns = event.extras?.runs ?? 0;
  const totalRunsThisBall = event.batterRuns + extrasRuns;

  // Striker faces the ball except for byes/leg-byes/wides (still credited as a faced ball
  // unless it's a wide; ECB law: wide is not a ball faced).
  const facedByStriker =
    !event.extras || event.extras.kind === 'noBall' || event.extras.kind === 'bye' || event.extras.kind === 'legBye';

  const striker = updateBatter(innings.currentBatters.striker, {
    runs: event.batterRuns,
    facedBall: facedByStriker,
    fours: event.batterRuns === 4 ? 1 : 0,
    sixes: event.batterRuns === 6 ? 1 : 0,
  });

  const bowler = updateBowler(innings.currentBowler, {
    runsConceded: totalRunsThisBall,
    isLegal: event.isLegal,
    wicketCredited: shouldCreditWicketToBowler(event),
  });

  const ballsBowled = innings.ballsBowled + (event.isLegal ? 1 : 0);
  const totalRuns = innings.totalRuns + totalRunsThisBall;
  const wickets = innings.wickets + (event.wicket ? 1 : 0);

  // Strike rotation: odd batter runs swap; even keep. End of over also swaps.
  const oddRuns = event.batterRuns % 2 === 1;
  const endOfOver = event.isLegal && ballsBowled % 6 === 0 && ballsBowled > innings.ballsBowled;
  const swap = oddRuns !== endOfOver; // XOR

  const nextStriker = swap ? innings.currentBatters.nonStriker : striker;
  const nextNonStriker = swap ? striker : innings.currentBatters.nonStriker;

  const recentBalls = [...innings.recentBalls, event].slice(-RECENT_BALLS_WINDOW);

  const nextInnings: Innings = {
    ...innings,
    totalRuns,
    wickets,
    ballsBowled,
    oversDisplay: formatOvers(ballsBowled),
    runRate: ballsBowled === 0 ? 0 : (totalRuns * 6) / ballsBowled,
    currentBatters: { striker: nextStriker, nonStriker: nextNonStriker },
    currentBowler: bowler,
    recentBalls,
  };

  const nextInningsArr = [...state.innings];
  nextInningsArr[event.inningsIndex] = nextInnings;

  return {
    ...state,
    innings: nextInningsArr,
    status: 'in-progress',
    lastUpdated: event.timestamp,
  };
}

function updateBatter(
  card: BattingCard,
  delta: { runs: number; facedBall: boolean; fours: number; sixes: number },
): BattingCard {
  return {
    ...card,
    runs: card.runs + delta.runs,
    balls: card.balls + (delta.facedBall ? 1 : 0),
    fours: card.fours + delta.fours,
    sixes: card.sixes + delta.sixes,
  };
}

function updateBowler(
  card: BowlingCard,
  delta: { runsConceded: number; isLegal: boolean; wicketCredited: boolean },
): BowlingCard {
  return {
    ...card,
    ballsBowled: card.ballsBowled + (delta.isLegal ? 1 : 0),
    runsConceded: card.runsConceded + delta.runsConceded,
    wickets: card.wickets + (delta.wicketCredited ? 1 : 0),
    // Maidens are only known at end-of-over; reducer doesn't compute them yet — TODO.
  };
}

function shouldCreditWicketToBowler(event: BallEvent): boolean {
  if (!event.wicket) return false;
  // Run-outs and retirements aren't credited to the bowler.
  return event.wicket.type !== 'runOut' && event.wicket.type !== 'retired';
}

function formatOvers(ballsBowled: number): string {
  const overs = Math.floor(ballsBowled / 6);
  const balls = ballsBowled % 6;
  return `${overs}.${balls}`;
}

export function emptyBatting(player: Player): BattingCard {
  return { player, runs: 0, balls: 0, fours: 0, sixes: 0 };
}

export function emptyBowling(player: Player): BowlingCard {
  return { player, ballsBowled: 0, runsConceded: 0, wickets: 0, maidens: 0 };
}
