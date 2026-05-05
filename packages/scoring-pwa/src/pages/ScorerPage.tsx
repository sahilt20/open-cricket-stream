import { useState, useRef, useEffect, type ReactNode } from 'react';
import { RotateCcw, Zap, Plus, X, ChevronRight, PlusCircle } from 'lucide-react';
import { AppShell, ScreenContainer } from '../components/AppShell.js';
import { Button } from '../components/Button.js';
import { Modal } from '../components/Modal.js';
import { FormField, Input } from '../components/Input.js';
import { useEngine } from '../contexts/EngineContext.js';
import { useAuth } from '../contexts/AuthContext.js';
import { listTeams, listPlayers, type Team as DbTeam, type Player as DbPlayer } from '../lib/api.js';
import type { BallEvent, DismissalType, Innings, MatchState, Player } from '../lib/match-state.js';
import { cn } from '../lib/cn.js';

// ─── Types ────────────────────────────────────────────────────────────────────

type MatchFormat = 'T20' | 'T40' | 'OD' | 'Other';
type SetupStep = 'format' | 'home-team' | 'away-team' | 'lineup';
type BallStep = 'idle' | 'wide-extras' | 'noball-runs' | 'bye-runs' | 'legbye-runs' | 'wicket';

const DISMISSAL_LABELS: Record<DismissalType, string> = {
  bowled: 'Bowled',
  caught: 'Caught',
  lbw: 'LBW',
  runOut: 'Run Out',
  stumped: 'Stumped',
  hitWicket: 'Hit Wicket',
  retired: 'Retired',
  other: 'Other',
};
const BOWLER_CREDITED = new Set<DismissalType>(['bowled', 'caught', 'lbw', 'stumped', 'hitWicket']);
const NEEDS_FIELDER = new Set<DismissalType>(['caught', 'stumped', 'runOut']);

// ─── Main page ────────────────────────────────────────────────────────────────

export function ScorerPage() {
  const { state, conn, createMatch, sendBall, undo } = useEngine();
  const [setupMode, setSetupMode] = useState(false);

  const showWizard = !state || state.status === 'pre-match' || setupMode;

  const handleCreate = async (s: MatchState) => {
    const res = await createMatch(s);
    if (res.ok) {
      setSetupMode(false);
    } else {
      alert(`Failed to create match: ${res.error}`);
    }
  };

  if (showWizard) {
    return (
      <div className="min-h-screen bg-willow-night">
        <MatchSetupWizard
          existing={state}
          canCancel={setupMode}
          onCancel={() => setSetupMode(false)}
          onCreate={handleCreate}
        />
      </div>
    );
  }

  const innings = state.innings[state.currentInningsIndex];

  return (
    <AppShell>
      <ScreenContainer className="flex flex-col gap-4 pb-8">
        <LiveScoreboard state={state} />

        {state.status === 'in-progress' && innings && (
          <BallEntryPanel
            state={state}
            innings={innings}
            disabled={conn !== 'connected'}
            onSendBall={async (e) => {
              const res = await sendBall(e);
              if (!res.ok) alert(`Engine rejected: ${res.error}`);
            }}
            onUndo={async () => {
              const res = await undo();
              if (!res.ok) alert(`Undo failed: ${res.error}`);
            }}
          />
        )}

        {state.status === 'innings-break' && (
          <InningsBreakView
            state={state}
            onCreate={async (s) => {
              const res = await createMatch(s);
              if (!res.ok) alert(`Failed: ${res.error}`);
            }}
          />
        )}

        {state.status === 'completed' && <MatchCompleteView state={state} onNewMatch={() => setSetupMode(true)} />}

        {/* New match — always accessible at the bottom */}
        <div className="border-t border-white/10 pt-3">
          <button
            type="button"
            onClick={() => setSetupMode(true)}
            className="flex w-full items-center justify-center gap-2 py-2 text-xs text-white/30 transition hover:text-white/60"
          >
            <PlusCircle size={14} />
            Start a new match
          </button>
        </div>
      </ScreenContainer>
    </AppShell>
  );
}

// ─── Live scoreboard ─────────────────────────────────────────────────────────

function LiveScoreboard({ state }: { state: MatchState }) {
  const innings = state.innings[state.currentInningsIndex];
  if (!innings) {
    return (
      <div className="flex h-36 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-sm text-white/50">
        No innings yet
      </div>
    );
  }

  const battingTeam =
    innings.battingTeamId === state.teams.home.id ? state.teams.home : state.teams.away;
  const { striker, nonStriker } = innings.currentBatters;
  const bowler = innings.currentBowler;

  const overBalls = innings.recentBalls.slice(-6);

  return (
    <div className="rounded-2xl border border-white/10 bg-willow-green/20 p-4 backdrop-blur">
      <div className="flex items-baseline justify-between">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-willow-gold">
            {battingTeam.shortName}
          </span>
          {innings.target && (
            <span className="ml-2 text-xs text-white/50">
              chasing {innings.target}
            </span>
          )}
        </div>
        <span className="text-xs text-white/40">{state.format}</span>
      </div>

      <div className="mt-1 flex items-baseline gap-3">
        <span className="text-5xl font-extrabold tabular-nums text-white">
          {innings.totalRuns}
          <span className="text-3xl font-semibold text-white/60">/{innings.wickets}</span>
        </span>
        <span className="text-2xl font-semibold tabular-nums text-white/70">
          {innings.oversDisplay}
        </span>
      </div>

      <div className="mt-1 flex gap-3 text-[11px] text-white/50">
        <span>RR {innings.runRate.toFixed(2)}</span>
        {innings.requiredRunRate !== undefined && (
          <span className={innings.requiredRunRate > innings.runRate ? 'text-rose-400' : 'text-emerald-400'}>
            RRR {innings.requiredRunRate.toFixed(2)}
          </span>
        )}
        {innings.target && (
          <span>
            Need {innings.target - innings.totalRuns} from{' '}
            {Math.max(0, state.innings[0]?.ballsBowled ?? 0 - innings.ballsBowled)} balls
          </span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 text-sm">
        <div className="space-y-0.5">
          <BatterLine card={striker} isStriker />
          <BatterLine card={nonStriker} isStriker={false} />
        </div>
        <div className="text-right">
          <div className="font-medium text-white">{bowler.player.name}</div>
          <div className="text-xs tabular-nums text-white/60">
            {Math.floor(bowler.ballsBowled / 6)}-{bowler.maidens}-{bowler.runsConceded}-{bowler.wickets}
          </div>
        </div>
      </div>

      {overBalls.length > 0 && (
        <div className="mt-3 flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider text-white/40">Over:</span>
          {overBalls.map((b, i) => (
            <span
              key={i}
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
                b.wicket
                  ? 'bg-rose-500/80 text-white'
                  : b.extras?.kind === 'wide' || b.extras?.kind === 'noBall'
                    ? 'bg-amber-600/60 text-white'
                    : b.batterRuns >= 4
                      ? 'bg-willow-gold/80 text-willow-night'
                      : 'bg-white/10 text-white/80',
              )}
            >
              {b.wicket ? 'W' : b.extras?.kind === 'wide' ? 'wd' : b.extras?.kind === 'noBall' ? 'nb' : b.batterRuns === 0 ? '·' : b.batterRuns}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function BatterLine({ card, isStriker }: { card: { player: Player; runs: number; balls: number; fours: number; sixes: number }; isStriker: boolean }) {
  return (
    <div className={cn('flex items-baseline gap-2', isStriker ? 'text-white' : 'text-white/60')}>
      <span className="font-medium">
        {card.player.name}
        {isStriker && <span className="ml-0.5 text-willow-gold">*</span>}
      </span>
      <span className="ml-auto tabular-nums text-sm">
        {card.runs} ({card.balls})
      </span>
      {(card.fours > 0 || card.sixes > 0) && (
        <span className="text-xs text-white/40">
          {card.fours > 0 && `${card.fours}×4`}
          {card.fours > 0 && card.sixes > 0 && ' '}
          {card.sixes > 0 && `${card.sixes}×6`}
        </span>
      )}
    </div>
  );
}

// ─── Ball entry panel ─────────────────────────────────────────────────────────

function BallEntryPanel({
  state,
  innings,
  disabled,
  onSendBall,
  onUndo,
}: {
  state: MatchState;
  innings: Innings;
  disabled: boolean;
  onSendBall: (e: BallEvent) => Promise<void>;
  onUndo: () => Promise<void>;
}) {
  const [step, setStep] = useState<BallStep>('idle');
  const [wicketOpen, setWicketOpen] = useState(false);
  const [bowlerOpen, setBowlerOpen] = useState(false);
  const [pendingNextBowlerId, setPendingNextBowlerId] = useState<string | null>(null);

  // Detect over completion (6 legal balls bowled)
  const prevLegal = useRef(innings.ballsBowled);
  useEffect(() => {
    const b = innings.ballsBowled;
    if (b > 0 && b % 6 === 0 && b !== prevLegal.current) {
      setBowlerOpen(true);
    }
    prevLegal.current = b;
  }, [innings.ballsBowled]);

  const buildBase = (): Omit<BallEvent, 'batterRuns' | 'isLegal'> => ({
    id: crypto.randomUUID(),
    inningsIndex: state.currentInningsIndex,
    over: Math.floor(innings.ballsBowled / 6),
    ballInOver: (innings.ballsBowled % 6) + 1,
    strikerId: innings.currentBatters.striker.player.id,
    nonStrikerId: innings.currentBatters.nonStriker.player.id,
    bowlerId: pendingNextBowlerId ?? innings.currentBowler.player.id,
    timestamp: Date.now(),
  });

  const submit = async (event: BallEvent) => {
    await onSendBall(event);
    if (pendingNextBowlerId) setPendingNextBowlerId(null);
    setStep('idle');
  };

  const handleRun = (n: number) =>
    submit({ ...buildBase(), isLegal: true, batterRuns: n });

  const handleWideRun = (totalRuns: number) =>
    submit({ ...buildBase(), isLegal: false, batterRuns: 0, extras: { kind: 'wide', runs: totalRuns } });

  const handleNoBall = (batterRuns: number) =>
    submit({ ...buildBase(), isLegal: false, batterRuns, extras: { kind: 'noBall', runs: 1 } });

  const handleBye = (runs: number) =>
    submit({ ...buildBase(), isLegal: true, batterRuns: 0, extras: { kind: 'bye', runs } });

  const handleLegBye = (runs: number) =>
    submit({ ...buildBase(), isLegal: true, batterRuns: 0, extras: { kind: 'legBye', runs } });

  const bowlingTeam = innings.bowlingTeamId === state.teams.home.id ? state.teams.home : state.teams.away;
  const battingTeam = innings.battingTeamId === state.teams.home.id ? state.teams.home : state.teams.away;

  return (
    <div className="space-y-3">
      {/* Bowler banner */}
      {pendingNextBowlerId && (
        <div className="flex items-center justify-between rounded-lg border border-willow-gold/30 bg-willow-gold/10 px-3 py-2 text-sm">
          <span className="text-willow-gold">
            New bowler: {bowlingTeam.players.find((p) => p.id === pendingNextBowlerId)?.name}
          </span>
          <button
            type="button"
            onClick={() => setPendingNextBowlerId(null)}
            className="text-xs text-white/40 hover:text-white/70"
          >
            Change
          </button>
        </div>
      )}

      {step === 'idle' && (
        <>
          {/* Run buttons */}
          <div className="grid grid-cols-3 gap-2">
            {([0, 1, 2, 3, 4, 6] as const).map((n) => (
              <Button
                key={n}
                variant="score"
                size="tap"
                disabled={disabled}
                onClick={() => handleRun(n)}
                className="text-3xl"
              >
                {n === 0 ? '·' : n}
              </Button>
            ))}
          </div>

          {/* Extras + special */}
          <div className="grid grid-cols-4 gap-2">
            <ExtrasBtn label="Wide" color="amber" disabled={disabled} onClick={() => setStep('wide-extras')} />
            <ExtrasBtn label="No Ball" color="amber" disabled={disabled} onClick={() => setStep('noball-runs')} />
            <ExtrasBtn label="Bye" color="slate" disabled={disabled} onClick={() => setStep('bye-runs')} />
            <ExtrasBtn label="Leg Bye" color="slate" disabled={disabled} onClick={() => setStep('legbye-runs')} />
          </div>

          {/* Wicket + undo + change bowler */}
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="danger"
              size="tap"
              disabled={disabled}
              onClick={() => setWicketOpen(true)}
              className="col-span-2"
            >
              Wicket
            </Button>
            <Button
              variant="ghost"
              size="tap"
              onClick={onUndo}
              icon={<RotateCcw size={16} />}
              title="Undo last ball"
            >
              Undo
            </Button>
          </div>

          <button
            type="button"
            onClick={() => setBowlerOpen(true)}
            className="w-full text-center text-xs text-white/30 hover:text-white/60"
          >
            Change bowler mid-over
          </button>
        </>
      )}

      {step === 'wide-extras' && (
        <ExtraRunPicker
          label="Wide"
          options={[1, 2, 3, 4, 5]}
          getLabel={(n) => `${n} run${n > 1 ? 's' : ''}`}
          onSelect={handleWideRun}
          onCancel={() => setStep('idle')}
          hint="Total wide extras (1 = standard wide)"
        />
      )}

      {step === 'noball-runs' && (
        <ExtraRunPicker
          label="No Ball — batter scored"
          options={[0, 1, 2, 3, 4, 6]}
          getLabel={(n) => n === 0 ? '·' : String(n)}
          onSelect={handleNoBall}
          onCancel={() => setStep('idle')}
          hint="+1 no-ball extra is added automatically"
        />
      )}

      {step === 'bye-runs' && (
        <ExtraRunPicker
          label="Byes"
          options={[1, 2, 3, 4]}
          getLabel={(n) => String(n)}
          onSelect={handleBye}
          onCancel={() => setStep('idle')}
        />
      )}

      {step === 'legbye-runs' && (
        <ExtraRunPicker
          label="Leg Byes"
          options={[1, 2, 3, 4]}
          getLabel={(n) => String(n)}
          onSelect={handleLegBye}
          onCancel={() => setStep('idle')}
        />
      )}

      {/* Wicket modal */}
      <WicketModal
        open={wicketOpen}
        innings={innings}
        battingTeam={battingTeam}
        bowlingTeam={bowlingTeam}
        currentBowlerId={pendingNextBowlerId ?? innings.currentBowler.player.id}
        onSubmit={async (w) => {
          setWicketOpen(false);
          await submit({
            ...buildBase(),
            isLegal: true,
            batterRuns: 0,
            wicket: {
              type: w.type,
              outBatterId: w.outBatterId,
              bowlerId: BOWLER_CREDITED.has(w.type) ? (pendingNextBowlerId ?? innings.currentBowler.player.id) : undefined,
              fielderId: w.fielderId || undefined,
            },
            replacementBatterId: w.replacementBatterId || undefined,
          });
        }}
        onClose={() => setWicketOpen(false)}
      />

      {/* Bowler picker modal */}
      <BowlerModal
        open={bowlerOpen}
        bowlingTeam={bowlingTeam}
        currentBowlerId={innings.currentBowler.player.id}
        onSelect={(id) => {
          setPendingNextBowlerId(id);
          setBowlerOpen(false);
        }}
        onClose={() => setBowlerOpen(false)}
      />
    </div>
  );
}

function ExtrasBtn({
  label,
  color,
  disabled,
  onClick,
}: {
  label: string;
  color: 'amber' | 'slate';
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'tap-target flex items-center justify-center rounded-lg text-xs font-semibold uppercase tracking-wider transition active:scale-95 disabled:opacity-40',
        color === 'amber'
          ? 'border border-amber-600/30 bg-amber-700/20 text-amber-300 hover:bg-amber-700/40'
          : 'border border-white/10 bg-white/5 text-white/70 hover:bg-white/10',
      )}
    >
      {label}
    </button>
  );
}

function ExtraRunPicker({
  label,
  options,
  getLabel,
  onSelect,
  onCancel,
  hint,
}: {
  label: string;
  options: number[];
  getLabel: (n: number) => string;
  onSelect: (n: number) => void;
  onCancel: () => void;
  hint?: string;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 animate-slide-up">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-white">{label}</span>
        <button type="button" onClick={onCancel} className="text-white/40 hover:text-white/70">
          <X size={18} />
        </button>
      </div>
      {hint && <p className="text-xs text-white/40">{hint}</p>}
      <div className="grid grid-cols-3 gap-2">
        {options.map((n) => (
          <Button key={n} variant="secondary" size="tap" onClick={() => onSelect(n)}>
            {getLabel(n)}
          </Button>
        ))}
      </div>
    </div>
  );
}

// ─── Wicket modal ─────────────────────────────────────────────────────────────

type WicketData = {
  type: DismissalType;
  outBatterId: string;
  fielderId?: string;
  replacementBatterId?: string;
};

function WicketModal({
  open,
  innings,
  battingTeam,
  bowlingTeam,
  currentBowlerId,
  onSubmit,
  onClose,
}: {
  open: boolean;
  innings: Innings;
  battingTeam: { id: string; name: string; shortName: string; players: Player[] };
  bowlingTeam: { id: string; name: string; shortName: string; players: Player[] };
  currentBowlerId: string;
  onSubmit: (data: WicketData) => Promise<void>;
  onClose: () => void;
}) {
  const [type, setType] = useState<DismissalType>('bowled');
  const [outBatterId, setOutBatterId] = useState(innings.currentBatters.striker.player.id);
  const [fielderId, setFielderId] = useState('');
  const [replacementId, setReplacementId] = useState('');

  useEffect(() => {
    if (open) {
      setType('bowled');
      setOutBatterId(innings.currentBatters.striker.player.id);
      setFielderId('');
      setReplacementId('');
    }
  }, [open, innings.currentBatters.striker.player.id]);

  const activeBatterIds = new Set([
    innings.currentBatters.striker.player.id,
    innings.currentBatters.nonStriker.player.id,
  ]);
  const availableReplacements = battingTeam.players.filter((p) => !activeBatterIds.has(p.id));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Wicket"
      size="md"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() =>
              onSubmit({
                type,
                outBatterId,
                fielderId: NEEDS_FIELDER.has(type) ? fielderId : undefined,
                replacementBatterId: replacementId || undefined,
              })
            }
          >
            Confirm wicket
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Dismissal type */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/50">
            How out
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {(Object.entries(DISMISSAL_LABELS) as [DismissalType, string][]).map(([val, lbl]) => (
              <button
                key={val}
                type="button"
                onClick={() => setType(val)}
                className={cn(
                  'rounded-lg px-3 py-2 text-left text-sm font-medium transition',
                  type === val
                    ? 'bg-rose-600 text-white'
                    : 'bg-white/5 text-white/70 hover:bg-white/10',
                )}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>

        {/* Out batter */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/50">
            Batter out
          </label>
          <div className="flex gap-2">
            {[innings.currentBatters.striker, innings.currentBatters.nonStriker].map((card) => (
              <button
                key={card.player.id}
                type="button"
                onClick={() => setOutBatterId(card.player.id)}
                className={cn(
                  'flex-1 rounded-lg px-3 py-2 text-sm font-medium transition',
                  outBatterId === card.player.id
                    ? 'bg-rose-600 text-white'
                    : 'bg-white/5 text-white/70 hover:bg-white/10',
                )}
              >
                {card.player.name}
                {card.player.id === innings.currentBatters.striker.player.id && ' *'}
              </button>
            ))}
          </div>
        </div>

        {/* Fielder */}
        {NEEDS_FIELDER.has(type) && (
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/50">
              Fielder{type === 'runOut' ? ' (who ran them out)' : type === 'stumped' ? ' (keeper)' : ''}
            </label>
            <select
              value={fielderId}
              onChange={(e) => setFielderId(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-willow-night px-3 py-2 text-sm text-white focus:border-willow-gold focus:outline-none"
            >
              <option value="">— pick fielder —</option>
              {bowlingTeam.players.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Replacement batter */}
        {availableReplacements.length > 0 && (
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/50">
              Next batter in
            </label>
            <select
              value={replacementId}
              onChange={(e) => setReplacementId(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-willow-night px-3 py-2 text-sm text-white focus:border-willow-gold focus:outline-none"
            >
              <option value="">— pick next batter —</option>
              {availableReplacements.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}

        {availableReplacements.length === 0 && (
          <p className="text-xs text-white/40">All batting team players are already on the field.</p>
        )}
      </div>
    </Modal>
  );
}

// ─── Bowler picker modal ───────────────────────────────────────────────────────

function BowlerModal({
  open,
  bowlingTeam,
  currentBowlerId,
  onSelect,
  onClose,
}: {
  open: boolean;
  bowlingTeam: { players: Player[] };
  currentBowlerId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Pick next bowler" size="sm">
      <div className="space-y-1.5">
        {bowlingTeam.players.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p.id)}
            className={cn(
              'flex w-full items-center justify-between rounded-lg px-4 py-3 text-sm font-medium transition',
              p.id === currentBowlerId
                ? 'border border-white/20 bg-white/[0.06] text-white/60'
                : 'bg-white/[0.03] text-white hover:bg-willow-green/20',
            )}
          >
            {p.name}
            {p.id === currentBowlerId && (
              <span className="text-xs text-white/40">current</span>
            )}
            {p.id !== currentBowlerId && <ChevronRight size={14} className="text-white/30" />}
          </button>
        ))}
      </div>
    </Modal>
  );
}

// ─── Innings break view ───────────────────────────────────────────────────────

function InningsBreakView({
  state,
  onCreate,
}: {
  state: MatchState;
  onCreate: (s: MatchState) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const first = state.innings[0];
  if (!first) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center text-sm text-white/50">
        Innings data unavailable.
      </div>
    );
  }
  const secondBattingTeam =
    first.battingTeamId === state.teams.home.id ? state.teams.away : state.teams.home;
  const secondBowlingTeam =
    first.bowlingTeamId === state.teams.home.id ? state.teams.away : state.teams.home;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center">
        <h2 className="text-lg font-bold text-white">Innings break</h2>
        <p className="mt-1 text-sm text-white/60">
          {first.battingTeamId === state.teams.home.id ? state.teams.home.shortName : state.teams.away.shortName}{' '}
          scored {first.totalRuns}/{first.wickets} in {first.oversDisplay} overs
        </p>
        <p className="mt-1 text-sm text-willow-gold">
          {secondBattingTeam.shortName} need {first.totalRuns + 1} to win
        </p>
      </div>

      <Button size="lg" className="w-full" icon={<Zap size={16} />} onClick={() => setOpen(true)}>
        Set up 2nd innings
      </Button>

      <InningsSetupModal
        open={open}
        battingTeam={secondBattingTeam}
        bowlingTeam={secondBowlingTeam}
        target={first.totalRuns + 1}
        onConfirm={(setup) => {
          setOpen(false);
          const totalLegalBalls = first.ballsBowled;
          const totalOvers = Math.floor(totalLegalBalls / 6);
          void onCreate({
            ...state,
            innings: [
              ...state.innings,
              {
                battingTeamId: secondBattingTeam.id,
                bowlingTeamId: secondBowlingTeam.id,
                totalRuns: 0,
                wickets: 0,
                ballsBowled: 0,
                oversDisplay: '0.0',
                runRate: 0,
                target: first.totalRuns + 1,
                requiredRunRate: totalOvers > 0 ? (first.totalRuns + 1) / totalOvers : 0,
                currentBatters: {
                  striker: { player: setup.striker, runs: 0, balls: 0, fours: 0, sixes: 0 },
                  nonStriker: { player: setup.nonStriker, runs: 0, balls: 0, fours: 0, sixes: 0 },
                },
                currentBowler: { player: setup.bowler, ballsBowled: 0, runsConceded: 0, wickets: 0, maidens: 0 },
                recentBalls: [],
              },
            ],
            currentInningsIndex: 1,
            status: 'in-progress',
            lastUpdated: Date.now(),
          });
        }}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}

type InningsSetup = { striker: Player; nonStriker: Player; bowler: Player };

function InningsSetupModal({
  open,
  battingTeam,
  bowlingTeam,
  target,
  onConfirm,
  onClose,
}: {
  open: boolean;
  battingTeam: { players: Player[] };
  bowlingTeam: { players: Player[] };
  target: number;
  onConfirm: (setup: InningsSetup) => void;
  onClose: () => void;
}) {
  const [strikerId, setStrikerId] = useState('');
  const [nonStrikerId, setNonStrikerId] = useState('');
  const [bowlerId, setBowlerId] = useState('');

  useEffect(() => {
    if (open) { setStrikerId(''); setNonStrikerId(''); setBowlerId(''); }
  }, [open]);

  const striker = battingTeam.players.find((p) => p.id === strikerId);
  const nonStriker = battingTeam.players.find((p) => p.id === nonStrikerId);
  const bowler = bowlingTeam.players.find((p) => p.id === bowlerId);
  const valid = striker && nonStriker && bowler && strikerId !== nonStrikerId;

  return (
    <Modal open={open} onClose={onClose} title={`2nd innings · chase ${target}`} size="sm"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={!valid} onClick={() => valid && onConfirm({ striker, nonStriker, bowler })}>
            Start innings
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <PlayerSelect label="Striker (facing first)" players={battingTeam.players} value={strikerId} exclude={nonStrikerId} onChange={setStrikerId} />
        <PlayerSelect label="Non-striker" players={battingTeam.players} value={nonStrikerId} exclude={strikerId} onChange={setNonStrikerId} />
        <PlayerSelect label="Opening bowler" players={bowlingTeam.players} value={bowlerId} onChange={setBowlerId} />
      </div>
    </Modal>
  );
}

// ─── Match complete view ──────────────────────────────────────────────────────

function MatchCompleteView({ state, onNewMatch }: { state: MatchState; onNewMatch: () => void }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center">
      <h2 className="text-xl font-bold text-white">Match complete</h2>
      {state.result && <p className="mt-2 text-willow-gold">{state.result}</p>}
      <Button className="mt-4 w-full" icon={<PlusCircle size={16} />} onClick={onNewMatch}>
        Start next match
      </Button>
    </div>
  );
}

// ─── Match setup wizard ───────────────────────────────────────────────────────

type TeamDraft = { name: string; shortName: string; players: Player[] };

function MatchSetupWizard({
  existing,
  canCancel,
  onCancel,
  onCreate,
}: {
  existing: MatchState | null;
  canCancel?: boolean;
  onCancel?: () => void;
  onCreate: (s: MatchState) => Promise<void>;
}) {
  const [step, setStep] = useState<SetupStep>('format');
  const [format, setFormat] = useState<MatchFormat>('T20');
  const [home, setHome] = useState<TeamDraft>({ name: '', shortName: '', players: [] });
  const [away, setAway] = useState<TeamDraft>({ name: '', shortName: '', players: [] });
  const [strikerId, setStrikerId] = useState('');
  const [nonStrikerId, setNonStrikerId] = useState('');
  const [bowlerId, setBowlerId] = useState('');
  const [battingFirst, setBattingFirst] = useState<'home' | 'away'>('home');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const battingTeam = battingFirst === 'home' ? home : away;
  const bowlingTeam = battingFirst === 'home' ? away : home;

  const handleCreate = async () => {
    const striker = battingTeam.players.find((p) => p.id === strikerId);
    const nonStriker = battingTeam.players.find((p) => p.id === nonStrikerId);
    const bowler = bowlingTeam.players.find((p) => p.id === bowlerId);
    if (!striker || !nonStriker || !bowler) {
      setError('Please select striker, non-striker and opening bowler.');
      return;
    }
    if (strikerId === nonStrikerId) {
      setError('Striker and non-striker must be different players.');
      return;
    }

    const homeId = crypto.randomUUID();
    const awayId = crypto.randomUUID();

    const matchState: MatchState = {
      version: 1,
      matchId: crypto.randomUUID(),
      format: format === 'OD' ? 'OD' : format === 'T40' ? 'T40' : format === 'Other' ? 'Other' : 'T20',
      teams: {
        home: { id: homeId, name: home.name, shortName: home.shortName, players: home.players },
        away: { id: awayId, name: away.name, shortName: away.shortName, players: away.players },
      },
      innings: [
        {
          battingTeamId: battingFirst === 'home' ? homeId : awayId,
          bowlingTeamId: battingFirst === 'home' ? awayId : homeId,
          totalRuns: 0,
          wickets: 0,
          ballsBowled: 0,
          oversDisplay: '0.0',
          runRate: 0,
          currentBatters: {
            striker: { player: striker, runs: 0, balls: 0, fours: 0, sixes: 0 },
            nonStriker: { player: nonStriker, runs: 0, balls: 0, fours: 0, sixes: 0 },
          },
          currentBowler: { player: bowler, ballsBowled: 0, runsConceded: 0, wickets: 0, maidens: 0 },
          recentBalls: [],
        },
      ],
      currentInningsIndex: 0,
      status: 'in-progress',
      lastUpdated: Date.now(),
    };

    setError(null);
    setSubmitting(true);
    try {
      await onCreate(matchState);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start match');
    } finally {
      setSubmitting(false);
    }
  };

  const STEPS: SetupStep[] = ['format', 'home-team', 'away-team', 'lineup'];
  const stepIndex = STEPS.indexOf(step);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-willow-gold">OCS · New match</p>
          <h1 className="mt-1 text-2xl font-bold text-white">
            {step === 'format' ? 'Format' : step === 'home-team' ? 'Home team' : step === 'away-team' ? 'Away team' : 'Lineup'}
          </h1>
          <div className="mt-2 flex gap-1">
            {STEPS.map((s, i) => (
              <span key={s} className={cn('h-1 w-6 rounded-full', i <= stepIndex ? 'bg-willow-gold' : 'bg-white/20')} />
            ))}
          </div>
        </div>
        {canCancel && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="mt-1 rounded-lg p-2 text-white/40 hover:bg-white/5 hover:text-white/70"
            aria-label="Cancel setup"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Step: format */}
      {step === 'format' && (
        <WizardCard title="Format">
          <div className="grid grid-cols-2 gap-2">
            {(['T20', 'T40', 'OD', 'Other'] as MatchFormat[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFormat(f)}
                className={cn(
                  'rounded-xl px-4 py-5 text-center text-lg font-bold transition',
                  format === f
                    ? 'bg-willow-gold text-willow-night'
                    : 'border border-white/10 bg-white/[0.03] text-white/80 hover:bg-white/[0.07]',
                )}
              >
                {f}
              </button>
            ))}
          </div>
          <Button size="lg" className="mt-4 w-full" onClick={() => setStep('home-team')}>
            Next →
          </Button>
        </WizardCard>
      )}

      {/* Step: home team */}
      {step === 'home-team' && (
        <TeamSetupCard
          title="Home team"
          team={home}
          onChange={setHome}
          onBack={() => setStep('format')}
          onNext={() => setStep('away-team')}
        />
      )}

      {/* Step: away team */}
      {step === 'away-team' && (
        <TeamSetupCard
          title="Away team"
          team={away}
          onChange={setAway}
          onBack={() => setStep('home-team')}
          onNext={() => setStep('lineup')}
        />
      )}

      {/* Step: lineup */}
      {step === 'lineup' && (
        <WizardCard title="Lineup">
          <div className="space-y-4">
            {/* Batting first */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/50">
                Batting first
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['home', 'away'] as const).map((side) => {
                  const t = side === 'home' ? home : away;
                  return (
                    <button
                      key={side}
                      type="button"
                      onClick={() => setBattingFirst(side)}
                      className={cn(
                        'rounded-lg px-3 py-3 text-sm font-semibold transition',
                        battingFirst === side
                          ? 'bg-willow-gold text-willow-night'
                          : 'border border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.07]',
                      )}
                    >
                      {t.shortName || `${side} team`}
                    </button>
                  );
                })}
              </div>
            </div>

            <PlayerSelect
              label="Striker (facing first)"
              players={battingTeam.players}
              value={strikerId}
              exclude={nonStrikerId}
              onChange={setStrikerId}
            />
            <PlayerSelect
              label="Non-striker"
              players={battingTeam.players}
              value={nonStrikerId}
              exclude={strikerId}
              onChange={setNonStrikerId}
            />
            <PlayerSelect
              label="Opening bowler"
              players={bowlingTeam.players}
              value={bowlerId}
              onChange={setBowlerId}
            />

            {error && <p className="text-sm text-rose-400">{error}</p>}

            <div className="flex gap-2">
              <Button variant="ghost" size="lg" onClick={() => setStep('away-team')}>
                ← Back
              </Button>
              <Button
                size="lg"
                className="flex-1"
                loading={submitting}
                onClick={handleCreate}
              >
                Start match
              </Button>
            </div>
          </div>
        </WizardCard>
      )}
    </div>
  );
}

function WizardCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-2xl backdrop-blur">
      <h2 className="mb-4 text-lg font-bold text-white">{title}</h2>
      {children}
    </div>
  );
}

function TeamSetupCard({
  title,
  team,
  onChange,
  onBack,
  onNext,
}: {
  title: string;
  team: TeamDraft;
  onChange: (t: TeamDraft) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const { profile } = useAuth();
  const [playerName, setPlayerName] = useState('');
  const [clubTeams, setClubTeams] = useState<DbTeam[]>([]);
  const [clubPlayers, setClubPlayers] = useState<DbPlayer[]>([]);
  const [dbLoading, setDbLoading] = useState(false);

  // Load club teams + players from Supabase on first render if user has a club
  useEffect(() => {
    if (!profile?.club_id) return;
    setDbLoading(true);
    Promise.all([
      listTeams(profile.club_id).catch(() => [] as DbTeam[]),
      listPlayers(profile.club_id).catch(() => [] as DbPlayer[]),
    ]).then(([teams, players]) => {
      setClubTeams(teams);
      setClubPlayers(players);
    }).finally(() => setDbLoading(false));
  }, [profile?.club_id]);

  const selectedIds = new Set(team.players.map((p) => p.id));

  const toggleClubPlayer = (p: DbPlayer) => {
    if (selectedIds.has(p.id)) {
      onChange({ ...team, players: team.players.filter((x) => x.id !== p.id) });
    } else {
      const name = p.preferred_name ?? p.full_name;
      onChange({ ...team, players: [...team.players, { id: p.id, name }] });
    }
  };

  const addManual = () => {
    const name = playerName.trim();
    if (!name) return;
    onChange({ ...team, players: [...team.players, { id: crypto.randomUUID(), name }] });
    setPlayerName('');
  };

  const removePlayer = (id: string) =>
    onChange({ ...team, players: team.players.filter((p) => p.id !== id) });

  const canAdvance = team.name.length >= 2 && team.shortName.length >= 2 && team.players.length >= 2;

  return (
    <WizardCard title={title}>
      <div className="space-y-4">
        {/* Team name row — optionally pre-fill from Supabase team */}
        <div className="flex gap-2">
          <FormField label="Team name" className="flex-1">
            {clubTeams.length > 0 ? (
              <select
                value={clubTeams.find((t) => t.name === team.name)?.id ?? ''}
                onChange={(e) => {
                  const t = clubTeams.find((x) => x.id === e.target.value);
                  if (t) onChange({ ...team, name: t.name, shortName: t.short_name });
                }}
                className="w-full rounded-lg border border-white/10 bg-willow-night px-3 py-2.5 text-sm text-white focus:border-willow-gold focus:outline-none"
              >
                <option value="">— pick a team or type below —</option>
                {clubTeams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            ) : null}
            <Input
              value={team.name}
              onChange={(e) => onChange({ ...team, name: e.target.value })}
              placeholder="Willow First XI"
              maxLength={120}
              className={clubTeams.length > 0 ? 'mt-1.5' : ''}
            />
          </FormField>
          <FormField label="Short">
            <Input
              value={team.shortName}
              onChange={(e) => onChange({ ...team, shortName: e.target.value.toUpperCase() })}
              placeholder="WIL"
              maxLength={6}
              className="w-16 uppercase tracking-widest"
            />
          </FormField>
        </div>

        {/* Players — pick from club registry if available, or type manually */}
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-white/50">
              Players {team.players.length > 0 && `(${team.players.length} selected)`}
            </span>
            {dbLoading && <span className="text-[10px] text-white/30">Loading registry…</span>}
          </div>

          {/* Club registry chips */}
          {clubPlayers.length > 0 && (
            <div className="mb-3">
              <p className="mb-1.5 text-[10px] uppercase tracking-wider text-white/40">Tap to add from club registry</p>
              <div className="flex flex-wrap gap-1.5">
                {clubPlayers.map((p) => {
                  const selected = selectedIds.has(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggleClubPlayer(p)}
                      className={cn(
                        'rounded-full px-3 py-1 text-xs font-medium transition',
                        selected
                          ? 'bg-willow-gold text-willow-night'
                          : 'border border-white/15 bg-white/5 text-white/70 hover:border-willow-gold/40 hover:text-white',
                      )}
                    >
                      {selected && '✓ '}{p.preferred_name ?? p.full_name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Manual add */}
          <div className="flex gap-2">
            <Input
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addManual(); } }}
              placeholder={clubPlayers.length > 0 ? 'Add visitor or unlisted player…' : 'Player name…'}
              className="flex-1 text-sm"
            />
            <Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={addManual} disabled={!playerName.trim()}>
              Add
            </Button>
          </div>
        </div>

        {/* Selected roster */}
        {team.players.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-white/40">Selected ({team.players.length})</p>
            <div className="max-h-36 space-y-1 overflow-y-auto rounded-lg border border-white/10 p-2">
              {team.players.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded px-2 py-1 text-sm hover:bg-white/5">
                  <span className="text-white">{p.name}</span>
                  <button type="button" onClick={() => removePlayer(p.id)} className="text-white/30 hover:text-rose-400">
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {team.players.length < 2 && (
          <p className="text-xs text-amber-400/80">
            {clubPlayers.length > 0
              ? 'Tap players above or type a name to add. Need at least 2.'
              : 'Add at least 2 players to continue.'}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <Button variant="ghost" size="md" onClick={onBack}>← Back</Button>
          <Button size="md" className="flex-1" disabled={!canAdvance} onClick={onNext}>
            Next →
          </Button>
        </div>
      </div>
    </WizardCard>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function PlayerSelect({
  label,
  players,
  value,
  exclude,
  onChange,
}: {
  label: string;
  players: Player[];
  value: string;
  exclude?: string;
  onChange: (id: string) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/50">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-white/10 bg-willow-night px-3 py-2.5 text-sm text-white focus:border-willow-gold focus:outline-none"
      >
        <option value="">— select player —</option>
        {players
          .filter((p) => p.id !== exclude)
          .map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
      </select>
    </div>
  );
}
