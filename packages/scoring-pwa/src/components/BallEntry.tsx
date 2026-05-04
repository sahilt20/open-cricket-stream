import type { BallEvent, MatchState } from '../lib/match-state.js';

const RUN_BUTTONS = [0, 1, 2, 3, 4, 6] as const;

export function BallEntry({
  state,
  onSubmit,
  disabled,
}: {
  state: MatchState | null;
  onSubmit: (event: BallEvent) => void;
  disabled: boolean;
}) {
  const innings = state?.innings[state.currentInningsIndex];

  const buildEvent = (overrides: Partial<BallEvent>): BallEvent => {
    if (!state || !innings) throw new Error('No active innings');
    const ballsBowled = innings.ballsBowled;
    return {
      id: crypto.randomUUID(),
      inningsIndex: state.currentInningsIndex,
      over: Math.floor(ballsBowled / 6),
      ballInOver: (ballsBowled % 6) + 1,
      isLegal: true,
      batterRuns: 0,
      strikerId: innings.currentBatters.striker.player.id,
      nonStrikerId: innings.currentBatters.nonStriker.player.id,
      bowlerId: innings.currentBowler.player.id,
      timestamp: Date.now(),
      ...overrides,
    };
  };

  const submitRuns = (n: number) => onSubmit(buildEvent({ batterRuns: n }));
  const submitWide = () => onSubmit(buildEvent({ isLegal: false, extras: { kind: 'wide', runs: 1 } }));
  const submitNoBall = () => onSubmit(buildEvent({ isLegal: false, extras: { kind: 'noBall', runs: 1 } }));

  return (
    <section className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {RUN_BUTTONS.map((n) => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => submitRuns(n)}
            className="tap-target rounded bg-willow-green/80 text-2xl font-bold tabular-nums hover:bg-willow-green active:scale-95 disabled:opacity-40"
          >
            {n === 0 ? '·' : n}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={submitWide}
          className="tap-target rounded bg-amber-700/80 font-semibold uppercase active:scale-95 disabled:opacity-40"
        >
          Wide
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={submitNoBall}
          className="tap-target rounded bg-amber-700/80 font-semibold uppercase active:scale-95 disabled:opacity-40"
        >
          No-ball
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => alert('Wicket entry — coming next phase')}
          className="tap-target rounded bg-red-700/80 font-semibold uppercase active:scale-95 disabled:opacity-40"
        >
          Wicket
        </button>
      </div>
      <p className="text-xs text-white/40">
        v0 ball entry — byes, leg-byes, partial undo, and full wicket modal land in Phase 3.
      </p>
    </section>
  );
}
