import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Pencil, Trash2, Check, X, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.js';
import { listPlayers, createPlayer, updatePlayer, deletePlayer, type Player } from '../lib/api.js';
import { AppShell, ScreenContainer } from '../components/AppShell.js';
import { cn } from '../lib/cn.js';

export function AdminPlayersPage() {
  const { profile } = useAuth();
  const clubId = profile?.club_id ?? null;

  const [players, setPlayers] = useState<Player[]>([]);
  const [fullName, setFullName] = useState('');
  const [preferredName, setPreferredName] = useState('');
  const [isJunior, setIsJunior] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPref, setEditPref] = useState('');
  const [editJunior, setEditJunior] = useState(false);

  const load = async () => {
    if (!clubId) return;
    setPlayers(await listPlayers(clubId));
  };

  useEffect(() => { void load(); }, [clubId]);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!clubId) return;
    setAddError(null); setAdding(true);
    try {
      await createPlayer({ clubId, fullName: fullName.trim(), preferredName: preferredName.trim() || undefined, isJunior });
      setFullName(''); setPreferredName(''); setIsJunior(false);
      await load();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add player');
    } finally { setAdding(false); }
  };

  const startEdit = (p: Player) => {
    setEditingId(p.id); setEditName(p.full_name);
    setEditPref(p.preferred_name ?? ''); setEditJunior(p.is_junior ?? false);
  };

  const saveEdit = async (id: string) => {
    try {
      await updatePlayer(id, { fullName: editName.trim(), preferredName: editPref.trim() || null, isJunior: editJunior });
      setEditingId(null); await load();
    } catch (err) { alert(err instanceof Error ? err.message : 'Failed to update player'); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remove "${name}"?`)) return;
    try { await deletePlayer(id); setPlayers((ps) => ps.filter((p) => p.id !== id)); }
    catch (err) { alert(err instanceof Error ? err.message : 'Failed to delete player'); }
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
            <h1 className="text-xl font-bold text-white">Players</h1>
            <p className="text-xs text-white/45">{players.length} in club registry</p>
          </div>
        </div>

        {/* Info callout */}
        <div className="mb-5 rounded-xl border-l-2 border-accent-green/50 bg-accent-green/5 px-3 py-2.5 text-xs text-white/55">
          Players in the registry appear as gold chips in match setup for quick selection. Visiting team players can be added inline during setup.
        </div>

        {/* Add form */}
        <form onSubmit={handleAdd} className="mb-6 rounded-2xl border border-pitch-border bg-pitch-surface p-4 space-y-3">
          <h2 className="text-sm font-bold text-white/80">Add player</h2>
          <div className="flex gap-2">
            <div className="flex-1 space-y-1.5">
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-white/40">Full name</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Sahil Tanwar"
                required maxLength={120}
                className="w-full rounded-xl border border-pitch-border bg-pitch-raised px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:border-accent-green/40 focus:outline-none transition-colors"
              />
            </div>
            <div className="w-28 space-y-1.5">
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-white/40">Preferred</label>
              <input
                value={preferredName}
                onChange={(e) => setPreferredName(e.target.value)}
                placeholder="Sahil"
                maxLength={60}
                className="w-full rounded-xl border border-pitch-border bg-pitch-raised px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:border-accent-green/40 focus:outline-none transition-colors"
              />
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-white/60 select-none">
            <input
              type="checkbox"
              checked={isJunior}
              onChange={(e) => setIsJunior(e.target.checked)}
              className="h-4 w-4 rounded accent-accent-gold"
            />
            Junior player
          </label>
          {addError && (
            <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
              <span>⚠</span>{addError}
            </div>
          )}
          <button
            type="submit"
            disabled={adding}
            className="flex h-9 items-center gap-1.5 rounded-xl bg-accent-green px-4 text-sm font-bold text-pitch-bg transition hover:bg-accent-green-dim active:scale-[0.98] disabled:opacity-50"
          >
            {adding ? (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
                <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            ) : <Plus size={14} />}
            Add player
          </button>
        </form>

        {/* Player list */}
        <div className="space-y-2">
          {players.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-pitch-border py-12 text-center">
              <p className="text-sm text-white/40">No players yet.</p>
              <p className="mt-1 text-xs text-white/25">Add your first player above.</p>
            </div>
          ) : (
            players.map((p) =>
              editingId === p.id ? (
                <div key={p.id} className="rounded-2xl border border-accent-gold/30 bg-accent-gold/5 p-3 space-y-2.5">
                  <div className="flex gap-2">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Full name"
                      className="flex-1 rounded-xl border border-pitch-border bg-pitch-raised px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-accent-gold/40 focus:outline-none"
                    />
                    <input
                      value={editPref}
                      onChange={(e) => setEditPref(e.target.value)}
                      placeholder="Preferred"
                      className="w-28 rounded-xl border border-pitch-border bg-pitch-raised px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-accent-gold/40 focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-white/60 select-none">
                      <input
                        type="checkbox"
                        checked={editJunior}
                        onChange={(e) => setEditJunior(e.target.checked)}
                        className="h-3.5 w-3.5 rounded accent-accent-gold"
                      />
                      Junior
                    </label>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => void saveEdit(p.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-green/20 text-accent-green transition hover:bg-accent-green/30"
                      >
                        <Check size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 transition hover:bg-pitch-raised hover:text-white/70"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-2xl border border-pitch-border bg-pitch-surface px-4 py-3.5 transition hover:border-pitch-muted"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-pitch-raised text-sm font-bold text-white/50">
                    {(p.preferred_name ?? p.full_name).charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white truncate">{p.full_name}</span>
                      {p.preferred_name && (
                        <span className="shrink-0 text-[10px] text-white/40">({p.preferred_name})</span>
                      )}
                    </div>
                    {p.is_junior && (
                      <span className={cn(
                        'mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider',
                        'bg-sky-500/15 text-sky-300',
                      )}>
                        Junior
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(p)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-white/25 transition hover:bg-pitch-raised hover:text-white/70"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(p.id, p.full_name)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-white/25 transition hover:bg-danger/10 hover:text-danger"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )
            )
          )}
        </div>
      </ScreenContainer>
    </AppShell>
  );
}
