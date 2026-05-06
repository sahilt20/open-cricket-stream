import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.js';
import { claimClub } from '../lib/api.js';

export function OnboardingPage() {
  const { profile, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (profile?.club_id) {
    navigate(profile.role === 'viewer' ? '/' : '/scorer', { replace: true });
    return null;
  }

  const handle = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await claimClub(name.trim(), shortName.trim());
      await refreshProfile();
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create club');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-pitch-bg">
      {/* Decorative top */}
      <div
        className="relative flex shrink-0 flex-col items-center justify-end pb-8 pt-safe"
        style={{ height: '30vh', background: 'radial-gradient(ellipse at 50% 0%, #0f3320 0%, #070e0a 80%)' }}
      >
        <svg className="absolute top-0 left-0 w-full opacity-15" viewBox="0 0 390 160" fill="none" aria-hidden>
          <ellipse cx="195" cy="-10" rx="180" ry="120" stroke="#22c55e" strokeWidth="1.5" />
          <ellipse cx="195" cy="-10" rx="90" ry="65" stroke="#22c55e" strokeWidth="0.75" />
        </svg>
        <p className="relative text-[10px] font-bold uppercase tracking-[0.3em] text-accent-green/60">open cricket stream</p>
        <h1 className="relative mt-1 text-4xl font-black tracking-tight text-accent-gold">OCS</h1>
      </div>

      {/* Card */}
      <div className="flex flex-1 flex-col rounded-t-3xl bg-pitch-surface px-5 pt-6 pb-safe">
        <div className="mb-1 h-1 w-10 self-center rounded-full bg-white/15" />
        <div className="mx-auto mt-6 w-full max-w-sm">
          <h2 className="text-2xl font-bold text-white">Set up your club</h2>
          <p className="mt-1.5 text-sm text-white/50">
            Create a club to manage teams, players, and live scoring. You'll be the first club admin.
          </p>

          <form onSubmit={handle} className="mt-6 flex flex-col gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-white/50">Club name</label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Willow Cricket Club"
                className="w-full rounded-xl border border-pitch-border bg-pitch-raised px-4 py-3.5 text-base text-white placeholder:text-white/25 focus:border-accent-green/60 focus:outline-none focus:ring-2 focus:ring-accent-green/20 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-white/50">
                Short name <span className="text-[10px] font-normal text-white/30">(2–6 chars, shown on overlay)</span>
              </label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={6}
                value={shortName}
                onChange={(e) => setShortName(e.target.value.toUpperCase())}
                placeholder="WIL"
                className="w-full rounded-xl border border-pitch-border bg-pitch-raised px-4 py-3.5 text-base font-bold uppercase tracking-widest text-accent-gold placeholder:text-white/25 placeholder:font-normal placeholder:tracking-normal focus:border-accent-gold/60 focus:outline-none focus:ring-2 focus:ring-accent-gold/20 transition-colors"
              />
              {shortName && (
                <p className="text-[10px] text-white/40">
                  Preview: <span className="font-black tracking-widest text-accent-gold">{shortName}</span>
                </p>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
                <span className="shrink-0">⚠</span>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-accent-green text-base font-bold text-pitch-bg shadow-lg shadow-accent-green/20 transition-all active:scale-[0.98] disabled:opacity-60"
            >
              {submitting ? (
                <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
                  <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              ) : 'Create Club'}
            </button>
          </form>

          <div className="mt-6 border-t border-pitch-border pt-4 text-center">
            <button
              type="button"
              onClick={() => void signOut().then(() => navigate('/auth/signin'))}
              className="text-sm text-white/40 transition hover:text-white/70"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
