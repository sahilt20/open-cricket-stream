import { useState, useRef, useEffect, type ReactNode } from 'react';
import { RotateCcw, X, ChevronRight, Plus, ArrowLeft, Radio } from 'lucide-react';
import { Modal } from '../components/Modal.js';
import { FormField, Input } from '../components/Input.js';
import { useEngine } from '../contexts/EngineContext.js';
import { useAuth } from '../contexts/AuthContext.js';
import { listTeams, listPlayers, type Team as DbTeam, type Player as DbPlayer } from '../lib/api.js';
import type { BallEvent, DismissalType, Innings, MatchState, Player } from '../lib/match-state.js';
import { cn } from '../lib/cn.js';

// ─── Types ────────────────────────────────────────────────────────────────────

type MatchFormat = 'T20' | 'T40' | 'OD' | 'Other';
type WizardTab = 'match-info' | 'home-team' | 'away-team' | 'lineup';
type BallStep = 'idle' | 'wide-extras' | 'noball-runs' | 'bye-runs' | 'legbye-runs' | 'wicket';

const DISMISSAL_LABELS: Record<DismissalType, string> = {
  bowled: 'Bowled', caught: 'Caught', lbw: 'LBW', runOut: 'Run Out',
  stumped: 'Stumped', hitWicket: 'Hit Wicket', retired: 'Retired', other: 'Other',
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
      <MatchSetupWizard
        existing={state}
        canCancel={setupMode}
        onCancel={() => setSetupMode(false)}
        onCreate={handleCreate}
      />
    );
  }

  const innings = state.innings[state.currentInningsIndex];

  return (
    <div className="fixed inset-0 flex flex-col bg-pitch-bg h-dvh">
      {/* ── Zone 1: Header ── */}
      <ScorerHeader
        state={state}
        conn={conn}
        onNewMatch={() => setSetupMode(true)}
      />

      {/* ── Zone 2: Scoreboard ── */}
      <div className="flex-1 overflow-y-auto">
        {innings ? (
          <ScoreboardZone state={state} innings={innings} />
        ) : (
          <div className="flex h-full items-center justify-center text-white/40 text-sm">
            No innings started
          </div>
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

        {state.status === 'completed' && (
          <MatchCompleteView state={state} onNewMatch={() => setSetupMode(true)} />
        )}
      </div>

      {/* ── Zone 3: Controls ── */}
      {state.status === 'in-progress' && innings && (
        <div className="shrink-0 border-t border-pitch-border bg-pitch-surface">
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
        </div>
      )}
    </div>
  );
}

// ─── Header ──────────────────────────────────────────────────────────────────

function ScorerHeader({
  state,
  conn,
  onNewMatch,
}: {
  state: MatchState;
  conn: string;
  onNewMatch: () => void;
}) {
  const innings = state.innings[state.currentInningsIndex];
  const connColor = conn === 'connected' ? 'bg-accent-green' : conn === 'connecting' ? 'bg-accent-gold' : 'bg-danger';

  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-pitch-border bg-pitch-surface/95 px-4 backdrop-blur-md">
      <span className="text-sm font-black uppercase tracking-[0.22em] text-accent-gold">OCS</span>

      {/* Live score summary */}
      {innings && (
        <div className="flex items-center gap-2">
          <span className={cn('h-1.5 w-1.5 rounded-full', connColor)} />
          <span className="text-xs font-bold text-white/80 tabular-nums">
            {state.teams.home.shortName} {state.teams.away.shortName}
          </span>
          <span className="text-xs font-black tabular-nums text-white">
            {innings.totalRuns}/{innings.wickets}
          </span>
          <span className="text-[10px] text-white/50 tabular-nums">({innings.oversDisplay})</span>
        </div>
      )}

      <div className="flex items-center gap-2">
        <span className={cn('hidden sm:flex items-center gap-1.5 rounded-full border border-pitch-border bg-pitch-raised px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-white/50')}>
          <span className={cn('h-1.5 w-1.5 rounded-full', connColor)} />
          {conn === 'connected' ? 'Live' : conn}
        </span>
        <button
          type="button"
          onClick={onNewMatch}
          className="flex items-center gap-1 rounded-full border border-pitch-border bg-pitch-raised px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white/60 transition hover:border-accent-gold/40 hover:text-accent-gold"
        >
          <Plus size={11} />
          New
        </button>
      </div>
    </header>
  );
}

// ─── Scoreboard zone ──────────────────────────────────────────────────────────

function ScoreboardZone({ state, innings }: { state: MatchState; innings: Innings }) {
  const battingTeam = innings.battingTeamId === state.teams.home.id ? state.teams.home : state.teams.away;
  const bowlingTeam = innings.bowlingTeamId === state.teams.home.id ? state.teams.home : state.teams.away;
  const { striker, nonStriker } = innings.currentBatters;
  const bowler = innings.currentBowler;
  const inningsLabel = state.currentInningsIndex === 0 ? '1ST INNINGS' : '2ND INNINGS';

  return (
    <div>
      {/* Score hero */}
      <div className="bg-pitch-surface px-4 pt-4 pb-3">
        {state.tournament && (
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-accent-gold/70">
            {state.tournament}
          </div>
        )}
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-white/40">
              {state.teams.home.shortName} VS {state.teams.away.shortName} · {inningsLabel} · {state.format}
            </div>
            <div className="mt-1 flex items-end gap-1 leading-none">
              <span className="text-[5.5rem] font-black tabular-nums text-white leading-[0.9]">
                {innings.totalRuns}
              </span>
              <span className="mb-1 text-[2.8rem] font-bold text-white/40">/{innings.wickets}</span>
            </div>
          </div>
          <div className="text-right mt-1">
            <div className="text-[10px] uppercase tracking-wider text-white/40">OVERS</div>
            <div className="text-3xl font-black tabular-nums text-accent-gold">{innings.oversDisplay}</div>
            {innings.target && (
              <div className="mt-1 text-[10px] text-white/50">
                TARGET <span className="text-white font-bold">{innings.target}</span>
              </div>
            )}
          </div>
        </div>

        {/* Stats bar */}
        <div className="mt-2 flex items-center gap-4 text-xs">
          <span className="text-white/50">
            CRR <span className="font-bold text-accent-green">{innings.runRate.toFixed(2)}</span>
          </span>
          {innings.requiredRunRate !== undefined && (
            <span className="text-white/50">
              RRR <span className={cn('font-bold', innings.requiredRunRate > innings.runRate ? 'text-danger' : 'text-accent-green')}>
                {innings.requiredRunRate.toFixed(2)}
              </span>
            </span>
          )}
          {innings.target && (
            <span className="text-white/50">
              NEED <span className="font-bold text-white">{Math.max(0, innings.target - innings.totalRuns)}</span>
            </span>
          )}
        </div>
      </div>

      {/* Batter/Bowler panel */}
      <div className="border-t border-pitch-border bg-pitch-raised px-4 py-3">
        <div className="grid grid-cols-5 gap-3">
          {/* Batters */}
          <div className="col-span-3">
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/40">
              {battingTeam.shortName} – BATTING
            </div>
            <BatterRow card={striker} isStriker />
            <BatterRow card={nonStriker} isStriker={false} />
          </div>
          {/* Bowler */}
          <div className="col-span-2 text-right">
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/40">
              {bowlingTeam.shortName} – BOWLING
            </div>
            <div className="text-sm font-bold text-white truncate">{bowler.player.name}</div>
            <div className="text-xs tabular-nums text-accent-green">
              {Math.floor(bowler.ballsBowled / 6)}.{bowler.ballsBowled % 6}–
              {bowler.maidens}–{bowler.runsConceded}–{bowler.wickets}
            </div>
          </div>
        </div>
      </div>

      {/* This Over strip */}
      {innings.recentBalls.length > 0 && (
        <div className="border-t border-pitch-border px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40 shrink-0">THIS OVER</span>
            <div className="flex gap-1.5 flex-wrap">
              {innings.recentBalls.slice(-6).map((b, i) => (
                <OverDot key={i} ball={b} />
              ))}
              {/* Empty remaining balls in over */}
              {Array.from({ length: Math.max(0, 6 - innings.recentBalls.slice(-6).length) }).map((_, i) => (
                <span
                  key={`empty-${i}`}
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-pitch-border text-[10px] text-white/20"
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BatterRow({ card, isStriker }: { card: { player: Player; runs: number; balls: number; fours: number; sixes: number }; isStriker: boolean }) {
  return (
    <div className={cn('flex items-baseline justify-between py-0.5', isStriker ? 'text-white' : 'text-white/55')}>
      <span className="text-sm font-semibold truncate max-w-[120px]">
        {card.player.name}
        {isStriker && <span className="ml-0.5 text-accent-gold text-xs">*</span>}
      </span>
      <div className="flex items-baseline gap-2 shrink-0">
        <span className="text-sm font-bold tabular-nums">{card.runs}</span>
        <span className="text-xs text-white/40 tabular-nums">({card.balls})</span>
        {(card.fours > 0 || card.sixes > 0) && (
          <span className="text-[10px] text-white/35">
            {card.fours > 0 && `${card.fours}×4`}
            {card.fours > 0 && card.sixes > 0 && ' '}
            {card.sixes > 0 && `${card.sixes}×6`}
          </span>
        )}
      </div>
    </div>
  );
}

function OverDot({ ball }: { ball: BallEvent }) {
  const isWicket = !!ball.wicket;
  const isWide = ball.extras?.kind === 'wide';
  const isNoBall = ball.extras?.kind === 'noBall';
  const isBoundary = ball.batterRuns >= 4 && !ball.extras;
  const val = isWicket ? 'W' : isWide ? 'wd' : isNoBall ? 'nb' : ball.batterRuns === 0 ? '·' : String(ball.batterRuns);

  return (
    <span
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold',
        isWicket ? 'bg-danger text-white' :
        isWide || isNoBall ? 'bg-accent-gold/20 text-accent-gold border border-accent-gold/30' :
        isBoundary ? 'bg-accent-gold text-pitch-bg' :
        'bg-pitch-raised border border-pitch-border text-white/80',
      )}
    >
      {val}
    </span>
  );
}

// ─── Ball entry panel ─────────────────────────────────────────────────────────

function BallEntryPanel({
  state, innings, disabled, onSendBall, onUndo,
}: {
  state: MatchState; innings: Innings; disabled: boolean;
  onSendBall: (e: BallEvent) => Promise<void>;
  onUndo: () => Promise<void>;
}) {
  const [step, setStep] = useState<BallStep>('idle');
  const [wicketOpen, setWicketOpen] = useState(false);
  const [bowlerOpen, setBowlerOpen] = useState(false);
  const [pendingNextBowlerId, setPendingNextBowlerId] = useState<string | null>(null);

  // Detect over completion
  const prevLegal = useRef(innings.ballsBowled);
  useEffect(() => {
    const b = innings.ballsBowled;
    if (b > 0 && b % 6 === 0 && b !== prevLegal.current) setBowlerOpen(true);
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

  const handleRun = (n: number) => submit({ ...buildBase(), isLegal: true, batterRuns: n });
  const handleWideRun = (total: number) => submit({ ...buildBase(), isLegal: false, batterRuns: 0, extras: { kind: 'wide', runs: total } });
  const handleNoBall = (runs: number) => submit({ ...buildBase(), isLegal: false, batterRuns: runs, extras: { kind: 'noBall', runs: 1 } });
  const handleBye = (runs: number) => submit({ ...buildBase(), isLegal: true, batterRuns: 0, extras: { kind: 'bye', runs } });
  const handleLegBye = (runs: number) => submit({ ...buildBase(), isLegal: true, batterRuns: 0, extras: { kind: 'legBye', runs } });

  const bowlingTeam = innings.bowlingTeamId === state.teams.home.id ? state.teams.home : state.teams.away;
  const battingTeam = innings.battingTeamId === state.teams.home.id ? state.teams.home : state.teams.away;

  return (
    <div className="px-3 py-3 pb-safe space-y-2">
      {/* Pending bowler banner */}
      {pendingNextBowlerId && (
        <div className="flex items-center justify-between rounded-xl border border-accent-gold/30 bg-accent-gold/10 px-3 py-2">
          <span className="text-xs font-semibold text-accent-gold">
            Bowling: {bowlingTeam.players.find((p) => p.id === pendingNextBowlerId)?.name}
          </span>
          <button type="button" onClick={() => setPendingNextBowlerId(null)} className="text-[10px] text-white/40 hover:text-white/70">
            Change
          </button>
        </div>
      )}

      {step === 'idle' && (
        <>
          {/* Row 1: 0,1,2,3 */}
          <div className="grid grid-cols-4 gap-2">
            {([0, 1, 2, 3] as const).map((n) => (
              <ScoreBtn
                key={n}
                value={n === 0 ? '·' : String(n)}
                label={n === 0 ? 'DOT' : n === 1 ? 'RUN' : 'RUNS'}
                disabled={disabled}
                onClick={() => handleRun(n)}
              />
            ))}
          </div>

          {/* Row 2: 4, 6, WICKET */}
          <div className="grid grid-cols-3 gap-2">
            <ScoreBtn
              value="4"
              label="FOUR"
              disabled={disabled}
              onClick={() => handleRun(4)}
              className="border-accent-gold/50 bg-accent-gold/10 text-accent-gold hover:bg-accent-gold/20"
            />
            <ScoreBtn
              value="6"
              label="SIX"
              disabled={disabled}
              onClick={() => handleRun(6)}
              className="border-accent-gold/70 bg-accent-gold/20 text-accent-gold hover:bg-accent-gold/30"
            />
            <button
              type="button"
              disabled={disabled}
              onClick={() => setWicketOpen(true)}
              className="tap-xl flex flex-col items-center justify-center gap-0.5 rounded-xl border border-danger/70 bg-danger text-white transition active:scale-95 active:bg-danger-dim disabled:opacity-40 shadow-lg shadow-danger/20"
            >
              <span className="text-xl font-black">W</span>
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">WICKET</span>
            </button>
          </div>

          {/* Row 3: extras + undo */}
          <div className="grid grid-cols-5 gap-2">
            <ExtrasBtn label="WD" sublabel="Wide" color="amber" disabled={disabled} onClick={() => setStep('wide-extras')} />
            <ExtrasBtn label="NB" sublabel="No Ball" color="amber" disabled={disabled} onClick={() => setStep('noball-runs')} />
            <ExtrasBtn label="LB" sublabel="Leg Bye" color="slate" disabled={disabled} onClick={() => setStep('legbye-runs')} />
            <ExtrasBtn label="B" sublabel="Bye" color="slate" disabled={disabled} onClick={() => setStep('bye-runs')} />
            <button
              type="button"
              onClick={onUndo}
              className="tap-target flex flex-col items-center justify-center gap-0.5 rounded-xl border border-pitch-border bg-pitch-raised text-white/50 transition hover:text-white/80 active:scale-95"
            >
              <RotateCcw size={16} />
              <span className="text-[10px] font-semibold uppercase tracking-wider">Undo</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setBowlerOpen(true)}
            className="w-full text-center text-[11px] text-white/25 hover:text-white/60 py-1 transition"
          >
            Change bowler
          </button>
        </>
      )}

      {step === 'wide-extras' && (
        <ExtraRunPicker
          label="Wide — how many extras?"
          options={[1, 2, 3, 4, 5]}
          getLabel={(n) => `+${n}`}
          onSelect={handleWideRun}
          onCancel={() => setStep('idle')}
          hint="Total wide runs (1 = standard wide)"
        />
      )}
      {step === 'noball-runs' && (
        <ExtraRunPicker
          label="No Ball — batter scored"
          options={[0, 1, 2, 3, 4, 6]}
          getLabel={(n) => (n === 0 ? '·' : String(n))}
          onSelect={handleNoBall}
          onCancel={() => setStep('idle')}
          hint="+1 no-ball penalty added automatically"
        />
      )}
      {step === 'bye-runs' && (
        <ExtraRunPicker label="Byes" options={[1, 2, 3, 4]} getLabel={String} onSelect={handleBye} onCancel={() => setStep('idle')} />
      )}
      {step === 'legbye-runs' && (
        <ExtraRunPicker label="Leg Byes" options={[1, 2, 3, 4]} getLabel={String} onSelect={handleLegBye} onCancel={() => setStep('idle')} />
      )}

      <WicketModal
        open={wicketOpen}
        innings={innings}
        battingTeam={battingTeam}
        bowlingTeam={bowlingTeam}
        currentBowlerId={pendingNextBowlerId ?? innings.currentBowler.player.id}
        onSubmit={async (w) => {
          setWicketOpen(false);
          await submit({
            ...buildBase(), isLegal: true, batterRuns: 0,
            wicket: {
              type: w.type, outBatterId: w.outBatterId,
              bowlerId: BOWLER_CREDITED.has(w.type) ? (pendingNextBowlerId ?? innings.currentBowler.player.id) : undefined,
              fielderId: w.fielderId || undefined,
            },
            replacementBatterId: w.replacementBatterId || undefined,
          });
        }}
        onClose={() => setWicketOpen(false)}
      />

      <BowlerModal
        open={bowlerOpen}
        bowlingTeam={bowlingTeam}
        currentBowlerId={innings.currentBowler.player.id}
        onSelect={(id) => { setPendingNextBowlerId(id); setBowlerOpen(false); }}
        onClose={() => setBowlerOpen(false)}
      />
    </div>
  );
}

// ─── Scoring button atoms ─────────────────────────────────────────────────────

function ScoreBtn({
  value, label, disabled, onClick, className,
}: {
  value: string; label?: string; disabled: boolean; onClick: () => void; className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'tap-xl flex flex-col items-center justify-center gap-0.5 rounded-xl border border-pitch-border bg-pitch-raised text-white transition active:scale-95 active:bg-pitch-muted/50 disabled:opacity-40 select-none',
        className,
      )}
    >
      <span className="text-2xl font-black leading-none tabular-nums">{value}</span>
      {label && <span className="text-[9px] font-bold uppercase tracking-wider opacity-50">{label}</span>}
    </button>
  );
}

function ExtrasBtn({
  label, sublabel, color, disabled, onClick,
}: {
  label: string; sublabel: string; color: 'amber' | 'slate'; disabled: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'tap-target flex flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-bold uppercase tracking-wider transition active:scale-95 disabled:opacity-40 select-none',
        color === 'amber'
          ? 'border border-accent-gold/30 bg-accent-gold/10 text-accent-gold hover:bg-accent-gold/20'
          : 'border border-pitch-border bg-pitch-raised text-white/60 hover:bg-pitch-muted/40',
      )}
    >
      <span className="text-sm font-black">{label}</span>
      <span className="text-[9px] opacity-60">{sublabel}</span>
    </button>
  );
}

function ExtraRunPicker({
  label, options, getLabel, onSelect, onCancel, hint,
}: {
  label: string; options: number[]; getLabel: (n: number) => string;
  onSelect: (n: number) => void; onCancel: () => void; hint?: string;
}) {
  return (
    <div className="rounded-xl border border-pitch-border bg-pitch-raised p-4 animate-slide-up space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-white">{label}</span>
        <button type="button" onClick={onCancel} className="text-white/40 hover:text-white/80 transition">
          <X size={18} />
        </button>
      </div>
      {hint && <p className="text-[11px] text-white/40">{hint}</p>}
      <div className="grid grid-cols-3 gap-2">
        {options.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onSelect(n)}
            className="tap-xl flex items-center justify-center rounded-xl border border-pitch-border bg-pitch-surface text-xl font-black text-white transition hover:border-accent-gold/40 hover:bg-pitch-muted/40 active:scale-95"
          >
            {getLabel(n)}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Wicket modal ─────────────────────────────────────────────────────────────

type WicketData = {
  type: DismissalType; outBatterId: string; fielderId?: string; replacementBatterId?: string;
};

function WicketModal({
  open, innings, battingTeam, bowlingTeam, currentBowlerId, onSubmit, onClose,
}: {
  open: boolean; innings: Innings;
  battingTeam: { id: string; name: string; shortName: string; players: Player[] };
  bowlingTeam: { id: string; name: string; shortName: string; players: Player[] };
  currentBowlerId: string;
  onSubmit: (data: WicketData) => Promise<void>; onClose: () => void;
}) {
  const [type, setType] = useState<DismissalType>('bowled');
  const [outBatterId, setOutBatterId] = useState(innings.currentBatters.striker.player.id);
  const [fielderId, setFielderId] = useState('');
  const [replacementId, setReplacementId] = useState('');

  useEffect(() => {
    if (open) {
      setType('bowled');
      setOutBatterId(innings.currentBatters.striker.player.id);
      setFielderId(''); setReplacementId('');
    }
  }, [open, innings.currentBatters.striker.player.id]);

  const activeBatterIds = new Set([
    innings.currentBatters.striker.player.id,
    innings.currentBatters.nonStriker.player.id,
  ]);
  const availableReplacements = battingTeam.players.filter((p) => !activeBatterIds.has(p.id));

  return (
    <Modal
      open={open} onClose={onClose} title="Wicket" size="md"
      footer={
        <>
          <button type="button" onClick={onClose} className="h-9 rounded-lg border border-pitch-border px-4 text-sm font-semibold text-white/70 transition hover:bg-pitch-raised">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSubmit({ type, outBatterId, fielderId: NEEDS_FIELDER.has(type) ? fielderId : undefined, replacementBatterId: replacementId || undefined })}
            className="h-9 rounded-lg bg-danger px-4 text-sm font-bold text-white transition hover:bg-danger-dim"
          >
            Confirm Wicket
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">How out</label>
          <div className="grid grid-cols-2 gap-1.5">
            {(Object.entries(DISMISSAL_LABELS) as [DismissalType, string][]).map(([val, lbl]) => (
              <button
                key={val} type="button" onClick={() => setType(val)}
                className={cn(
                  'rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition',
                  type === val ? 'bg-danger text-white' : 'bg-pitch-raised text-white/70 hover:bg-pitch-muted/50 border border-pitch-border',
                )}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">Batter out</label>
          <div className="flex gap-2">
            {[innings.currentBatters.striker, innings.currentBatters.nonStriker].map((card) => (
              <button
                key={card.player.id} type="button" onClick={() => setOutBatterId(card.player.id)}
                className={cn(
                  'flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
                  outBatterId === card.player.id ? 'bg-danger text-white' : 'bg-pitch-raised text-white/70 border border-pitch-border hover:bg-pitch-muted/50',
                )}
              >
                {card.player.name}
                {card.player.id === innings.currentBatters.striker.player.id && ' *'}
              </button>
            ))}
          </div>
        </div>

        {NEEDS_FIELDER.has(type) && (
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">
              {type === 'runOut' ? 'Fielder (ran out)' : type === 'stumped' ? 'Keeper' : 'Catcher'}
            </label>
            <select
              value={fielderId} onChange={(e) => setFielderId(e.target.value)}
              className="w-full rounded-xl border border-pitch-border bg-pitch-raised px-3 py-2.5 text-sm text-white focus:border-accent-gold/40 focus:outline-none"
            >
              <option value="">— pick fielder —</option>
              {bowlingTeam.players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}

        {availableReplacements.length > 0 && (
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">Next batter in</label>
            <select
              value={replacementId} onChange={(e) => setReplacementId(e.target.value)}
              className="w-full rounded-xl border border-pitch-border bg-pitch-raised px-3 py-2.5 text-sm text-white focus:border-accent-gold/40 focus:outline-none"
            >
              <option value="">— pick next batter —</option>
              {availableReplacements.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── Bowler picker modal ───────────────────────────────────────────────────────

function BowlerModal({
  open, bowlingTeam, currentBowlerId, onSelect, onClose,
}: {
  open: boolean; bowlingTeam: { players: Player[] };
  currentBowlerId: string; onSelect: (id: string) => void; onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Next bowler" size="sm">
      <div className="space-y-1.5">
        {bowlingTeam.players.map((p) => (
          <button
            key={p.id} type="button" onClick={() => onSelect(p.id)}
            className={cn(
              'flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-medium transition',
              p.id === currentBowlerId
                ? 'border border-pitch-border bg-pitch-raised text-white/50 cursor-default'
                : 'bg-pitch-raised text-white hover:border hover:border-accent-green/30 hover:bg-accent-green/10 border border-transparent',
            )}
          >
            {p.name}
            {p.id === currentBowlerId ? (
              <span className="text-[10px] text-white/30 uppercase tracking-wider">Current</span>
            ) : (
              <ChevronRight size={14} className="text-white/30" />
            )}
          </button>
        ))}
      </div>
    </Modal>
  );
}

// ─── Innings break view ───────────────────────────────────────────────────────

function InningsBreakView({ state, onCreate }: { state: MatchState; onCreate: (s: MatchState) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const first = state.innings[0];
  if (!first) return null;

  const secondBattingTeam = first.battingTeamId === state.teams.home.id ? state.teams.away : state.teams.home;
  const secondBowlingTeam = first.bowlingTeamId === state.teams.home.id ? state.teams.away : state.teams.home;

  return (
    <div className="mx-4 my-4 space-y-3">
      <div className="rounded-2xl border border-pitch-border bg-pitch-surface p-5 text-center">
        <div className="text-[10px] font-bold uppercase tracking-widest text-accent-gold/70">Innings Break</div>
        <h2 className="mt-1 text-xl font-bold text-white">
          {first.battingTeamId === state.teams.home.id ? state.teams.home.shortName : state.teams.away.shortName}{' '}
          <span className="text-white/50">{first.totalRuns}/{first.wickets}</span>
        </h2>
        <p className="mt-1 text-sm text-accent-gold">
          {secondBattingTeam.shortName} need {first.totalRuns + 1} to win
        </p>
      </div>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent-green py-4 text-base font-bold text-pitch-bg shadow-lg shadow-accent-green/20 transition active:scale-[0.98]"
      >
        <Radio size={18} />
        Set up 2nd innings
      </button>

      <InningsSetupModal
        open={open}
        battingTeam={secondBattingTeam}
        bowlingTeam={secondBowlingTeam}
        target={first.totalRuns + 1}
        onConfirm={(setup) => {
          setOpen(false);
          const totalBalls = first.ballsBowled;
          const totalOvers = Math.floor(totalBalls / 6);
          void onCreate({
            ...state,
            innings: [
              ...state.innings,
              {
                battingTeamId: secondBattingTeam.id,
                bowlingTeamId: secondBowlingTeam.id,
                totalRuns: 0, wickets: 0, ballsBowled: 0, oversDisplay: '0.0', runRate: 0,
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
            currentInningsIndex: 1, status: 'in-progress', lastUpdated: Date.now(),
          });
        }}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}

type InningsSetup = { striker: Player; nonStriker: Player; bowler: Player };

function InningsSetupModal({
  open, battingTeam, bowlingTeam, target, onConfirm, onClose,
}: {
  open: boolean; battingTeam: { players: Player[] }; bowlingTeam: { players: Player[] };
  target: number; onConfirm: (setup: InningsSetup) => void; onClose: () => void;
}) {
  const [strikerId, setStrikerId] = useState('');
  const [nonStrikerId, setNonStrikerId] = useState('');
  const [bowlerId, setBowlerId] = useState('');
  useEffect(() => { if (open) { setStrikerId(''); setNonStrikerId(''); setBowlerId(''); } }, [open]);
  const striker = battingTeam.players.find((p) => p.id === strikerId);
  const nonStriker = battingTeam.players.find((p) => p.id === nonStrikerId);
  const bowler = bowlingTeam.players.find((p) => p.id === bowlerId);
  const valid = striker && nonStriker && bowler && strikerId !== nonStrikerId;
  return (
    <Modal open={open} onClose={onClose} title={`2nd innings · chase ${target}`} size="sm"
      footer={
        <>
          <button type="button" onClick={onClose} className="h-9 rounded-lg border border-pitch-border px-4 text-sm font-semibold text-white/70 hover:bg-pitch-raised transition">Cancel</button>
          <button type="button" disabled={!valid} onClick={() => valid && onConfirm({ striker, nonStriker, bowler })}
            className="h-9 rounded-lg bg-accent-green px-4 text-sm font-bold text-pitch-bg transition hover:bg-accent-green-dim disabled:opacity-40">
            Start innings
          </button>
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
    <div className="mx-4 my-4 rounded-2xl border border-pitch-border bg-pitch-surface p-6 text-center">
      <div className="text-[10px] font-bold uppercase tracking-widest text-accent-gold/70">Match Complete</div>
      {state.result && <p className="mt-2 text-lg font-bold text-white">{state.result}</p>}
      <button
        type="button"
        onClick={onNewMatch}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-accent-gold py-3.5 text-sm font-bold text-pitch-bg transition hover:bg-amber-400 active:scale-[0.98]"
      >
        <Plus size={16} />
        Start next match
      </button>
    </div>
  );
}

// ─── Match setup wizard ───────────────────────────────────────────────────────

type TeamDraft = { name: string; shortName: string; players: Player[] };

const WIZARD_TABS: { id: WizardTab; label: string }[] = [
  { id: 'match-info', label: 'Match Info' },
  { id: 'home-team', label: 'Home Team' },
  { id: 'away-team', label: 'Away Team' },
  { id: 'lineup', label: 'Lineup' },
];

function MatchSetupWizard({
  existing, canCancel, onCancel, onCreate,
}: {
  existing: MatchState | null; canCancel?: boolean;
  onCancel?: () => void; onCreate: (s: MatchState) => Promise<void>;
}) {
  const [tab, setTab] = useState<WizardTab>('match-info');
  const [format, setFormat] = useState<MatchFormat>('T20');
  const [tournament, setTournament] = useState('');
  const [venue, setVenue] = useState('');
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

  const tabOrder: WizardTab[] = ['match-info', 'home-team', 'away-team', 'lineup'];
  const tabIndex = tabOrder.indexOf(tab);
  const isFirst = tabIndex === 0;
  const isLast = tabIndex === tabOrder.length - 1;

  const canAdvanceFrom = (t: WizardTab) => {
    if (t === 'home-team') return home.name.length >= 2 && home.shortName.length >= 2 && home.players.length >= 2;
    if (t === 'away-team') return away.name.length >= 2 && away.shortName.length >= 2 && away.players.length >= 2;
    return true;
  };

  const handleCreate = async () => {
    const striker = battingTeam.players.find((p) => p.id === strikerId);
    const nonStriker = battingTeam.players.find((p) => p.id === nonStrikerId);
    const bowler = bowlingTeam.players.find((p) => p.id === bowlerId);
    if (!striker || !nonStriker || !bowler) { setError('Select striker, non-striker and opening bowler.'); return; }
    if (strikerId === nonStrikerId) { setError('Striker and non-striker must be different.'); return; }

    const homeId = crypto.randomUUID();
    const awayId = crypto.randomUUID();

    const matchState: MatchState = {
      version: 1, matchId: crypto.randomUUID(),
      format: format === 'OD' ? 'OD' : format === 'T40' ? 'T40' : format === 'Other' ? 'Other' : 'T20',
      tournament: tournament.trim() || undefined,
      venue: venue.trim() || undefined,
      teams: {
        home: { id: homeId, name: home.name, shortName: home.shortName, players: home.players },
        away: { id: awayId, name: away.name, shortName: away.shortName, players: away.players },
      },
      innings: [{
        battingTeamId: battingFirst === 'home' ? homeId : awayId,
        bowlingTeamId: battingFirst === 'home' ? awayId : homeId,
        totalRuns: 0, wickets: 0, ballsBowled: 0, oversDisplay: '0.0', runRate: 0,
        currentBatters: {
          striker: { player: striker, runs: 0, balls: 0, fours: 0, sixes: 0 },
          nonStriker: { player: nonStriker, runs: 0, balls: 0, fours: 0, sixes: 0 },
        },
        currentBowler: { player: bowler, ballsBowled: 0, runsConceded: 0, wickets: 0, maidens: 0 },
        recentBalls: [],
      }],
      currentInningsIndex: 0, status: 'in-progress', lastUpdated: Date.now(),
    };

    setError(null); setSubmitting(true);
    try { await onCreate(matchState); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to start match'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-pitch-bg h-dvh">
      {/* Wizard header */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-pitch-border bg-pitch-surface px-4">
        {canCancel && onCancel ? (
          <button type="button" onClick={onCancel} className="flex h-9 w-9 items-center justify-center rounded-xl text-white/50 transition hover:bg-pitch-raised hover:text-white/80">
            <ArrowLeft size={20} />
          </button>
        ) : (
          <span className="flex h-9 w-9 items-center justify-center text-accent-gold font-black text-sm uppercase tracking-widest">OCS</span>
        )}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-accent-gold/70">New Match</div>
          <div className="text-sm font-bold text-white">{WIZARD_TABS.find((t) => t.id === tab)?.label}</div>
        </div>
      </header>

      {/* Tab bar */}
      <div className="flex shrink-0 border-b border-pitch-border bg-pitch-surface">
        {WIZARD_TABS.map((t, i) => (
          <button
            key={t.id}
            type="button"
            onClick={() => i < tabIndex || canAdvanceFrom(tabOrder[tabIndex - 1] ?? 'match-info') ? setTab(t.id) : undefined}
            className={cn(
              'flex-1 border-b-2 py-3 text-[11px] font-bold uppercase tracking-wider transition',
              tab === t.id
                ? 'border-accent-gold text-accent-gold'
                : i < tabIndex
                  ? 'border-transparent text-white/60 hover:text-white/80'
                  : 'border-transparent text-white/25',
            )}
          >
            {t.label.split(' ')[0]}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-4 py-5">
        {tab === 'match-info' && (
          <MatchInfoTab
            format={format} onFormatChange={setFormat}
            tournament={tournament} onTournamentChange={setTournament}
            venue={venue} onVenueChange={setVenue}
          />
        )}
        {tab === 'home-team' && (
          <TeamSetupTab title="Home team" team={home} onChange={setHome} />
        )}
        {tab === 'away-team' && (
          <TeamSetupTab title="Away team" team={away} onChange={setAway} />
        )}
        {tab === 'lineup' && (
          <LineupTab
            home={home} away={away}
            battingFirst={battingFirst} onBattingFirstChange={setBattingFirst}
            strikerId={strikerId} onStrikerChange={setStrikerId}
            nonStrikerId={nonStrikerId} onNonStrikerChange={setNonStrikerId}
            bowlerId={bowlerId} onBowlerChange={setBowlerId}
            error={error}
          />
        )}
      </div>

      {/* Footer nav */}
      <div className="flex shrink-0 gap-3 border-t border-pitch-border bg-pitch-surface px-4 py-3 pb-safe">
        {!isFirst ? (
          <button
            type="button"
            onClick={() => setTab(tabOrder[tabIndex - 1]!)}
            className="flex h-12 items-center justify-center rounded-xl border border-pitch-border bg-pitch-raised px-5 text-sm font-semibold text-white/70 transition hover:text-white active:scale-[0.98]"
          >
            ← Back
          </button>
        ) : canCancel && onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="flex h-12 items-center justify-center rounded-xl border border-pitch-border bg-pitch-raised px-5 text-sm font-semibold text-white/70 transition hover:text-white active:scale-[0.98]"
          >
            Cancel
          </button>
        ) : null}

        {!isLast ? (
          <button
            type="button"
            disabled={!canAdvanceFrom(tab)}
            onClick={() => setTab(tabOrder[tabIndex + 1]!)}
            className="flex flex-1 h-12 items-center justify-center gap-2 rounded-xl bg-accent-gold text-sm font-bold text-pitch-bg transition hover:bg-amber-400 active:scale-[0.98] disabled:opacity-40"
          >
            Next →
          </button>
        ) : (
          <button
            type="button"
            disabled={submitting}
            onClick={handleCreate}
            className="flex flex-1 h-12 items-center justify-center gap-2 rounded-xl bg-accent-green text-sm font-bold text-pitch-bg transition hover:bg-accent-green-dim active:scale-[0.98] disabled:opacity-50 shadow-lg shadow-accent-green/20"
          >
            {submitting ? (
              <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
                <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            ) : '🏏 Start Match'}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Wizard tab content ───────────────────────────────────────────────────────

function MatchInfoTab({
  format, onFormatChange, tournament, onTournamentChange, venue, onVenueChange,
}: {
  format: MatchFormat; onFormatChange: (f: MatchFormat) => void;
  tournament: string; onTournamentChange: (v: string) => void;
  venue: string; onVenueChange: (v: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">Match type</label>
        <div className="grid grid-cols-4 gap-2">
          {(['T20', 'T40', 'OD', 'Other'] as MatchFormat[]).map((f) => (
            <button
              key={f} type="button" onClick={() => onFormatChange(f)}
              className={cn(
                'rounded-xl py-3 text-sm font-bold transition active:scale-95',
                format === f
                  ? 'bg-accent-gold text-pitch-bg shadow-md shadow-accent-gold/20'
                  : 'border border-pitch-border bg-pitch-raised text-white/70 hover:border-accent-gold/30 hover:text-white',
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <FormField label="Series / Tournament" hint="optional">
        <Input
          type="text"
          value={tournament}
          onChange={(e) => onTournamentChange(e.target.value)}
          placeholder="Summer T20 League"
          maxLength={120}
        />
      </FormField>

      <FormField label="Ground / Venue" hint="optional">
        <Input
          type="text"
          value={venue}
          onChange={(e) => onVenueChange(e.target.value)}
          placeholder="Parkfield Ground"
          maxLength={120}
        />
      </FormField>
    </div>
  );
}

function TeamSetupTab({
  title, team, onChange,
}: {
  title: string; team: TeamDraft; onChange: (t: TeamDraft) => void;
}) {
  const { profile } = useAuth();
  const [playerName, setPlayerName] = useState('');
  const [clubTeams, setClubTeams] = useState<DbTeam[]>([]);
  const [clubPlayers, setClubPlayers] = useState<DbPlayer[]>([]);
  const [dbLoading, setDbLoading] = useState(false);

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

  const removePlayer = (id: string) => onChange({ ...team, players: team.players.filter((p) => p.id !== id) });
  const canAdvance = team.name.length >= 2 && team.shortName.length >= 2 && team.players.length >= 2;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border-l-2 border-accent-gold bg-accent-gold/5 px-3 py-2 text-xs text-white/60">
        {title}
      </div>

      {/* Team name + short */}
      <div className="flex gap-3">
        <FormField label="Team name" className="flex-1">
          {clubTeams.length > 0 && (
            <select
              value={clubTeams.find((t) => t.name === team.name)?.id ?? ''}
              onChange={(e) => {
                const t = clubTeams.find((x) => x.id === e.target.value);
                if (t) onChange({ ...team, name: t.name, shortName: t.short_name });
              }}
              className="mb-1.5 w-full rounded-xl border border-pitch-border bg-pitch-raised px-3 py-2.5 text-sm text-white focus:border-accent-gold/40 focus:outline-none"
            >
              <option value="">— pick from registry —</option>
              {clubTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
          <Input value={team.name} onChange={(e) => onChange({ ...team, name: e.target.value })} placeholder="Willow First XI" maxLength={120} />
        </FormField>
        <FormField label="Short">
          <Input
            value={team.shortName}
            onChange={(e) => onChange({ ...team, shortName: e.target.value.toUpperCase() })}
            placeholder="WIL" maxLength={6} className="w-20 uppercase tracking-widest text-center font-bold"
          />
        </FormField>
      </div>

      {/* Club registry chips */}
      {dbLoading && <p className="text-[10px] text-white/30 animate-pulse">Loading club registry…</p>}
      {clubPlayers.length > 0 && (
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-white/50">
              Club Registry — tap to add
            </span>
            <span className="text-[10px] text-accent-gold">{selectedIds.size} selected</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {clubPlayers.map((p) => {
              const selected = selectedIds.has(p.id);
              return (
                <button
                  key={p.id} type="button" onClick={() => toggleClubPlayer(p)}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-xs font-semibold transition-all active:scale-95',
                    selected
                      ? 'bg-accent-gold text-pitch-bg shadow-sm shadow-accent-gold/20'
                      : 'border border-pitch-border bg-pitch-raised text-white/60 hover:border-accent-gold/40 hover:text-white',
                  )}
                >
                  {selected && '✓ '}{p.preferred_name ?? p.full_name}
                  {p.is_junior && <span className="ml-1 opacity-60 text-[9px]">J</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Manual add */}
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">
          {clubPlayers.length > 0 ? 'Add visitor / unlisted player' : 'Add players by name'}
        </label>
        <div className="flex gap-2">
          <Input
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addManual(); } }}
            placeholder="Player name…"
            className="flex-1"
          />
          <button
            type="button"
            disabled={!playerName.trim()}
            onClick={addManual}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-pitch-border bg-pitch-raised text-white/70 transition hover:border-accent-gold/40 hover:text-accent-gold disabled:opacity-40"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Selected roster */}
      {team.players.length > 0 && (
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/50">
            Selected ({team.players.length})
          </div>
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-pitch-border bg-pitch-raised p-2">
            {team.players.map((p, i) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-pitch-muted/30 transition">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-white/30 w-4 text-right">{i + 1}</span>
                  <span className="text-white">{p.name}</span>
                </div>
                <button type="button" onClick={() => removePlayer(p.id)} className="text-white/25 transition hover:text-danger p-1">
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!canAdvance && (
        <p className="text-xs text-accent-gold/80">
          {team.players.length < 2
            ? `Add at least 2 players to continue (${team.players.length}/2)`
            : 'Enter team name and short name (min 2 chars each).'}
        </p>
      )}
    </div>
  );
}

function LineupTab({
  home, away, battingFirst, onBattingFirstChange,
  strikerId, onStrikerChange, nonStrikerId, onNonStrikerChange,
  bowlerId, onBowlerChange, error,
}: {
  home: TeamDraft; away: TeamDraft;
  battingFirst: 'home' | 'away'; onBattingFirstChange: (s: 'home' | 'away') => void;
  strikerId: string; onStrikerChange: (id: string) => void;
  nonStrikerId: string; onNonStrikerChange: (id: string) => void;
  bowlerId: string; onBowlerChange: (id: string) => void;
  error: string | null;
}) {
  const battingTeam = battingFirst === 'home' ? home : away;
  const bowlingTeam = battingFirst === 'home' ? away : home;

  return (
    <div className="space-y-5">
      {/* Batting first */}
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">
          Batting first (toss result)
        </label>
        <div className="grid grid-cols-2 gap-2">
          {(['home', 'away'] as const).map((side) => {
            const t = side === 'home' ? home : away;
            return (
              <button
                key={side} type="button" onClick={() => onBattingFirstChange(side)}
                className={cn(
                  'rounded-xl px-3 py-3.5 text-sm font-bold transition active:scale-95',
                  battingFirst === side
                    ? 'bg-accent-gold text-pitch-bg'
                    : 'border border-pitch-border bg-pitch-raised text-white/70 hover:border-accent-gold/30',
                )}
              >
                {t.shortName || (side === 'home' ? 'Home' : 'Away')}
                <div className="mt-0.5 text-[10px] font-normal opacity-70 truncate">{t.name || `${side} team`}</div>
              </button>
            );
          })}
        </div>
      </div>

      <PlayerSelect label="Striker (facing first)" players={battingTeam.players} value={strikerId} exclude={nonStrikerId} onChange={onStrikerChange} />
      <PlayerSelect label="Non-striker" players={battingTeam.players} value={nonStrikerId} exclude={strikerId} onChange={onNonStrikerChange} />
      <PlayerSelect label="Opening bowler" players={bowlingTeam.players} value={bowlerId} onChange={onBowlerChange} />

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          <span>⚠</span>{error}
        </div>
      )}
    </div>
  );
}

// ─── Shared ───────────────────────────────────────────────────────────────────

function PlayerSelect({
  label, players, value, exclude, onChange,
}: {
  label: string; players: Player[]; value: string; exclude?: string; onChange: (id: string) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/50">{label}</label>
      <select
        value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-pitch-border bg-pitch-raised px-3 py-3 text-sm text-white focus:border-accent-gold/40 focus:outline-none transition-colors"
      >
        <option value="">— select player —</option>
        {players.filter((p) => p.id !== exclude).map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
    </div>
  );
}
