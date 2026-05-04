import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import pino from 'pino';
import { createInitialState, type Team } from './match-state.js';
import { EventStore } from './db.js';
import { MatchStateStore } from './store.js';
import { attachPwaAdapter } from './adapters/pwa-websocket.js';
import { attachPcsProAdapter } from './adapters/pcs-pro-file.js';
import { attachOverlayRenderer } from './overlay-renderer.js';
import { attachSupabaseMirror } from './supabase-mirror.js';
import { emptyBatting, emptyBowling } from './reducer.js';
import { createServiceClient } from '@ocs/db';

const config = {
  port: Number(process.env.PORT ?? 8080),
  dbPath: process.env.DB_PATH ?? './var/match.sqlite',
  pcsProWatchDir: process.env.PCS_PRO_WATCH_DIR ?? './var/score-in',
  overlayOutDir: process.env.OVERLAY_OUT_DIR ?? './var/overlay-out',
  corsOrigin: (process.env.CORS_ORIGIN ?? '*').split(',').map((s) => s.trim()),
  logLevel: process.env.LOG_LEVEL ?? 'info',
  supabase: {
    url: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },
};

const logger = pino({
  level: config.logLevel,
  transport: process.stdout.isTTY
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
});

// ─── Bootstrap a minimal demo match so the engine is useful out of the box. ──
// In production the match would be created by the operator dashboard before kick-off.
const demoHome: Team = {
  id: 'home',
  name: 'Willow CC',
  shortName: 'WIL',
  players: Array.from({ length: 11 }, (_, i) => ({ id: `wil-${i + 1}`, name: `Willow ${i + 1}` })),
};
const demoAway: Team = {
  id: 'away',
  name: 'Visitors',
  shortName: 'VIS',
  players: Array.from({ length: 11 }, (_, i) => ({ id: `vis-${i + 1}`, name: `Visitor ${i + 1}` })),
};
const initial = createInitialState({
  matchId: process.env.MATCH_ID ?? randomUUID(),
  format: 'T20',
  home: demoHome,
  away: demoAway,
});
// Open the first innings ready for ball events.
initial.innings.push({
  battingTeamId: demoHome.id,
  bowlingTeamId: demoAway.id,
  totalRuns: 0,
  wickets: 0,
  ballsBowled: 0,
  oversDisplay: '0.0',
  runRate: 0,
  currentBatters: { striker: emptyBatting(demoHome.players[0]!), nonStriker: emptyBatting(demoHome.players[1]!) },
  currentBowler: emptyBowling(demoAway.players[0]!),
  recentBalls: [],
});

const events = new EventStore(config.dbPath);
const store = MatchStateStore.fromReplay(initial, events);

// ─── HTTP + WebSocket server ────────────────────────────────────────────────
const app = express();
app.use(express.json());

app.get('/healthz', (_req, res) => {
  res.json({ ok: true, matchId: store.getState().matchId, lastUpdated: store.getState().lastUpdated });
});

app.get('/api/state', (_req, res) => {
  res.json(store.getState());
});

// Serve the bundled overlay templates so the operator can preview them in a
// browser tab and FFmpeg/Puppeteer can drive the same URL.
const here = path.dirname(fileURLToPath(import.meta.url));
const overlayDir = path.resolve(here, '../../overlay-templates');
app.use('/overlay', express.static(overlayDir));

const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: config.corsOrigin },
});

// ─── Adapters ───────────────────────────────────────────────────────────────
attachPwaAdapter(io, store, logger.child({ adapter: 'pwa-ws' }));
const pcsPro = attachPcsProAdapter(
  store,
  { watchDir: config.pcsProWatchDir },
  logger.child({ adapter: 'pcs-pro-file' }),
);
const overlay = attachOverlayRenderer(store, config.overlayOutDir, logger.child({ component: 'overlay' }));

// Supabase mirror is optional — if env isn't configured, the rig runs SQLite-only.
const supabase = createServiceClient(config.supabase);
const mirror = supabase
  ? attachSupabaseMirror(store, supabase, logger.child({ component: 'supabase-mirror' }))
  : null;
if (!supabase) {
  logger.warn('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — running without cloud mirror');
}

server.listen(config.port, () => {
  logger.info({ port: config.port }, 'score-engine listening');
});

// ─── Graceful shutdown ──────────────────────────────────────────────────────
const shutdown = async (signal: string) => {
  logger.info({ signal }, 'shutdown initiated');
  overlay.close();
  await pcsPro.close();
  if (mirror) await mirror.close();
  io.close();
  server.close();
  events.close();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
