import type { Server, Socket } from 'socket.io';
import type { Logger } from 'pino';
import { BallEventSchema } from '../match-state.js';
import type { MatchStateStore } from '../store.js';

export type AckResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Adapter A — the PWA scoring app talks to the Pi over Socket.IO.
 *
 * Wire protocol:
 *   client → server  'ball.event'      (BallEvent payload, validated by Zod)
 *                    'undo'            (no payload — pops the last event)   [TODO]
 *                    'state.fetch'     (no payload — server replies with snapshot)
 *
 *   server → client  'state.snapshot'  full MatchState
 *                    'state.changed'   full MatchState (broadcast to all clients)
 *                    'event.duplicate' { id }  — informational
 *
 * The PWA buffers events when offline. Each event has a stable `id`; replaying
 * is safe because the store dedupes by id.
 */
export function attachPwaAdapter(
  io: Server,
  store: MatchStateStore,
  logger: Logger,
): void {
  // Broadcast state changes to every connected client.
  store.on('state.changed', (state) => {
    io.emit('state.changed', state);
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

    socket.on('disconnect', (reason) => {
      logger.info({ socketId: socket.id, reason }, 'pwa client disconnected');
    });
  });
}
