import type { Logger } from 'pino';
import type { OcsSupabaseClient } from '@ocs/db';
import type { BallEvent, MatchState } from './match-state.js';
import type { MatchStateStore } from './store.js';

/**
 * Best-effort mirror of every ball event to Supabase.
 *
 * Design goals:
 *   1. Never block a ball application. The match keeps running even if
 *      Supabase is unreachable.
 *   2. Tolerate offline. Events are buffered in-memory and (TODO) persisted
 *      to a small `pending_sync` SQLite table so a Pi reboot doesn't lose
 *      the queue.
 *   3. Idempotent on retry. We use the BallEvent's UUID as the row primary
 *      key — duplicate inserts are ignored via `onConflict`.
 */
export function attachSupabaseMirror(
  store: MatchStateStore,
  client: OcsSupabaseClient,
  logger: Logger,
): { close: () => Promise<void> } {
  const queue: BallEvent[] = [];
  let draining = false;
  let lastErrorAt = 0;
  let backoffMs = 1_000;
  const MAX_BACKOFF_MS = 60_000;

  const ensureMatchRow = async (state: MatchState): Promise<void> => {
    const { error } = await client
      .from('matches')
      .upsert(
        {
          id: state.matchId,
          home_team_id: state.teams.home.id,
          away_team_id: state.teams.away.id,
          format: state.format,
          status: state.status,
          toss: state.toss ?? null,
          result: state.result ?? null,
          meta: { teams: state.teams },
        },
        { onConflict: 'id' },
      );
    if (error) throw error;
  };

  const drain = async (): Promise<void> => {
    if (draining) return;
    if (queue.length === 0) return;
    draining = true;
    try {
      const matchId = store.getState().matchId;
      // Ensure the parent match row exists before fanning out events.
      await ensureMatchRow(store.getState());

      const batch = queue.splice(0, queue.length);
      const rows = batch.map((e) => ({
        id: e.id,
        match_id: matchId,
        innings_idx: e.inningsIndex,
        over_num: e.over,
        ball_in_over: e.ballInOver,
        is_legal: e.isLegal,
        batter_runs: e.batterRuns,
        extras: e.extras ?? null,
        wicket: e.wicket ?? null,
        striker_id: e.strikerId,
        non_striker_id: e.nonStrikerId,
        bowler_id: e.bowlerId,
        ts: new Date(e.timestamp).toISOString(),
        payload: e as unknown as Record<string, unknown>,
      }));
      const { error } = await client
        .from('ball_events')
        .upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
      if (error) throw error;

      backoffMs = 1_000; // reset on success
      logger.debug({ count: rows.length }, 'mirrored ball events');
    } catch (err) {
      // Re-queue the failed batch and back off.
      logger.warn({ err, queued: queue.length, backoffMs }, 'supabase mirror failed; will retry');
      lastErrorAt = Date.now();
      backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
      setTimeout(() => void drain(), backoffMs);
    } finally {
      draining = false;
    }
  };

  const onApplied = (event: BallEvent) => {
    queue.push(event);
    // If we're not currently in a backoff window, drain immediately.
    if (Date.now() - lastErrorAt > backoffMs) void drain();
  };

  store.on('event.applied', onApplied);
  logger.info('supabase mirror attached');

  return {
    async close() {
      store.off('event.applied', onApplied);
      // Best-effort final flush so an orderly shutdown doesn't lose the tail.
      await drain();
    },
  };
}
