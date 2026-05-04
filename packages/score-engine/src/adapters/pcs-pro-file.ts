import chokidar from 'chokidar';
import { readFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Logger } from 'pino';
import type { BallEvent } from '../match-state.js';
import type { MatchStateStore } from '../store.js';

/**
 * Adapter B — Play-Cricket Scorer Pro (PCS Pro) writes a JSON file to a
 * Samba share on the Pi after every ball. We watch the share, parse the
 * file, diff it against our last-seen state, and emit BallEvents that
 * reproduce the change.
 *
 * The file we watch is configurable but defaults to `current.json`. The
 * shape is determined by the PCS Pro custom-template file we ship in
 * `pcs-pro/willow-overlay.template`.
 *
 * IMPORTANT: PCS Pro writes a *snapshot*, not an event stream. So this
 * adapter's job is to detect what changed and synthesise the corresponding
 * BallEvent(s). For v0 we keep that mapping minimal — see the TODOs.
 */

export type PcsProSnapshot = {
  // Fields below are placeholder names — the actual field set comes from the
  // template we configure in PCS Pro. See pcs-pro/README.md for the contract.
  matchId?: string;
  inningsIndex: number;
  totalRuns: number;
  wickets: number;
  ballsBowled: number;
  // Last delivery — used by the diff to synthesise a BallEvent
  lastBall?: {
    over: number;
    ballInOver: number;
    isLegal: boolean;
    batterRuns: number;
    extrasKind?: 'wide' | 'noBall' | 'bye' | 'legBye';
    extrasRuns?: number;
    wicketType?: string;
    strikerId: string;
    nonStrikerId: string;
    bowlerId: string;
    outBatterId?: string;
  };
};

export type PcsProAdapterOptions = {
  watchDir: string;
  filename?: string;
};

export function attachPcsProAdapter(
  store: MatchStateStore,
  options: PcsProAdapterOptions,
  logger: Logger,
): { close: () => Promise<void> } {
  const filename = options.filename ?? 'current.json';
  mkdirSync(options.watchDir, { recursive: true });
  const target = join(options.watchDir, filename);

  logger.info({ target }, 'pcs-pro adapter watching for changes');

  // We track the last-seen ball signature so duplicate writes don't double-apply.
  let lastSignature: string | null = null;

  const watcher = chokidar.watch(target, {
    awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 25 },
    ignoreInitial: false,
  });

  const onChange = async (path: string) => {
    try {
      const raw = await readFile(path, 'utf8');
      if (!raw.trim()) return;
      const snapshot = JSON.parse(raw) as PcsProSnapshot;
      if (!snapshot.lastBall) return;

      const signature = signatureOf(snapshot.lastBall);
      if (signature === lastSignature) return; // PCS Pro re-wrote the same ball
      lastSignature = signature;

      const event = mapSnapshotToEvent(snapshot);
      store.apply(event);
      logger.info({ eventId: event.id, runs: event.batterRuns }, 'pcs-pro event applied');
    } catch (err) {
      logger.error({ err, path }, 'pcs-pro snapshot parse failed');
    }
  };

  watcher.on('add', onChange);
  watcher.on('change', onChange);
  watcher.on('error', (err) => logger.error({ err }, 'pcs-pro watcher error'));

  return {
    async close() {
      await watcher.close();
    },
  };
}

function signatureOf(ball: NonNullable<PcsProSnapshot['lastBall']>): string {
  return `${ball.over}.${ball.ballInOver}|${ball.batterRuns}|${ball.extrasKind ?? ''}|${ball.wicketType ?? ''}`;
}

function mapSnapshotToEvent(snapshot: PcsProSnapshot): BallEvent {
  const lb = snapshot.lastBall!;
  return {
    id: randomUUID(),
    inningsIndex: snapshot.inningsIndex,
    over: lb.over,
    ballInOver: lb.ballInOver,
    isLegal: lb.isLegal,
    batterRuns: lb.batterRuns,
    extras:
      lb.extrasKind && lb.extrasRuns !== undefined
        ? { kind: lb.extrasKind, runs: lb.extrasRuns }
        : undefined,
    wicket:
      lb.wicketType && lb.outBatterId
        ? {
            // TODO: map PCS Pro wicket-type strings to our union exactly
            type: 'other',
            outBatterId: lb.outBatterId,
            description: lb.wicketType,
          }
        : undefined,
    strikerId: lb.strikerId,
    nonStrikerId: lb.nonStrikerId,
    bowlerId: lb.bowlerId,
    timestamp: Date.now(),
  };
}
