import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { applyBallEvent } from './reducer.js';
import { ball, freshState } from './test-helpers.js';

describe('reducer — legal deliveries', () => {
  test('dot ball: striker faces, no runs, no swap', () => {
    const before = freshState();
    const after = applyBallEvent(before, ball({ batterRuns: 0 }));
    const innings = after.innings[0]!;

    assert.equal(innings.totalRuns, 0);
    assert.equal(innings.ballsBowled, 1);
    assert.equal(innings.currentBatters.striker.player.id, 'h1', 'no swap on dot');
    assert.equal(innings.currentBatters.striker.balls, 1);
    assert.equal(innings.currentBatters.striker.runs, 0);
  });

  test('1 run: striker scores 1, strike rotates (odd)', () => {
    const after = applyBallEvent(freshState(), ball({ batterRuns: 1 }));
    const innings = after.innings[0]!;

    assert.equal(innings.totalRuns, 1);
    assert.equal(innings.ballsBowled, 1);
    assert.equal(innings.currentBatters.striker.player.id, 'h2', 'odd run swaps strike');
    assert.equal(innings.currentBatters.nonStriker.player.id, 'h1');
    assert.equal(innings.currentBatters.nonStriker.runs, 1, 'h1 still has the 1 run');
    assert.equal(innings.currentBatters.nonStriker.balls, 1);
  });

  test('2 runs: even, no swap', () => {
    const after = applyBallEvent(freshState(), ball({ batterRuns: 2 }));
    const innings = after.innings[0]!;
    assert.equal(innings.currentBatters.striker.player.id, 'h1');
    assert.equal(innings.currentBatters.striker.runs, 2);
  });

  test('boundary 4: counted as four, no swap', () => {
    const after = applyBallEvent(freshState(), ball({ batterRuns: 4 }));
    const innings = after.innings[0]!;
    assert.equal(innings.totalRuns, 4);
    assert.equal(innings.currentBatters.striker.player.id, 'h1');
    assert.equal(innings.currentBatters.striker.fours, 1);
    assert.equal(innings.currentBatters.striker.sixes, 0);
  });

  test('six: striker credited with a six', () => {
    const after = applyBallEvent(freshState(), ball({ batterRuns: 6 }));
    const innings = after.innings[0]!;
    assert.equal(innings.currentBatters.striker.sixes, 1);
    assert.equal(innings.currentBatters.striker.fours, 0);
  });
});

describe('reducer — extras', () => {
  test('wide: not legal, +1 to total, striker does not face', () => {
    const after = applyBallEvent(freshState(), ball({ isLegal: false, batterRuns: 0, extras: { kind: 'wide', runs: 1 } }));
    const innings = after.innings[0]!;
    assert.equal(innings.totalRuns, 1);
    assert.equal(innings.ballsBowled, 0, 'wide does not advance the over');
    assert.equal(innings.currentBatters.striker.balls, 0, 'wide is not a ball faced');
  });

  test('no-ball: not legal, +1, striker faces (free hit on the next ball is downstream)', () => {
    const after = applyBallEvent(freshState(), ball({ isLegal: false, batterRuns: 0, extras: { kind: 'noBall', runs: 1 } }));
    const innings = after.innings[0]!;
    assert.equal(innings.totalRuns, 1);
    assert.equal(innings.ballsBowled, 0);
    assert.equal(innings.currentBatters.striker.balls, 1, 'no-ball IS a ball faced');
  });

  test('bye: legal ball, batter not credited, +runs to total', () => {
    const after = applyBallEvent(freshState(), ball({ isLegal: true, batterRuns: 0, extras: { kind: 'bye', runs: 2 } }));
    const innings = after.innings[0]!;
    assert.equal(innings.totalRuns, 2);
    assert.equal(innings.currentBatters.striker.runs, 0, 'byes are not batter runs');
    assert.equal(innings.ballsBowled, 1, 'byes count as a ball faced');
  });
});

describe('reducer — over completion', () => {
  test('end of over swaps strike even on a dot ball', () => {
    let state = freshState();
    // Five dots, then a sixth dot that completes the over.
    for (let i = 0; i < 5; i++) {
      state = applyBallEvent(state, ball({ ballInOver: i + 1, batterRuns: 0 }));
    }
    assert.equal(state.innings[0]!.currentBatters.striker.player.id, 'h1', 'mid-over no swap');
    state = applyBallEvent(state, ball({ ballInOver: 6, batterRuns: 0 }));
    const innings = state.innings[0]!;
    assert.equal(innings.ballsBowled, 6);
    assert.equal(innings.oversDisplay, '1.0');
    assert.equal(innings.currentBatters.striker.player.id, 'h2', 'end of over swaps strike');
  });

  test('end of over with a single keeps strike with the original striker (XOR cancels)', () => {
    let state = freshState();
    for (let i = 0; i < 5; i++) {
      state = applyBallEvent(state, ball({ ballInOver: i + 1, batterRuns: 0 }));
    }
    state = applyBallEvent(state, ball({ ballInOver: 6, batterRuns: 1 }));
    const innings = state.innings[0]!;
    assert.equal(innings.ballsBowled, 6);
    assert.equal(innings.currentBatters.striker.player.id, 'h1', '1 run + over end → no net swap');
  });
});

describe('reducer — bowler card', () => {
  test('bowler accumulates legal balls and runs conceded (including extras)', () => {
    let state = freshState();
    state = applyBallEvent(state, ball({ batterRuns: 4 }));
    state = applyBallEvent(state, ball({ ballInOver: 2, isLegal: false, batterRuns: 0, extras: { kind: 'wide', runs: 1 } }));
    const bowler = state.innings[0]!.currentBowler;

    assert.equal(bowler.ballsBowled, 1, 'wide does not count as a legal ball for the bowler');
    assert.equal(bowler.runsConceded, 5, 'bowler concedes both batter runs and the wide');
  });

  test('bowler credited for a clean wicket but not a run-out', () => {
    let state = freshState();
    state = applyBallEvent(state, ball({
      wicket: { type: 'bowled', outBatterId: 'h1' },
    }));
    assert.equal(state.innings[0]!.currentBowler.wickets, 1);

    state = freshState();
    state = applyBallEvent(state, ball({
      wicket: { type: 'runOut', outBatterId: 'h2' },
    }));
    assert.equal(state.innings[0]!.currentBowler.wickets, 0, 'run-out is not credited');
  });
});

describe('reducer — innings totals', () => {
  test('total wickets count up regardless of dismissal type', () => {
    let state = freshState();
    state = applyBallEvent(state, ball({ wicket: { type: 'caught', outBatterId: 'h1', bowlerId: 'a1' } }));
    state = applyBallEvent(state, ball({ ballInOver: 2, wicket: { type: 'runOut', outBatterId: 'h2' } }));
    assert.equal(state.innings[0]!.wickets, 2);
  });

  test('run rate uses balls bowled, not balls in the over', () => {
    let state = freshState();
    // 12 runs from 6 legal balls = RR 12.00
    state = applyBallEvent(state, ball({ ballInOver: 1, batterRuns: 6 }));
    state = applyBallEvent(state, ball({ ballInOver: 2, batterRuns: 6 }));
    state = applyBallEvent(state, ball({ ballInOver: 3, batterRuns: 0 }));
    state = applyBallEvent(state, ball({ ballInOver: 4, batterRuns: 0 }));
    state = applyBallEvent(state, ball({ ballInOver: 5, batterRuns: 0 }));
    state = applyBallEvent(state, ball({ ballInOver: 6, batterRuns: 0 }));
    assert.equal(state.innings[0]!.runRate, 12);
  });
});
