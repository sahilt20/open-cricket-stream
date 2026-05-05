import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.js';
import { Button } from '../components/Button.js';
import { CenteredCard } from '../components/AppShell.js';
import { FormField, Input } from '../components/Input.js';

export function SignUpPage() {
  const { signUp, signIn } = useAuth();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signUp(email, password, displayName);
      // If email confirmation is disabled (dev), the user is auto-signed-in;
      // otherwise this throws — tell them to check their email.
      try {
        await signIn(email, password);
        navigate('/onboarding', { replace: true });
      } catch {
        navigate('/auth/signin', {
          replace: true,
          state: { notice: 'Check your email to confirm — then sign in.' },
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-up failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <CenteredCard
      title="Create account"
      description="One account works for scoring and admin."
      footer={
        <>
          Already have an account? <Link to="/auth/signin" className="font-semibold text-willow-gold hover:underline">Sign in</Link>
        </>
      }
    >
      <form onSubmit={handle} className="flex flex-col gap-4">
        <FormField label="Display name" hint="Shown on the scoreboard">
          <Input
            type="text"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Sahil Tanwar"
            maxLength={60}
          />
        </FormField>
        <FormField label="Email">
          <Input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@willowcc.org"
          />
        </FormField>
        <FormField label="Password" hint="Min 8 characters">
          <Input
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </FormField>
        {error && (
          <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error}
          </div>
        )}
        <Button type="submit" size="lg" loading={submitting}>
          Create account
        </Button>
      </form>
    </CenteredCard>
  );
}
