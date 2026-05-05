import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Users, UserCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.js';
import { getMyClub, type Club } from '../lib/api.js';
import { AppShell, ScreenContainer, PageHeader } from '../components/AppShell.js';

export function AdminPage() {
  const { profile } = useAuth();
  const [club, setClub] = useState<Club | null>(null);

  useEffect(() => {
    if (profile?.club_id) void getMyClub(profile.club_id).then(setClub);
  }, [profile?.club_id]);

  return (
    <AppShell>
      <ScreenContainer>
        <PageHeader
          title={club?.name ?? 'Club Admin'}
          description={club ? `Short name: ${club.short_name}` : 'Loading club…'}
        />
        <div className="space-y-3">
          <NavCard
            to="/admin/teams"
            icon={<Users size={20} />}
            label="Teams"
            description="Manage your club's teams"
          />
          <NavCard
            to="/admin/players"
            icon={<UserCircle2 size={20} />}
            label="Players"
            description="Club player registry — used in match setup"
          />
        </div>
      </ScreenContainer>
    </AppShell>
  );
}

function NavCard({
  to,
  icon,
  label,
  description,
}: {
  to: string;
  icon: ReactNode;
  label: string;
  description: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 transition hover:bg-white/[0.07]"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-willow-green/40 text-willow-gold">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-white">{label}</div>
        <div className="mt-0.5 text-xs text-white/50">{description}</div>
      </div>
      <ChevronRight size={16} className="shrink-0 text-white/30" />
    </Link>
  );
}
