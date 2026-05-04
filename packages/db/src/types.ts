/**
 * Hand-written placeholder for the generated Supabase types.
 *
 * Replace this file with `npm run gen-types` once the local Supabase stack is
 * running. The generated file will fully type every table, view, and RPC.
 *
 * Keeping a hand-written subset here means the rest of the codebase compiles
 * before anyone has set up Supabase locally.
 */
export type Database = {
  public: {
    Tables: {
      clubs: {
        Row: { id: string; name: string; short_name: string; play_cricket_id: string | null; created_at: string };
        Insert: { id?: string; name: string; short_name: string; play_cricket_id?: string | null };
        Update: Partial<Database['public']['Tables']['clubs']['Insert']>;
      };
      teams: {
        Row: { id: string; club_id: string; name: string; short_name: string; created_at: string };
        Insert: { id?: string; club_id: string; name: string; short_name: string };
        Update: Partial<Database['public']['Tables']['teams']['Insert']>;
      };
      players: {
        Row: { id: string; club_id: string; full_name: string; preferred_name: string | null; play_cricket_id: string | null; is_junior: boolean; created_at: string };
        Insert: { id?: string; club_id: string; full_name: string; preferred_name?: string | null; play_cricket_id?: string | null; is_junior?: boolean };
        Update: Partial<Database['public']['Tables']['players']['Insert']>;
      };
      fixtures: {
        Row: { id: string; home_team_id: string; away_team_id: string; starts_at: string; venue: string | null; format: 'T20'|'T40'|'OD'|'Declaration'|'Other'; play_cricket_id: string | null; created_at: string };
        Insert: { id?: string; home_team_id: string; away_team_id: string; starts_at: string; venue?: string | null; format: 'T20'|'T40'|'OD'|'Declaration'|'Other'; play_cricket_id?: string | null };
        Update: Partial<Database['public']['Tables']['fixtures']['Insert']>;
      };
      matches: {
        Row: { id: string; fixture_id: string | null; home_team_id: string; away_team_id: string; format: 'T20'|'T40'|'OD'|'Declaration'|'Other'; status: 'pre-match'|'in-progress'|'innings-break'|'rain'|'completed'; toss: unknown | null; result: string | null; started_at: string; completed_at: string | null; meta: Record<string, unknown> };
        Insert: { id: string; fixture_id?: string | null; home_team_id: string; away_team_id: string; format: 'T20'|'T40'|'OD'|'Declaration'|'Other'; status?: 'pre-match'|'in-progress'|'innings-break'|'rain'|'completed'; toss?: unknown | null; result?: string | null; started_at?: string; completed_at?: string | null; meta?: Record<string, unknown> };
        Update: Partial<Database['public']['Tables']['matches']['Insert']>;
      };
      ball_events: {
        Row: { id: string; match_id: string; innings_idx: number; over_num: number; ball_in_over: number; is_legal: boolean; batter_runs: number; extras: unknown | null; wicket: unknown | null; striker_id: string; non_striker_id: string; bowler_id: string; ts: string; payload: Record<string, unknown>; synced_at: string };
        Insert: { id: string; match_id: string; innings_idx: number; over_num: number; ball_in_over: number; is_legal: boolean; batter_runs: number; extras?: unknown | null; wicket?: unknown | null; striker_id: string; non_striker_id: string; bowler_id: string; ts: string; payload: Record<string, unknown> };
        Update: Partial<Database['public']['Tables']['ball_events']['Insert']>;
      };
      match_snapshots: {
        Row: { id: string; match_id: string; reason: string; state: Record<string, unknown>; taken_at: string };
        Insert: { id?: string; match_id: string; reason: string; state: Record<string, unknown>; taken_at?: string };
        Update: Partial<Database['public']['Tables']['match_snapshots']['Insert']>;
      };
      user_profiles: {
        Row: { id: string; display_name: string | null; club_id: string | null; role: 'viewer'|'scorer'|'club_admin'|'super_admin'; created_at: string };
        Insert: { id: string; display_name?: string | null; club_id?: string | null; role?: 'viewer'|'scorer'|'club_admin'|'super_admin' };
        Update: Partial<Database['public']['Tables']['user_profiles']['Insert']>;
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_club_admin: { Args: { target_club: string }; Returns: boolean };
    };
    Enums: Record<string, never>;
  };
};
