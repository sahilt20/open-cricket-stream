import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.js';

export function HomePage() {
  const { loading, session, profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!session) { navigate('/auth/signin', { replace: true }); return; }
    if (!profile?.club_id) { navigate('/onboarding', { replace: true }); return; }
    const dest = profile.role === 'club_admin' || profile.role === 'super_admin' ? '/admin' : '/scorer';
    navigate(dest, { replace: true });
  }, [loading, session, profile, navigate]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-pitch-bg">
      <div className="flex flex-col items-center gap-3">
        <span className="text-2xl font-black uppercase tracking-[0.22em] text-accent-gold">OCS</span>
        <div className="h-1 w-16 overflow-hidden rounded-full bg-pitch-raised">
          <div className="h-full w-full origin-left animate-[shimmer_1.2s_ease-in-out_infinite] bg-gradient-to-r from-pitch-raised via-accent-gold/40 to-pitch-raised" />
        </div>
      </div>
    </div>
  );
}
