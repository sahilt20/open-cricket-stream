import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { BallEvent } from './match-state.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS events (
  id           TEXT PRIMARY KEY,
  match_id     TEXT NOT NULL,
  innings_idx  INTEGER NOT NULL,
  over_num     INTEGER NOT NULL,
  ball_in_over INTEGER NOT NULL,
  ts           INTEGER NOT NULL,
  payload      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_match_ts ON events (match_id, ts);

CREATE TABLE IF NOT EXISTS matches (
  id           TEXT PRIMARY KEY,
  format       TEXT NOT NULL,
  created_at   INTEGER NOT NULL,
  meta         TEXT NOT NULL
);
`;

/**
 * Append-only event log + match metadata.
 *
 * Why better-sqlite3: synchronous API (no Promise overhead per event), excellent
 * write throughput on the Pi's SD card, and a single-file DB that's trivial to
 * back up after a match. All adapters write through here so the audit trail
 * is always complete regardless of source.
 */
export class EventStore {
  private readonly db: Database.Database;
  private readonly insertStmt: Database.Statement;
  private readonly hasStmt: Database.Statement;
  private readonly listForMatchStmt: Database.Statement;

  constructor(dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.exec(SCHEMA);

    this.insertStmt = this.db.prepare(
      `INSERT OR IGNORE INTO events (id, match_id, innings_idx, over_num, ball_in_over, ts, payload)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    this.hasStmt = this.db.prepare('SELECT 1 FROM events WHERE id = ?');
    this.listForMatchStmt = this.db.prepare(
      'SELECT payload FROM events WHERE match_id = ? ORDER BY ts ASC',
    );
  }

  /** Returns true if the event was new and appended, false if already present. */
  append(matchId: string, event: BallEvent): boolean {
    const result = this.insertStmt.run(
      event.id,
      matchId,
      event.inningsIndex,
      event.over,
      event.ballInOver,
      event.timestamp,
      JSON.stringify(event),
    );
    return result.changes > 0;
  }

  has(eventId: string): boolean {
    return this.hasStmt.get(eventId) !== undefined;
  }

  replay(matchId: string): BallEvent[] {
    const rows = this.listForMatchStmt.all(matchId) as { payload: string }[];
    return rows.map((r) => JSON.parse(r.payload) as BallEvent);
  }

  close(): void {
    this.db.close();
  }
}
