import { EventEmitter } from 'node:events';
import type { BallEvent, MatchState } from './match-state.js';
import { applyBallEvent } from './reducer.js';
import type { EventStore } from './db.js';

export type StoreEvents = {
  'state.changed': [MatchState];
  'event.applied': [BallEvent, MatchState];
  'event.duplicate': [BallEvent];
};

/**
 * Single source of truth for live match state.
 *
 * Adapters call .apply(event); subscribers (overlay renderer, WS broadcaster)
 * listen for 'state.changed'. The store enforces idempotency via the EventStore
 * — duplicate event ids are silently ignored, which is what makes the PWA's
 * offline replay safe.
 */
export class MatchStateStore extends EventEmitter<StoreEvents> {
  constructor(
    private state: MatchState,
    private readonly events: EventStore,
  ) {
    super();
  }

  static fromReplay(initial: MatchState, events: EventStore): MatchStateStore {
    const replayed = events.replay(initial.matchId).reduce(applyBallEvent, initial);
    return new MatchStateStore(replayed, events);
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
}
