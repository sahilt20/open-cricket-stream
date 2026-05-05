import { getSupabase } from './supabase.js';
import type { Database } from '@ocs/db/types';

type Tables = Database['public']['Tables'];
export type Club = Tables['clubs']['Row'];
export type Team = Tables['teams']['Row'];
export type Player = Tables['players']['Row'];
export type UserProfile = Tables['user_profiles']['Row'];

/**
 * Thin wrapper around Supabase queries. Keeping them centralised here means
 * components don't import the supabase client directly, which makes mocking
 * for tests easier later, and keeps the URL/anon-key plumbing in one place.
 *
 * Every function returns either the data or null (for missing/unconfigured
 * cases), and throws on actual API errors so React Error Boundaries can
 * catch network failures.
 */

function client() {
  const c = getSupabase();
  if (!c) throw new Error('Supabase not configured — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
  return c;
}

export async function getMyProfile(): Promise<UserProfile | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', auth.user.id)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function updateMyDisplayName(displayName: string): Promise<void> {
  const supabase = client();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('not authenticated');
  const { error } = await supabase
    .from('user_profiles')
    .update({ display_name: displayName })
    .eq('id', auth.user.id);
  if (error) throw error;
}

export async function claimClub(name: string, shortName: string): Promise<Club> {
  const supabase = client();
  const { data, error } = await supabase.rpc('claim_club', {
    club_name: name,
    short_name: shortName,
  });
  if (error) throw error;
  if (!data) throw new Error('claim_club returned no row');
  return data as unknown as Club;
}

export async function getMyClub(clubId: string | null): Promise<Club | null> {
  if (!clubId) return null;
  const supabase = client();
  const { data, error } = await supabase.from('clubs').select('*').eq('id', clubId).maybeSingle();
  if (error) throw error;
  return data ?? null;
}

// ─── Teams ──────────────────────────────────────────────────────────────────

export async function listTeams(clubId: string): Promise<Team[]> {
  const supabase = client();
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .eq('club_id', clubId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createTeam(input: { clubId: string; name: string; shortName: string }): Promise<Team> {
  const supabase = client();
  const { data, error } = await supabase
    .from('teams')
    .insert({ club_id: input.clubId, name: input.name, short_name: input.shortName })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTeam(id: string): Promise<void> {
  const supabase = client();
  const { error } = await supabase.from('teams').delete().eq('id', id);
  if (error) throw error;
}

// ─── Players ────────────────────────────────────────────────────────────────

export async function listPlayers(clubId: string): Promise<Player[]> {
  const supabase = client();
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('club_id', clubId)
    .order('full_name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createPlayer(input: {
  clubId: string;
  fullName: string;
  preferredName?: string;
  isJunior?: boolean;
}): Promise<Player> {
  const supabase = client();
  const { data, error } = await supabase
    .from('players')
    .insert({
      club_id: input.clubId,
      full_name: input.fullName,
      preferred_name: input.preferredName ?? null,
      is_junior: input.isJunior ?? false,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updatePlayer(
  id: string,
  patch: { fullName?: string; preferredName?: string | null; isJunior?: boolean },
): Promise<Player> {
  const supabase = client();
  const { data, error } = await supabase
    .from('players')
    .update({
      ...(patch.fullName !== undefined ? { full_name: patch.fullName } : {}),
      ...(patch.preferredName !== undefined ? { preferred_name: patch.preferredName } : {}),
      ...(patch.isJunior !== undefined ? { is_junior: patch.isJunior } : {}),
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deletePlayer(id: string): Promise<void> {
  const supabase = client();
  const { error } = await supabase.from('players').delete().eq('id', id);
  if (error) throw error;
}
