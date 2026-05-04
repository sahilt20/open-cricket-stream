import { useEffect, useState } from 'react';
import { getSocket } from './lib/socket.js';
import { getSupabase } from './lib/supabase.js';
import type { BallEvent, MatchState } from './lib/match-state.js';
import { Scoreboard } from './components/Scoreboard.js';
import { BallEntry } from './components/BallEntry.js';

type ConnState = 'connecting' | 'connected' | 'disconnected';
type AckResult = { ok: true } | { ok: false; error: string };

export function App() {
  const [state, setState] = useState<MatchState | null>(null);
  const [conn, setConn] = useState<ConnState>('connecting');
  const [pendingCount, setPendingCount] = useState(0);
  const supabaseConfigured = Boolean(getSupabase());

  useEffect(() => {
    const socket = getSocket();
    const onConnect = () => setConn('connected');
    const onDisconnect = () => setConn('disconnected');
    const onSnapshot = (s: MatchState) => setState(s);
    const onChanged = (s: MatchState) => setState(s);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('state.snapshot', onSnapshot);
    socket.on('state.changed', onChanged);
    if (socket.connected) setConn('connected');

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('state.snapshot', onSnapshot);
      socket.off('state.changed', onChanged);
    };
  }, []);

  // Outbound: send a ball event with optimistic offline buffering.
  // For v0 we just call the WS; Phase 3 will add a localStorage queue.
  const sendBall = (event: BallEvent) => {
    setPendingCount((n) => n + 1);
    const socket = getSocket();
    socket.emit('ball.event', event, (res: AckResult) => {
      setPendingCount((n) => Math.max(0, n - 1));
      if (!res.ok) {
        // eslint-disable-next-line no-alert
        alert(`Engine rejected event: ${res.error}`);
      }
    });
  };

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col gap-4 p-4">
      <header className="flex items-center justify-between text-xs text-white/60">
        <span className="font-semibold uppercase tracking-widest text-willow-gold">OCS scorer</span>
        <span className="flex items-center gap-2">
          <Dot state={conn} />
          {conn}
          {pendingCount > 0 && <span className="rounded bg-amber-600/40 px-1.5 py-0.5">{pendingCount} pending</span>}
        </span>
      </header>

      {!supabaseConfigured && (
        <div className="rounded border border-amber-700/40 bg-amber-900/20 p-2 text-xs text-amber-200">
          Supabase env not set — running in <strong>live-only</strong> mode (no fixture lookup, no history).
        </div>
      )}

      <Scoreboard state={state} />
      <BallEntry state={state} onSubmit={sendBall} disabled={conn !== 'connected'} />

      <footer className="mt-auto pt-6 text-center text-[10px] uppercase tracking-widest text-white/30">
        open-cricket-stream · v0
      </footer>
    </main>
  );
}

function Dot({ state }: { state: ConnState }) {
  const cls = state === 'connected' ? 'bg-emerald-400' : state === 'connecting' ? 'bg-amber-400' : 'bg-rose-500';
  return <span className={`inline-block h-2 w-2 rounded-full ${cls}`} aria-hidden />;
}
