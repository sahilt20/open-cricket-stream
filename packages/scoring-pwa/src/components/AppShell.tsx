import { type ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { LogOut, ShieldCheck, Tally5 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.js';
import { useEngine } from '../contexts/EngineContext.js';
import { StatusDot } from './StatusDot.js';
import { cn } from '../lib/cn.js';

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, user, signOut } = useAuth();
  const navigate = useNavigate();
  const role = profile?.role ?? 'viewer';
  const isAdmin = role === 'club_admin' || role === 'super_admin';
  const canScore = role !== 'viewer';

  return (
    <div className="flex min-h-dvh flex-col bg-pitch-bg">
      <header className="sticky top-0 z-30 border-b border-pitch-border bg-pitch-surface/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between gap-3 px-4">
          <Link to="/" className="text-sm font-black uppercase tracking-[0.22em] text-accent-gold">
            OCS
          </Link>
          <nav className="flex items-center gap-1">
            {canScore && (
              <NavPill to="/scorer" icon={<Tally5 size={13} />}>Scorer</NavPill>
            )}
            {isAdmin && (
              <NavPill to="/admin" icon={<ShieldCheck size={13} />}>Admin</NavPill>
            )}
          </nav>
          <div className="flex items-center gap-2">
            <ConnectionPill />
            <button
              type="button"
              onClick={async () => { await signOut(); navigate('/auth/signin', { replace: true }); }}
              title={user?.email ?? 'Sign out'}
              className="flex h-8 w-8 items-center justify-center rounded-full text-white/40 transition hover:bg-pitch-raised hover:text-white/70"
              aria-label="Sign out"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}

function NavPill({ to, icon, children }: { to: string; icon: ReactNode; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all',
          isActive
            ? 'bg-accent-green/15 text-accent-green ring-1 ring-accent-green/30'
            : 'text-white/50 hover:bg-pitch-raised hover:text-white/80',
        )
      }
    >
      {icon}
      {children}
    </NavLink>
  );
}

function ConnectionPill() {
  const { conn, pendingCount } = useEngine();
  const tone = conn === 'connected' ? 'green' : conn === 'connecting' ? 'amber' : 'red';
  return (
    <div className="hidden items-center gap-1.5 rounded-full border border-pitch-border bg-pitch-raised px-2.5 py-1 sm:flex">
      <StatusDot tone={tone} />
      <span className="text-[9px] font-bold uppercase tracking-widest text-white/50">
        {conn === 'connected' ? 'Live' : conn}
      </span>
      {pendingCount > 0 && (
        <span className="rounded-full bg-accent-gold/20 px-1.5 text-[9px] tabular-nums text-accent-gold">
          {pendingCount}
        </span>
      )}
    </div>
  );
}

export function ScreenContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto max-w-lg px-4 py-5', className)}>{children}</div>;
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="mb-5 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        {description && <p className="mt-1 text-sm text-white/50">{description}</p>}
      </div>
      {action}
    </header>
  );
}

export function CenteredCard({
  title,
  description,
  children,
  footer,
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-12">
      <div className="rounded-3xl border border-pitch-border bg-pitch-surface p-6 shadow-2xl shadow-black/40">
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-white/50">{description}</p>}
        <div className="mt-5">{children}</div>
        {footer && (
          <div className="mt-6 border-t border-pitch-border pt-4 text-center text-sm text-white/40">
            {footer}
          </div>
        )}
      </div>
      <p className="mt-6 text-center text-[10px] uppercase tracking-widest text-white/20">
        open-cricket-stream
      </p>
    </div>
  );
}
