import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.js';
import type { ReactNode } from 'react';

type Role = 'viewer' | 'scorer' | 'club_admin' | 'super_admin';

interface ProtectedRouteProps {
  children: ReactNode;
  /** Min role required. Hierarchy: viewer < scorer < club_admin < super_admin. */
  minRole?: Role;
  /** If true, requires a club to be attached to the profile. Used by /admin and /scorer. */
  requireClub?: boolean;
}

const RANK: Record<Role, number> = {
  viewer: 0,
  scorer: 1,
  club_admin: 2,
  super_admin: 3,
};

export function ProtectedRoute({ children, minRole, requireClub }: ProtectedRouteProps) {
  const { loading, session, profile, supabaseConfigured } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-white/60">
        <div className="animate-pulse">Loading…</div>
      </div>
    );
  }

  if (!supabaseConfigured) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
        <h1 className="text-xl font-bold text-white">Supabase not configured</h1>
        <p className="mt-2 text-sm text-white/60">
          Set <code className="rounded bg-white/10 px-1.5 py-0.5">VITE_SUPABASE_URL</code> and{' '}
          <code className="rounded bg-white/10 px-1.5 py-0.5">VITE_SUPABASE_ANON_KEY</code>, then rebuild the PWA image.
        </p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth/signin" state={{ from: location.pathname }} replace />;
  }

  if (requireClub && !profile?.club_id) {
    return <Navigate to="/onboarding" replace />;
  }

  if (minRole) {
    const userRank = profile ? RANK[profile.role] : 0;
    if (userRank < RANK[minRole]) {
      return (
        <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
          <h1 className="text-xl font-bold text-white">Not enough access</h1>
          <p className="mt-2 text-sm text-white/60">
            This page needs the <strong>{minRole}</strong> role; you're a <strong>{profile?.role ?? 'viewer'}</strong>.
            Ask your club admin to grant you access.
          </p>
        </div>
      );
    }
  }

  return <>{children}</>;
}
