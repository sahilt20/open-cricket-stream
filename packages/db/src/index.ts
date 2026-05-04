import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types.js';

export type OcsSupabaseClient = SupabaseClient<Database>;

/**
 * Create a Supabase client for the **PWA / browser** (anon key, RLS enforced).
 *
 * If the URL or key is missing we return null instead of throwing — the PWA
 * falls back to "local-only" mode where it talks only to the Pi over WS and
 * persistent features (history, fixtures) are disabled with a banner.
 */
export function createBrowserClient(env: {
  url?: string;
  anonKey?: string;
}): OcsSupabaseClient | null {
  if (!env.url || !env.anonKey) return null;
  return createClient<Database>(env.url, env.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
}

/**
 * Create a Supabase client for the **score-engine on the Pi** (service-role
 * key, bypasses RLS). This client writes the match mirror, never exposed to
 * users, never built into a browser bundle.
 *
 * Returns null if env is missing — the score-engine then runs SQLite-only,
 * which is a fully supported mode (the rig still functions; just no cloud
 * mirror until env is configured).
 */
export function createServiceClient(env: {
  url?: string;
  serviceRoleKey?: string;
}): OcsSupabaseClient | null {
  if (!env.url || !env.serviceRoleKey) return null;
  return createClient<Database>(env.url, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'public' },
  });
}

export type { Database } from './types.js';
