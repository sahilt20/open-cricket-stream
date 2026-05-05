import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.js';
import { Button } from '../components/Button.js';
import { CenteredCard } from '../components/AppShell.js';
import { FormField, Input } from '../components/Input.js';

export function SignInPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <CenteredCard
      title="Sign in"
      description="Use your scorer or club admin email."
      footer={
        <>
          New to OCS? <Link to="/auth/signup" className="font-semibold text-willow-gold hover:underline">Create an account</Link>
        </>
      }
    >
      <form onSubmit={handle} className="flex flex-col gap-4">
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
        <FormField label="Password">
          <Input
            type="password"
            autoComplete="current-password"
            required
            minLength={6}
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
          Sign in
        </Button>
      </form>
    </CenteredCard>
  );
}
