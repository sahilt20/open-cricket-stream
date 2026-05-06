import { useState, type FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.js';
import { cn } from '../lib/cn.js';

type Tab = 'signin' | 'signup';

export function AuthPage({ defaultTab }: { defaultTab?: Tab }) {
  const location = useLocation();
  const initial: Tab = defaultTab ?? (location.pathname.includes('signup') ? 'signup' : 'signin');
  const [tab, setTab] = useState<Tab>(initial);

  return (
    <div className="flex h-dvh min-h-dvh flex-col bg-pitch-bg">
      {/* Top decoration */}
      <div className="flex shrink-0 flex-col items-center justify-end pb-8 pt-safe"
        style={{ height: '36vh', background: 'radial-gradient(ellipse at 50% 0%, #0f3320 0%, #070e0a 75%)' }}>
        {/* Cricket field arc */}
        <svg className="absolute top-0 left-0 w-full opacity-20" viewBox="0 0 390 200" fill="none" aria-hidden>
          <ellipse cx="195" cy="-10" rx="180" ry="140" stroke="#22c55e" strokeWidth="1.5" />
          <ellipse cx="195" cy="-10" rx="100" ry="80" stroke="#22c55e" strokeWidth="0.75" />
        </svg>
        <p className="relative text-[11px] font-bold uppercase tracking-[0.3em] text-accent-green/60">
          open cricket stream
        </p>
        <h1 className="relative mt-1 text-5xl font-black tracking-tight text-accent-gold">
          OCS
        </h1>
        <p className="relative mt-2 text-xs text-white/30">
          {tab === 'signin' ? 'Score your next match' : 'Start scoring today'}
        </p>
      </div>

      {/* Auth card — bottom sheet style */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-t-3xl bg-pitch-surface">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-white/15" />
        </div>

        {/* Tab switcher */}
        <div className="px-5 pt-4 pb-2">
          <div className="flex rounded-full bg-pitch-raised p-1">
            <TabButton active={tab === 'signin'} onClick={() => setTab('signin')}>Sign in</TabButton>
            <TabButton active={tab === 'signup'} onClick={() => setTab('signup')}>Create account</TabButton>
          </div>
        </div>

        {/* Form area — key trick: React remounts on tab change, triggering slide-up */}
        <div className="flex-1 overflow-y-auto px-5 pb-safe pt-2">
          {tab === 'signin'
            ? <SignInForm key="signin" />
            : <SignUpForm key="signup" onDone={() => setTab('signin')} />}
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex-1 rounded-full py-2.5 text-sm font-semibold transition-all duration-200',
        active ? 'bg-accent-gold text-pitch-bg shadow-sm' : 'text-white/50 hover:text-white/70',
      )}
    >
      {children}
    </button>
  );
}

function SignInForm() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handle} className="animate-slide-up space-y-4 pt-2 pb-6">
      <AuthInput
        label="Email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={setEmail}
        placeholder="you@club.org"
        required
      />
      <AuthInput
        label="Password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={setPassword}
        placeholder="••••••••"
        required
        minLength={6}
      />
      {error && <ErrorPill>{error}</ErrorPill>}
      <AuthSubmit loading={loading}>Sign in</AuthSubmit>
    </form>
  );
}

function SignUpForm({ onDone }: { onDone: () => void }) {
  const { signUp, signIn } = useAuth();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signUp(email, password, displayName);
      try {
        await signIn(email, password);
        navigate('/onboarding', { replace: true });
      } catch {
        onDone(); // show sign-in tab so they can sign in after confirming email
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-up failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handle} className="animate-slide-up space-y-4 pt-2 pb-6">
      <AuthInput
        label="Display name"
        type="text"
        autoComplete="name"
        value={displayName}
        onChange={setDisplayName}
        placeholder="Your name"
        required
        maxLength={60}
      />
      <AuthInput
        label="Email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={setEmail}
        placeholder="you@club.org"
        required
      />
      <AuthInput
        label="Password"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={setPassword}
        placeholder="Min 8 characters"
        required
        minLength={8}
      />
      {error && <ErrorPill>{error}</ErrorPill>}
      <AuthSubmit loading={loading}>Create account</AuthSubmit>
      <p className="text-center text-xs text-white/30">
        One account works for scoring and club admin.
      </p>
    </form>
  );
}

// ─── Auth-specific atoms ──────────────────────────────────────────────────────

function AuthInput({
  label,
  type,
  value,
  onChange,
  ...rest
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  [k: string]: unknown;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold uppercase tracking-wider text-white/50">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-btn border border-pitch-border bg-pitch-raised px-4 py-3.5 text-base text-white placeholder:text-white/25 focus:border-accent-green/60 focus:outline-none focus:ring-2 focus:ring-accent-green/20 transition-colors"
        {...rest}
      />
    </div>
  );
}

function AuthSubmit({ loading, children }: { loading: boolean; children: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="mt-2 flex h-14 w-full items-center justify-center gap-2 rounded-btn bg-accent-green text-base font-bold text-pitch-bg shadow-lg shadow-accent-green/20 transition-all active:scale-[0.98] disabled:opacity-60"
    >
      {loading ? (
        <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
          <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      ) : children}
    </button>
  );
}

function ErrorPill({ children }: { children: string }) {
  return (
    <p className="flex items-center gap-2 rounded-full border border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger">
      <span className="shrink-0 text-base">⚠</span>
      {children}
    </p>
  );
}
