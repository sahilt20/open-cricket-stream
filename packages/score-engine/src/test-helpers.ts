import { randomUUID } from 'node:crypto';
import { createInitialState, type BallEvent, type MatchState, type Player, type Team } from './match-state.js';
import { emptyBatting, emptyBowling } from './reducer.js';

export const team = (id: string, players: Player[]): Team => ({
  id,
  name: id.toUpperCase(),
  shortName: id.toUpperCase().slice(0, 3),
  players,
});

export const p = (id: string): Player => ({ id, name: id });

export function freshState(): MatchState {
  const home = team('home', [p('h1'), p('h2'), p('h3'), p('h4')]);
  const away = team('away', [p('a1'), p('a2'), p('a3')]);
  const state = createInitialState({ matchId: 'test-match', format: 'T20', home, away });
  state.innings.push({
    battingTeamId: home.id,
    bowlingTeamId: away.id,
    totalRuns: 0,
    wickets: 0,
    ballsBowled: 0,
    oversDisplay: '0.0',
    runRate: 0,
    currentBatters: { striker: emptyBatting(home.players[0]!), nonStriker: emptyBatting(home.players[1]!) },
    currentBowler: emptyBowling(away.players[0]!),
    recentBalls: [],
  });
  return state;
}

export function ball(overrides: Partial<BallEvent> = {}): BallEvent {
  return {
    id: randomUUID(),
    inningsIndex: 0,
    over: 0,
    ballInOver: 1,
    isLegal: true,
    batterRuns: 0,
    strikerId: 'h1',
    nonStrikerId: 'h2',
    bowlerId: 'a1',
    timestamp: Date.now(),
    ...overrides,
  };
}
