import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.js';
import { claimClub } from '../lib/api.js';
import { Button } from '../components/Button.js';
import { CenteredCard } from '../components/AppShell.js';
import { FormField, Input } from '../components/Input.js';

export function OnboardingPage() {
  const { profile, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If the profile already has a club, send them to the right place.
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
    <CenteredCard
      title="Set up your club"
      description="Create a club to host fixtures, teams, and scorers. You'll be the first club admin."
      footer={
        <button onClick={() => signOut().then(() => navigate('/auth/signin'))} className="text-white/50 hover:text-white">
          Sign out
        </button>
      }
    >
      <form onSubmit={handle} className="flex flex-col gap-4">
        <FormField label="Club name" hint="Full official name">
          <Input
            type="text"
            required
            minLength={2}
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Willow Cricket Club"
          />
        </FormField>
        <FormField label="Short name" hint="2–6 chars, used on the overlay">
          <Input
            type="text"
            required
            minLength={2}
            maxLength={6}
            value={shortName}
            onChange={(e) => setShortName(e.target.value.toUpperCase())}
            placeholder="WIL"
            className="uppercase tracking-widest"
          />
        </FormField>
        {error && (
          <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error}
          </div>
        )}
        <Button type="submit" size="lg" loading={submitting}>
          Create club
        </Button>
      </form>
    </CenteredCard>
  );
}
