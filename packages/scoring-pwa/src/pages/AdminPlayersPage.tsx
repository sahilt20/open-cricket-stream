import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.js';
import { listPlayers, createPlayer, updatePlayer, deletePlayer, type Player } from '../lib/api.js';
import { AppShell, ScreenContainer, PageHeader } from '../components/AppShell.js';
import { Button } from '../components/Button.js';
import { FormField, Input } from '../components/Input.js';
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
    setAddError(null);
    setAdding(true);
    try {
      await createPlayer({
        clubId,
        fullName: fullName.trim(),
        preferredName: preferredName.trim() || undefined,
        isJunior,
      });
      setFullName('');
      setPreferredName('');
      setIsJunior(false);
      await load();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add player');
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (p: Player) => {
    setEditingId(p.id);
    setEditName(p.full_name);
    setEditPref(p.preferred_name ?? '');
    setEditJunior(p.is_junior ?? false);
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (id: string) => {
    try {
      await updatePlayer(id, {
        fullName: editName.trim(),
        preferredName: editPref.trim() || null,
        isJunior: editJunior,
      });
      setEditingId(null);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update player');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remove "${name}" from the club?`)) return;
    try {
      await deletePlayer(id);
      setPlayers((ps) => ps.filter((p) => p.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete player');
    }
  };

  return (
    <AppShell>
      <ScreenContainer>
        <PageHeader
          title="Players"
          description={`${players.length} player${players.length !== 1 ? 's' : ''} in the club registry`}
        />

        <form onSubmit={handleAdd} className="mb-6 space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <h2 className="text-sm font-semibold text-white/80">Add player</h2>
          <div className="flex gap-2">
            <FormField label="Full name" className="flex-1">
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Sahil Tanwar"
                required
                maxLength={120}
              />
            </FormField>
            <FormField label="Preferred" className="w-32">
              <Input
                value={preferredName}
                onChange={(e) => setPreferredName(e.target.value)}
                placeholder="Sahil"
                maxLength={60}
              />
            </FormField>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-white/70">
            <input
              type="checkbox"
              checked={isJunior}
              onChange={(e) => setIsJunior(e.target.checked)}
              className="accent-willow-gold"
            />
            Junior player
          </label>
          {addError && <p className="text-xs text-rose-400">{addError}</p>}
          <Button type="submit" size="sm" loading={adding} icon={<Plus size={14} />}>
            Add player
          </Button>
        </form>

        <div className="space-y-1.5">
          {players.length === 0 ? (
            <p className="py-8 text-center text-sm text-white/40">
              No players yet. Add your first player above.
            </p>
          ) : (
            players.map((p) =>
              editingId === p.id ? (
                <div
                  key={p.id}
                  className="rounded-lg border border-willow-gold/30 bg-willow-gold/5 px-4 py-3"
                >
                  <div className="flex gap-2">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 text-sm"
                      placeholder="Full name"
                    />
                    <Input
                      value={editPref}
                      onChange={(e) => setEditPref(e.target.value)}
                      className="w-28 text-sm"
                      placeholder="Preferred"
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-white/70">
                      <input
                        type="checkbox"
                        checked={editJunior}
                        onChange={(e) => setEditJunior(e.target.checked)}
                        className="accent-willow-gold"
                      />
                      Junior
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void saveEdit(p.id)}
                        className="rounded p-1.5 text-emerald-400 hover:bg-emerald-500/10"
                        aria-label="Save"
                      >
                        <Check size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="rounded p-1.5 text-white/40 hover:bg-white/5"
                        aria-label="Cancel"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3"
                >
                  <div>
                    <span className="font-medium text-white">{p.full_name}</span>
                    {p.preferred_name && (
                      <span className="ml-2 text-xs text-white/50">({p.preferred_name})</span>
                    )}
                    {p.is_junior && (
                      <span className={cn(
                        'ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                        'bg-sky-500/20 text-sky-300',
                      )}>
                        Junior
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(p)}
                      className="rounded p-1.5 text-white/30 hover:bg-white/5 hover:text-white/70"
                      aria-label="Edit player"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(p.id, p.full_name)}
                      className="rounded p-1.5 text-white/30 hover:bg-rose-500/10 hover:text-rose-400"
                      aria-label="Delete player"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ),
            )
          )}
        </div>
      </ScreenContainer>
    </AppShell>
  );
}
