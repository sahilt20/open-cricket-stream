import { EventEmitter } from 'node:events';
import type { BallEvent, MatchState } from './match-state.js';
import { applyBallEvent } from './reducer.js';
import type { EventStore } from './db.js';

export type StoreEvents = {
  'state.changed': [MatchState];
  'event.applied': [BallEvent, MatchState];
  'event.duplicate': [BallEvent];
  'event.undone': [BallEvent, MatchState];
  'match.reset': [MatchState];
};

/**
 * Single source of truth for live match state.
 *
 * Adapters call .apply(event); subscribers (overlay renderer, WS broadcaster,
 * Supabase mirror) listen for 'state.changed'. The store enforces idempotency
 * via the EventStore — duplicate event ids are silently ignored, which is what
 * makes the PWA's offline replay safe.
 *
 * Two non-event mutations are also supported:
 *   - undo()   pops the most recently appended event and re-derives state
 *              from the head of the log, then re-emits 'state.changed'.
 *   - reset()  clears the event log and replaces state with a brand-new
 *              MatchState — used when the scorer starts a fresh match.
 */
export class MatchStateStore extends EventEmitter<StoreEvents> {
  constructor(
    private state: MatchState,
    private initial: MatchState,
    private readonly events: EventStore,
  ) {
    super();
  }

  static fromReplay(initial: MatchState, events: EventStore): MatchStateStore {
    const replayed = events.replay(initial.matchId).reduce(applyBallEvent, initial);
    return new MatchStateStore(replayed, initial, events);
  }

  getState(): MatchState {
    return this.state;
  }

  /**
   * Apply a ball event. Returns the new state, or `null` if the event was a
   * duplicate (already in the event log).
   */
  apply(event: BallEvent): MatchState | null {
    if (this.events.has(event.id)) {
      this.emit('event.duplicate', event);
      return null;
    }

    const next = applyBallEvent(this.state, event);
    this.events.append(this.state.matchId, event);
    this.state = next;
    this.emit('event.applied', event, next);
    this.emit('state.changed', next);
    return next;
  }

  /**
   * Pop the latest event and re-derive state from the head of the log.
   * Returns the new state, or null if there was nothing to undo.
   */
  undo(): MatchState | null {
    const last = this.events.latest(this.state.matchId);
    if (!last) return null;

    this.events.delete(last.id);
    const remaining = this.events.replay(this.state.matchId);
    this.state = remaining.reduce(applyBallEvent, this.initial);

    this.emit('event.undone', last, this.state);
    this.emit('state.changed', this.state);
    return this.state;
  }

  /**
   * Replace state with a brand-new MatchState. Wipes the event log for the
   * previous match so a fresh innings starts at 0/0.
   */
  reset(newInitial: MatchState): MatchState {
    this.events.deleteAllForMatch(this.state.matchId);
    if (newInitial.matchId !== this.state.matchId) {
      this.events.deleteAllForMatch(newInitial.matchId);
    }
    this.initial = newInitial;
    this.state = newInitial;
    this.emit('match.reset', newInitial);
    this.emit('state.changed', newInitial);
    return newInitial;
  }
}
