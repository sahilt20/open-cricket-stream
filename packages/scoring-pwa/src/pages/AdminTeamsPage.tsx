import { useEffect, useState, type FormEvent } from 'react';
import { Trash2, Plus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.js';
import { listTeams, createTeam, deleteTeam, type Team } from '../lib/api.js';
import { AppShell, ScreenContainer, PageHeader } from '../components/AppShell.js';
import { Button } from '../components/Button.js';
import { FormField, Input } from '../components/Input.js';

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
    try {
      setTeams(await listTeams(clubId));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load teams');
    }
  };

  useEffect(() => { void load(); }, [clubId]);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!clubId) return;
    setError(null);
    setAdding(true);
    try {
      await createTeam({ clubId, name: name.trim(), shortName: shortName.trim() });
      setName('');
      setShortName('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create team');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string, teamName: string) => {
    if (!confirm(`Delete "${teamName}"? This cannot be undone.`)) return;
    try {
      await deleteTeam(id);
      setTeams((ts) => ts.filter((t) => t.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete team');
    }
  };

  return (
    <AppShell>
      <ScreenContainer>
        <PageHeader title="Teams" description="Teams registered under your club" />

        <form onSubmit={handleAdd} className="mb-6 space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <h2 className="text-sm font-semibold text-white/80">New team</h2>
          <div className="flex gap-2">
            <FormField label="Team name" className="flex-1">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Willow First XI"
                required
                minLength={2}
                maxLength={120}
              />
            </FormField>
            <FormField label="Short">
              <Input
                value={shortName}
                onChange={(e) => setShortName(e.target.value.toUpperCase())}
                placeholder="WIL"
                required
                minLength={2}
                maxLength={6}
                className="w-20 uppercase tracking-widest"
              />
            </FormField>
          </div>
          {error && <p className="text-xs text-rose-400">{error}</p>}
          <Button type="submit" size="sm" loading={adding} icon={<Plus size={14} />}>
            Add team
          </Button>
        </form>

        {loadError && (
          <p className="mb-4 text-sm text-rose-400">{loadError}</p>
        )}

        <div className="space-y-2">
          {teams.length === 0 ? (
            <p className="py-8 text-center text-sm text-white/40">
              No teams yet. Add your first team above.
            </p>
          ) : (
            teams.map((team) => (
              <div
                key={team.id}
                className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3"
              >
                <div>
                  <div className="font-medium text-white">{team.name}</div>
                  <div className="mt-0.5 text-xs font-semibold uppercase tracking-widest text-white/40">
                    {team.short_name}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDelete(team.id, team.name)}
                  className="rounded p-2 text-white/30 transition hover:bg-rose-500/10 hover:text-rose-400"
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
