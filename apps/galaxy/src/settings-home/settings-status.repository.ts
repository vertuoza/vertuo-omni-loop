import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

// The settings home's status reads (omni-loop-32 s2; ADR-0095), as the signed-in person, so row-level
// security decides what they count. Two are head-only counts (`head: true` moves no row) over tables
// already read elsewhere (repositories, jev_decisions); no new shape is read, so `pnpm schemas:verify` has
// nothing to add. The API keys' table (agent_tokens) has no member policy, so a member counts the live keys
// the way the API keys page lists them, through api_keys_list(), which answers a member the live keys only.
// No rule lives here: settings-status.service.ts holds them.

/** The three counts, each read for a workspace. */
export interface SettingsCounts {
  /** Tracked repositories. */
  repositories: (workspace: string) => Promise<number>;
  /** Live API keys. */
  apiKeys: (workspace: string) => Promise<number>;
  /** Jev decisions that are not Off. */
  jevOn: (workspace: string) => Promise<number>;
}

export type SettingsStatusDb = Pick<SupabaseClient, 'from' | 'rpc'>;

const Count = z.number().int().nonnegative();
const Keys = z.array(z.unknown());

type Head = PromiseLike<{ count: number | null; error: { message: string } | null }>;

const counted = async (call: Head, what: string): Promise<number> => {
  const { count, error } = await call;
  if (error) throw new Error(`settings status ${what}: ${error.message}`);
  return Count.parse(count);
};

export function settingsStatusRepository(db: SettingsStatusDb): SettingsCounts {
  return {
    repositories: (workspace) =>
      counted(db.from('repositories').select('full_name', { count: 'exact', head: true }).eq('workspace_id', workspace).eq('tracked', true).is('removed_at', null), 'repositories'),
    jevOn: (workspace) =>
      counted(db.from('jev_decisions').select('decision', { count: 'exact', head: true }).eq('workspace_id', workspace).neq('mode', 'off'), 'jev_decisions'),
    apiKeys: async (workspace) => {
      const answer: { data: unknown; error: { message: string } | null } = await db.rpc('api_keys_list', { p_workspace: workspace });
      if (answer.error) throw new Error(`settings status api keys: ${answer.error.message}`);
      return Keys.parse(answer.data).length;
    },
  };
}
