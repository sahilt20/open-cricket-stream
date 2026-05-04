import { writeFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Logger } from 'pino';
import type { MatchState } from './match-state.js';
import type { MatchStateStore } from './store.js';

/**
 * Subscribes to the store and writes the current MatchState to disk as JSON.
 *
 * For v0 the overlay HTML page (served by score-engine over HTTP) polls/SSE-reads
 * this JSON to update the DOM. Phase 2 will add a Puppeteer-based PNG renderer
 * that screenshots the HTML page and saves overlay.png — that file is what
 * FFmpeg's `overlay` filter consumes.
 *
 * Debounced so a flurry of rapid edits doesn't thrash the SD card.
 */
export function attachOverlayRenderer(
  store: MatchStateStore,
  outDir: string,
  logger: Logger,
): { close: () => void } {
  mkdirSync(outDir, { recursive: true });
  const statePath = join(outDir, 'state.json');

  let pending: NodeJS.Timeout | null = null;
  let lastWritten: number = 0;
  const DEBOUNCE_MS = 150;

  const flush = async (state: MatchState) => {
    pending = null;
    try {
      await writeFile(statePath, JSON.stringify(state, null, 2), 'utf8');
      lastWritten = Date.now();
    } catch (err) {
      logger.error({ err, statePath }, 'overlay state write failed');
    }
  };

  const onChanged = (state: MatchState) => {
    if (pending) clearTimeout(pending);
    pending = setTimeout(() => void flush(state), DEBOUNCE_MS);
  };

  store.on('state.changed', onChanged);

  // Initial write so the overlay has something to read on startup.
  void flush(store.getState());

  logger.info({ statePath }, 'overlay renderer attached');

  return {
    close() {
      if (pending) clearTimeout(pending);
      store.off('state.changed', onChanged);
      logger.info({ lastWritten }, 'overlay renderer detached');
    },
  };
}
