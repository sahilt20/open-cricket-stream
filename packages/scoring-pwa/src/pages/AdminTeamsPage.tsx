import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, Plus, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.js';
import { listTeams, createTeam, deleteTeam, type Team } from '../lib/api.js';
import { AppShell, ScreenContainer } from '../components/AppShell.js';

export function AdminTeamsPage() {
  const { profile } = useAuth();
  const clubId = profile?.club_id ?? null;

  const [teams, setTeams] = useState<Team[]>([]);
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = async () => {
    if (!clubId) return;
    try { setTeams(await listTeams(clubId)); }
    catch (err) { setLoadError(err instanceof Error ? err.message : 'Failed to load teams'); }
  };

  useEffect(() => { void load(); }, [clubId]);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!clubId) return;
    setError(null); setAdding(true);
    try {
      await createTeam({ clubId, name: name.trim(), shortName: shortName.trim() });
      setName(''); setShortName('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create team');
    } finally { setAdding(false); }
  };

  const handleDelete = async (id: string, teamName: string) => {
    if (!confirm(`Delete "${teamName}"?`)) return;
    try {
      await deleteTeam(id);
      setTeams((ts) => ts.filter((t) => t.id !== id));
    } catch (err) { alert(err instanceof Error ? err.message : 'Failed to delete team'); }
  };

  return (
    <AppShell>
      <ScreenContainer>
        {/* Back + title */}
        <div className="mb-5 flex items-center gap-3">
          <Link
            to="/admin"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-pitch-border text-white/50 transition hover:bg-pitch-raised hover:text-white/80"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white">Teams</h1>
            <p className="text-xs text-white/45">{teams.length} registered</p>
          </div>
        </div>

        {/* Info callout */}
        <div className="mb-5 rounded-xl border-l-2 border-accent-gold/50 bg-accent-gold/5 px-3 py-2.5 text-xs text-white/55">
          Teams pre-fill the name + short name in match setup. Manage players separately in{' '}
          <Link to="/admin/players" className="font-semibold text-accent-gold hover:underline">Players</Link>.
        </div>

        {/* Add form */}
        <form onSubmit={handleAdd} className="mb-6 rounded-2xl border border-pitch-border bg-pitch-surface p-4 space-y-3">
          <h2 className="text-sm font-bold text-white/80">New team</h2>
          <div className="flex gap-2">
            <div className="flex-1 space-y-1.5">
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-white/40">Team name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Willow First XI"
                required minLength={2} maxLength={120}
                className="w-full rounded-xl border border-pitch-border bg-pitch-raised px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:border-accent-gold/40 focus:outline-none transition-colors"
              />
            </div>
            <div className="w-24 space-y-1.5">
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-white/40">Short</label>
              <input
                value={shortName}
                onChange={(e) => setShortName(e.target.value.toUpperCase())}
                placeholder="WIL"
                required minLength={2} maxLength={6}
                className="w-full rounded-xl border border-pitch-border bg-pitch-raised px-3 py-2.5 text-sm font-bold uppercase tracking-widest text-accent-gold placeholder:text-white/25 placeholder:font-normal focus:border-accent-gold/40 focus:outline-none transition-colors"
              />
            </div>
          </div>
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
              <span>⚠</span>{error}
            </div>
          )}
          <button
            type="submit"
            disabled={adding}
            className="flex h-9 items-center gap-1.5 rounded-xl bg-accent-gold px-4 text-sm font-bold text-pitch-bg transition hover:bg-amber-400 active:scale-[0.98] disabled:opacity-50"
          >
            {adding ? (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
                <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            ) : <Plus size={14} />}
            Add team
          </button>
        </form>

        {loadError && (
          <div className="mb-4 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{loadError}</div>
        )}

        {/* Team list */}
        <div className="space-y-2">
          {teams.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-pitch-border py-12 text-center">
              <p className="text-sm text-white/40">No teams yet.</p>
              <p className="mt-1 text-xs text-white/25">Add your first team above.</p>
            </div>
          ) : (
            teams.map((team) => (
              <div
                key={team.id}
                className="flex items-center gap-3 rounded-2xl border border-pitch-border bg-pitch-surface px-4 py-3.5 transition hover:border-pitch-muted"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-gold/10 text-xs font-black uppercase tracking-widest text-accent-gold">
                  {team.short_name}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-white truncate">{team.name}</div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDelete(team.id, team.name)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-white/25 transition hover:bg-danger/10 hover:text-danger"
                  aria-label={`Delete ${team.name}`}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))
          )}
        </div>
      </ScreenContainer>
    </AppShell>
  );
}
