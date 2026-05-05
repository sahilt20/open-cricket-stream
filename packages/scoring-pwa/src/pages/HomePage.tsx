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
    const dest =
      profile.role === 'club_admin' || profile.role === 'super_admin' ? '/admin' : '/scorer';
    navigate(dest, { replace: true });
  }, [loading, session, profile, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center text-white/60">
      <div className="animate-pulse">Loading…</div>
    </div>
  );
}
