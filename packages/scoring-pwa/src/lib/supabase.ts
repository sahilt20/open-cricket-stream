import { createBrowserClient, type OcsSupabaseClient } from '@ocs/db';

let cached: OcsSupabaseClient | null = null;

export function getSupabase(): OcsSupabaseClient | null {
  if (cached) return cached;
  cached = createBrowserClient({
    url: import.meta.env.VITE_SUPABASE_URL,
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  });
  return cached;
}
