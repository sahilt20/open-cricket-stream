import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Socket } from 'socket.io-client';
import { getSocket } from '../lib/socket.js';
import type { BallEvent, MatchState } from '../lib/match-state.js';

export type ConnState = 'connecting' | 'connected' | 'disconnected';
export type AckResult = { ok: true } | { ok: false; error: string };

type EngineState = {
  socket: Socket;
  conn: ConnState;
  state: MatchState | null;
  pendingCount: number;
  sendBall: (event: BallEvent) => Promise<AckResult>;
  undo: () => Promise<AckResult>;
  createMatch: (state: MatchState) => Promise<AckResult>;
};

const EngineContext = createContext<EngineState | undefined>(undefined);

export function EngineProvider({ children }: { children: ReactNode }) {
  const socket = useMemo(() => getSocket(), []);
  const [conn, setConn] = useState<ConnState>(socket.connected ? 'connected' : 'connecting');
  const [state, setState] = useState<MatchState | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const onConnect = () => setConn('connected');
    const onDisconnect = () => setConn('disconnected');
    const onSnapshot = (s: MatchState) => setState(s);
    const onChanged = (s: MatchState) => setState(s);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('state.snapshot', onSnapshot);
    socket.on('state.changed', onChanged);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('state.snapshot', onSnapshot);
      socket.off('state.changed', onChanged);
    };
  }, [socket]);

  const send = <T,>(message: string, payload: T): Promise<AckResult> =>
    new Promise((resolve) => {
      setPendingCount((n) => n + 1);
      socket.timeout(8_000).emit(message, payload, (err: unknown, ack: AckResult) => {
        setPendingCount((n) => Math.max(0, n - 1));
        if (err) resolve({ ok: false, error: String(err) });
        else resolve(ack ?? { ok: false, error: 'no ack' });
      });
    });

  const value = useMemo<EngineState>(() => ({
    socket,
    conn,
    state,
    pendingCount,
    sendBall: (event) => send('ball.event', event),
    undo: () => send('match.undo', {}),
    createMatch: (s) => send('match.create', s),
  }), [socket, conn, state, pendingCount]);

  return <EngineContext.Provider value={value}>{children}</EngineContext.Provider>;
}

export function useEngine(): EngineState {
  const ctx = useContext(EngineContext);
  if (!ctx) throw new Error('useEngine must be used inside <EngineProvider>');
  return ctx;
}
