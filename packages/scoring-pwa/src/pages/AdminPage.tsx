import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Users, UserCircle2, Tally5, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.js';
import { getMyClub, type Club } from '../lib/api.js';
import { AppShell, ScreenContainer } from '../components/AppShell.js';
import { useNavigate } from 'react-router-dom';

export function AdminPage() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [club, setClub] = useState<Club | null>(null);

  useEffect(() => {
    if (profile?.club_id) void getMyClub(profile.club_id).then(setClub);
  }, [profile?.club_id]);

  return (
    <AppShell>
      <ScreenContainer>
        {/* Club header */}
        <div className="mb-6 rounded-2xl border border-pitch-border bg-pitch-surface p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-accent-gold/70">Club Admin</div>
              <h1 className="mt-1 text-2xl font-bold text-white">{club?.name ?? 'Loading…'}</h1>
              {club && (
                <span className="mt-1 inline-block rounded-full border border-accent-gold/30 bg-accent-gold/10 px-2.5 py-0.5 text-xs font-bold uppercase tracking-widest text-accent-gold">
                  {club.short_name}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => void signOut().then(() => navigate('/auth/signin', { replace: true }))}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-white/30 transition hover:bg-pitch-raised hover:text-white/70"
              aria-label="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>

        {/* How-it-works callout */}
        <div className="mb-5 rounded-xl border-l-2 border-accent-green bg-accent-green/5 px-4 py-3 text-sm text-white/60">
          <p className="font-semibold text-white/80">Getting started</p>
          <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs marker:text-accent-gold">
            <li>Add your <strong className="text-white/80">Teams</strong> — give each a short name for the overlay.</li>
            <li>Add <strong className="text-white/80">Players</strong> to the club registry — they load as tap-chips in match setup.</li>
            <li>Go to <strong className="text-white/80">Scorer</strong> → New Match to start scoring live.</li>
          </ol>
        </div>

        <div className="space-y-2.5">
          <NavCard
            to="/admin/teams"
            icon={<Users size={20} />}
            label="Teams"
            description="Add and manage your club's registered teams"
            accent="green"
          />
          <NavCard
            to="/admin/players"
            icon={<UserCircle2 size={20} />}
            label="Players"
            description="Club player registry — tap to select in match setup"
            accent="gold"
          />
          <NavCard
            to="/scorer"
            icon={<Tally5 size={20} />}
            label="Scorer"
            description="Score a live match"
            accent="blue"
          />
        </div>
      </ScreenContainer>
    </AppShell>
  );
}

function NavCard({
  to, icon, label, description, accent,
}: {
  to: string; icon: ReactNode; label: string; description: string;
  accent: 'green' | 'gold' | 'blue';
}) {
  const iconBg = accent === 'green' ? 'bg-accent-green/15 text-accent-green'
    : accent === 'gold' ? 'bg-accent-gold/15 text-accent-gold'
    : 'bg-sky-500/15 text-sky-400';

  return (
    <Link
      to={to}
      className="flex items-center gap-4 rounded-2xl border border-pitch-border bg-pitch-surface px-4 py-4 transition hover:border-pitch-muted hover:bg-pitch-raised active:scale-[0.99]"
    >
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-white">{label}</div>
        <div className="mt-0.5 text-xs text-white/45">{description}</div>
      </div>
      <ChevronRight size={16} className="shrink-0 text-white/25" />
    </Link>
  );
}
