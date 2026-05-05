import type {
  BallEvent,
  BattingCard,
  BowlingCard,
  Innings,
  MatchState,
  Player,
  PlayerId,
} from './match-state.js';

const RECENT_BALLS_WINDOW = 12; // last two overs is plenty for the overlay

/**
 * Pure function: given current state and a new ball event, return the next state.
 * Throws on invalid transitions (e.g. event for an innings that doesn't exist yet).
 *
 * Idempotency is the *caller's* responsibility — check whether the event id has
 * already been applied before calling this. The reducer does not dedupe.
 *
 * Lineup changes are handled inline:
 *   - If `event.bowlerId` differs from the currently-bowling player, the reducer
 *     swaps in a fresh BowlingCard looked up from the bowling team's roster.
 *     The previous bowler's stats live on in the event log and can be derived
 *     by replay; the in-memory current state only carries the active card.
 *   - If `event.wicket` is set and `event.replacementBatterId` is provided,
 *     whichever current batter matches `wicket.outBatterId` is replaced with
 *     a fresh BattingCard for the named player.
 */
export function applyBallEvent(state: MatchState, event: BallEvent): MatchState {
  const innings = state.innings[event.inningsIndex];
  if (!innings) {
    throw new Error(
      `Cannot apply event to innings ${event.inningsIndex}: innings does not exist (have ${state.innings.length})`,
    );
  }

  // Swap in the new bowler if the event names someone different.
  const baseBowler = swapBowlerIfChanged(innings.currentBowler, event.bowlerId, state);

  const extrasRuns = event.extras?.runs ?? 0;
  const totalRunsThisBall = event.batterRuns + extrasRuns;

  // Striker faces the ball except for wides (ECB law: wide is not a ball faced).
  const facedByStriker = !event.extras || event.extras.kind !== 'wide';

  const striker = updateBatter(innings.currentBatters.striker, {
    runs: event.batterRuns,
    facedBall: facedByStriker,
    fours: event.batterRuns === 4 ? 1 : 0,
    sixes: event.batterRuns === 6 ? 1 : 0,
  });

  const bowler = updateBowler(baseBowler, {
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

  let nextStriker = swap ? innings.currentBatters.nonStriker : striker;
  let nextNonStriker = swap ? striker : innings.currentBatters.nonStriker;

  // Replace the dismissed batter with the named replacement, if any.
  if (event.wicket && event.replacementBatterId) {
    const replacement = findPlayer(state, event.replacementBatterId);
    if (replacement) {
      const fresh = emptyBatting(replacement);
      if (event.wicket.outBatterId === nextStriker.player.id) nextStriker = fresh;
      else if (event.wicket.outBatterId === nextNonStriker.player.id) nextNonStriker = fresh;
    }
  }

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

function swapBowlerIfChanged(current: BowlingCard, newBowlerId: PlayerId, state: MatchState): BowlingCard {
  if (current.player.id === newBowlerId) return current;
  const player = findPlayer(state, newBowlerId);
  if (!player) return current; // unknown id — keep current rather than crash
  return emptyBowling(player);
}

function findPlayer(state: MatchState, playerId: PlayerId): Player | undefined {
  return (
    state.teams.home.players.find((p) => p.id === playerId) ??
    state.teams.away.players.find((p) => p.id === playerId)
  );
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
