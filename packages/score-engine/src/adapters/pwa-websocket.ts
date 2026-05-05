import { z } from 'zod';
import type { Server, Socket } from 'socket.io';
import type { Logger } from 'pino';
import { BallEventSchema, type MatchState } from '../match-state.js';
import type { MatchStateStore } from '../store.js';

export type AckResult = { ok: true } | { ok: false; error: string };

/**
 * Adapter A — the PWA scoring app talks to the Pi over Socket.IO.
 *
 * Wire protocol:
 *   client → server  'ball.event'      (BallEvent payload, validated by Zod)
 *                    'match.undo'      (no payload — pops the last event)
 *                    'match.create'    (full MatchState — replaces current state)
 *                    'state.fetch'     (no payload — server replies with snapshot)
 *
 *   server → client  'state.snapshot'  full MatchState (sent on connect)
 *                    'state.changed'   full MatchState (broadcast to all clients)
 *                    'event.duplicate' { id }  — informational
 *                    'event.undone'    { id }  — informational
 *
 * The PWA buffers events when offline. Each event has a stable `id`; replaying
 * is safe because the store dedupes by id.
 */

// ─── MatchState validation schema (only the fields we accept on the wire) ──
const PlayerSchema = z.object({ id: z.string(), name: z.string() });
const TeamSchema = z.object({
  id: z.string(),
  name: z.string(),
  shortName: z.string(),
  players: z.array(PlayerSchema),
});

const BattingCardSchema = z.object({
  player: PlayerSchema,
  runs: z.number().int().min(0),
  balls: z.number().int().min(0),
  fours: z.number().int().min(0),
  sixes: z.number().int().min(0),
});

const BowlingCardSchema = z.object({
  player: PlayerSchema,
  ballsBowled: z.number().int().min(0),
  runsConceded: z.number().int().min(0),
  wickets: z.number().int().min(0),
  maidens: z.number().int().min(0),
});

const InningsSchema = z.object({
  battingTeamId: z.string(),
  bowlingTeamId: z.string(),
  totalRuns: z.number().int().min(0),
  wickets: z.number().int().min(0),
  ballsBowled: z.number().int().min(0),
  oversDisplay: z.string(),
  runRate: z.number(),
  requiredRunRate: z.number().optional(),
  target: z.number().optional(),
  currentBatters: z.object({ striker: BattingCardSchema, nonStriker: BattingCardSchema }),
  currentBowler: BowlingCardSchema,
  recentBalls: z.array(z.unknown()).default([]),
});

const MatchStateSchema = z.object({
  version: z.number().int(),
  matchId: z.string().min(1),
  format: z.enum(['T20', 'T40', 'OD', 'Declaration', 'Other']),
  teams: z.object({ home: TeamSchema, away: TeamSchema }),
  toss: z.object({ wonBy: z.string(), chose: z.enum(['bat', 'bowl']) }).optional(),
  innings: z.array(InningsSchema),
  currentInningsIndex: z.number().int().min(0),
  status: z.enum(['pre-match', 'in-progress', 'innings-break', 'rain', 'completed']),
  result: z.string().optional(),
  lastUpdated: z.number().int(),
});

export function attachPwaAdapter(
  io: Server,
  store: MatchStateStore,
  logger: Logger,
): void {
  // Broadcast state changes to every connected client.
  store.on('state.changed', (state) => {
    io.emit('state.changed', state);
  });

  store.on('event.undone', (event) => {
    io.emit('event.undone', { id: event.id });
  });

  store.on('match.reset', (state) => {
    io.emit('match.reset', state);
  });

  io.on('connection', (socket: Socket) => {
    logger.info({ socketId: socket.id, addr: socket.handshake.address }, 'pwa client connected');
    socket.emit('state.snapshot', store.getState());

    socket.on('state.fetch', (_payload: unknown, ack?: (s: unknown) => void) => {
      ack?.(store.getState());
    });

    socket.on('ball.event', (raw: unknown, ack?: (r: AckResult) => void) => {
      const parsed = BallEventSchema.safeParse(raw);
      if (!parsed.success) {
        logger.warn({ err: parsed.error.flatten() }, 'rejected invalid ball event from PWA');
        ack?.({ ok: false, error: parsed.error.message });
        return;
      }
      try {
        store.apply(parsed.data);
        ack?.({ ok: true });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error({ err: msg, eventId: parsed.data.id }, 'reducer rejected event');
        ack?.({ ok: false, error: msg });
      }
    });

    socket.on('match.undo', (_payload: unknown, ack?: (r: AckResult) => void) => {
      const next = store.undo();
      if (!next) {
        ack?.({ ok: false, error: 'no events to undo' });
        return;
      }
      logger.info({ matchId: next.matchId }, 'undo applied');
      ack?.({ ok: true });
    });

    socket.on('match.create', (raw: unknown, ack?: (r: AckResult) => void) => {
      const parsed = MatchStateSchema.safeParse(raw);
      if (!parsed.success) {
        logger.warn({ err: parsed.error.flatten() }, 'rejected invalid match.create payload');
        ack?.({ ok: false, error: parsed.error.message });
        return;
      }
      try {
        const next = store.reset(parsed.data as MatchState);
        logger.info({ matchId: next.matchId, format: next.format }, 'new match created');
        ack?.({ ok: true });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error({ err: msg }, 'match.create failed');
        ack?.({ ok: false, error: msg });
      }
    });

    socket.on('disconnect', (reason) => {
      logger.info({ socketId: socket.id, reason }, 'pwa client disconnected');
    });
  });
}
