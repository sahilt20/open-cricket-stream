import type { MatchState } from '../lib/match-state.js';

export function Scoreboard({ state }: { state: MatchState | null }) {
  if (!state) {
    return (
      <div className="flex h-48 items-center justify-center text-white/60">
        Waiting for state from the engine…
      </div>
    );
  }

  const innings = state.innings[state.currentInningsIndex];
  if (!innings) {
    return (
      <div className="flex h-48 items-center justify-center text-white/60">
        Match not yet started ({state.status}).
      </div>
    );
  }

  const battingTeam = innings.battingTeamId === state.teams.home.id ? state.teams.home : state.teams.away;
  const recentBallsStrip = innings.recentBalls
    .slice(-6)
    .map(formatBall)
    .join(' ');

  return (
    <section className="rounded-lg bg-willow-green p-4 shadow-lg">
      <header className="mb-2 flex items-baseline justify-between text-willow-gold">
        <h2 className="text-xs font-semibold uppercase tracking-widest">{battingTeam.shortName} batting</h2>
        <span className="text-xs uppercase tracking-widest">{state.format}</span>
      </header>
      <div className="flex items-baseline justify-between">
        <span className="text-5xl font-bold tabular-nums">
          {innings.totalRuns}<span className="text-3xl font-medium text-white/70">/{innings.wickets}</span>
        </span>
        <span className="text-2xl tabular-nums text-white/80">{innings.oversDisplay} ov</span>
      </div>
      <div className="mt-2 text-xs text-white/60">
        RR {innings.runRate.toFixed(2)}{innings.requiredRunRate !== undefined && (<> · RRR {innings.requiredRunRate.toFixed(2)}</>)}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-4 text-sm">
        <div>
          <div className="font-medium">
            {innings.currentBatters.striker.player.name}* <span className="tabular-nums">{innings.currentBatters.striker.runs} ({innings.currentBatters.striker.balls})</span>
          </div>
          <div className="text-white/70">
            {innings.currentBatters.nonStriker.player.name} <span className="tabular-nums">{innings.currentBatters.nonStriker.runs} ({innings.currentBatters.nonStriker.balls})</span>
          </div>
        </div>
        <div className="text-right">
          <div className="font-medium">
            {innings.currentBowler.player.name}
          </div>
          <div className="text-white/70 tabular-nums">
            {Math.floor(innings.currentBowler.ballsBowled / 6)}.{innings.currentBowler.ballsBowled % 6}-{innings.currentBowler.maidens}-{innings.currentBowler.runsConceded}-{innings.currentBowler.wickets}
          </div>
        </div>
      </div>

      <div className="mt-3 rounded bg-willow-night/40 px-2 py-1 text-xs tabular-nums text-white/70">
        This over: {recentBallsStrip || '—'}
      </div>
    </section>
  );
}

function formatBall(b: { batterRuns: number; extras?: { kind: string; runs: number }; wicket?: unknown }) {
  if (b.wicket) return 'W';
  if (b.extras?.kind === 'wide') return 'wd';
  if (b.extras?.kind === 'noBall') return 'nb';
  if (b.extras?.kind === 'bye') return 'b';
  if (b.extras?.kind === 'legBye') return 'lb';
  if (b.batterRuns === 0) return '·';
  return String(b.batterRuns);
}
