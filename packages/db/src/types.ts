/**
 * Hand-written placeholder for the generated Supabase types.
 *
 * Replace this file with `npm run gen-types` once the local Supabase stack is
 * running. The generated file will fully type every table, view, RPC, and the
 * relationship graph for typed joins.
 *
 * Keeping a hand-written subset here means the rest of the codebase compiles
 * before anyone has set up Supabase locally. The shape below matches what
 * `@supabase/postgrest-js` v2.x expects (GenericSchema + GenericTable shape):
 * each table needs Row/Insert/Update/Relationships, and the root needs
 * `__InternalSupabase` so the client can detect the Postgrest version.
 */
type Tbl<R, I = Partial<R>, U = Partial<I>> = {
  Row: R;
  Insert: I;
  Update: U;
  Relationships: [];
};

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '12';
  };
  public: {
    Tables: {
      clubs: Tbl<
        { id: string; name: string; short_name: string; play_cricket_id: string | null; created_at: string },
        { id?: string; name: string; short_name: string; play_cricket_id?: string | null }
      >;
      teams: Tbl<
        { id: string; club_id: string; name: string; short_name: string; created_at: string },
        { id?: string; club_id: string; name: string; short_name: string }
      >;
      players: Tbl<
        { id: string; club_id: string; full_name: string; preferred_name: string | null; play_cricket_id: string | null; is_junior: boolean; created_at: string },
        { id?: string; club_id: string; full_name: string; preferred_name?: string | null; play_cricket_id?: string | null; is_junior?: boolean }
      >;
      fixtures: Tbl<
        { id: string; home_team_id: string | null; away_team_id: string | null; starts_at: string; venue: string | null; format: 'T20'|'T40'|'OD'|'Declaration'|'Other'; play_cricket_id: string | null; created_at: string },
        { id?: string; home_team_id?: string | null; away_team_id?: string | null; starts_at: string; venue?: string | null; format: 'T20'|'T40'|'OD'|'Declaration'|'Other'; play_cricket_id?: string | null }
      >;
      matches: Tbl<
        { id: string; fixture_id: string | null; home_team_id: string | null; away_team_id: string | null; format: 'T20'|'T40'|'OD'|'Declaration'|'Other'; status: 'pre-match'|'in-progress'|'innings-break'|'rain'|'completed'; toss: unknown | null; result: string | null; started_at: string; completed_at: string | null; meta: Record<string, unknown> },
        { id: string; fixture_id?: string | null; home_team_id?: string | null; away_team_id?: string | null; format: 'T20'|'T40'|'OD'|'Declaration'|'Other'; status?: 'pre-match'|'in-progress'|'innings-break'|'rain'|'completed'; toss?: unknown | null; result?: string | null; started_at?: string; completed_at?: string | null; meta?: Record<string, unknown> }
      >;
      ball_events: Tbl<
        { id: string; match_id: string; innings_idx: number; over_num: number; ball_in_over: number; is_legal: boolean; batter_runs: number; extras: unknown | null; wicket: unknown | null; striker_id: string; non_striker_id: string; bowler_id: string; ts: string; payload: Record<string, unknown>; synced_at: string },
        { id: string; match_id: string; innings_idx: number; over_num: number; ball_in_over: number; is_legal: boolean; batter_runs: number; extras?: unknown | null; wicket?: unknown | null; striker_id: string; non_striker_id: string; bowler_id: string; ts: string; payload: Record<string, unknown> }
      >;
      match_snapshots: Tbl<
        { id: string; match_id: string; reason: string; state: Record<string, unknown>; taken_at: string },
        { id?: string; match_id: string; reason: string; state: Record<string, unknown>; taken_at?: string }
      >;
      user_profiles: Tbl<
        { id: string; display_name: string | null; club_id: string | null; role: 'viewer'|'scorer'|'club_admin'|'super_admin'; created_at: string },
        { id: string; display_name?: string | null; club_id?: string | null; role?: 'viewer'|'scorer'|'club_admin'|'super_admin' }
      >;
    };
    Views: Record<string, never>;
    Functions: {
      is_club_admin: { Args: { target_club: string }; Returns: boolean };
      claim_club: {
        Args: { club_name: string; short_name: string };
        Returns: { id: string; name: string; short_name: string; play_cricket_id: string | null; created_at: string };
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
