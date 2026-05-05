import { type ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { LogOut, ShieldCheck, Tally5, Users } from 'lucide-react';
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
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-willow-night/80 backdrop-blur">
        <div className="mx-auto flex h-12 max-w-5xl items-center justify-between gap-3 px-4">
          <Link to="/" className="text-xs font-extrabold uppercase tracking-[0.18em] text-willow-gold">
            OCS
          </Link>
          <nav className="flex items-center gap-1">
            {canScore && (
              <NavTab to="/scorer" icon={<Tally5 size={14} />}>Scorer</NavTab>
            )}
            {isAdmin && (
              <NavTab to="/admin" icon={<ShieldCheck size={14} />}>Admin</NavTab>
            )}
          </nav>
          <div className="flex items-center gap-2">
            <ConnectionPill />
            <button
              type="button"
              onClick={async () => {
                await signOut();
                navigate('/auth/signin', { replace: true });
              }}
              title={user?.email ?? ''}
              className="rounded-md p-1.5 text-white/50 hover:bg-white/5 hover:text-white"
              aria-label="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}

function NavTab({ to, icon, children }: { to: string; icon: ReactNode; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors',
          isActive ? 'bg-willow-gold text-willow-night' : 'text-white/70 hover:bg-white/5 hover:text-white',
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
    <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2 py-1 sm:flex">
      <StatusDot tone={tone} />
      <span className="text-[10px] font-semibold uppercase tracking-wider text-white/70">
        {conn === 'connected' ? 'Engine' : conn}
      </span>
      {pendingCount > 0 && (
        <span className="rounded-full bg-amber-500/30 px-1.5 text-[10px] tabular-nums text-amber-100">
          {pendingCount}
        </span>
      )}
    </div>
  );
}

export function ScreenContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto max-w-md p-4 sm:max-w-2xl', className)}>{children}</div>;
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
    <header className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-white">{title}</h1>
        {description && <p className="mt-1 text-sm text-white/60">{description}</p>}
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
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl backdrop-blur">
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-white/60">{description}</p>}
        <div className="mt-5">{children}</div>
        {footer && <div className="mt-6 border-t border-white/10 pt-4 text-center text-sm text-white/60">{footer}</div>}
      </div>
      <p className="mt-6 text-center text-[10px] uppercase tracking-widest text-white/30">
        open-cricket-stream
      </p>
    </div>
  );
}
