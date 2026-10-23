import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { orThrow, parseRows } from '../data/parse-rows';

// The Omni settings area's storage (PRD 2417, s3; ADR-0095): the workspaces that list a repository,
// on the signed-in caller's client, so row-level security decides which ones they read. No rule lives
// here: which workspace answers and what its settings repository is, is omni-settings.service.ts's.

export type OmniSettingsDb = Pick<SupabaseClient, 'from'>;

const Listing = z.object({ workspace_id: z.string() });
const WORKSPACE_COLUMNS = 'id, github_org, github_installation_id, plan_repo';
const StoredWorkspace = z.object({
  id: z.string(),
  github_org: z.string().nullable(),
  github_installation_id: z.union([z.number(), z.string()]).nullable(),
  plan_repo: z.string().nullable(),
});

/** A workspace the caller reads, as the settings read needs it. */
export type SettingsWorkspace = {
  id: string;
  githubOrg: string | null;
  installation: number | null;
  planRepo: string | null;
};

export function omniSettingsRepository(db: OmniSettingsDb) {
  return {
    /** The workspaces the caller reads that list `repo` (owner/name, lower case), by id. */
    async workspacesListing(repo: string): Promise<SettingsWorkspace[]> {
      const listed = await db.from('repositories').select('workspace_id').eq('full_name', repo).is('removed_at', null);
      if (listed.error) throw new Error(`read the workspaces of ${repo}: ${listed.error.message}`);
      const ids = orThrow(parseRows(Listing, listed.data, 'omni-settings: repositories')).map((row) => row.workspace_id);
      if (ids.length === 0) return [];
      const found = await db.from('workspaces').select(WORKSPACE_COLUMNS).in('id', ids).order('id');
      if (found.error) throw new Error(`read the workspaces of ${repo}: ${found.error.message}`);
      return orThrow(parseRows(StoredWorkspace, found.data, 'omni-settings: workspaces')).map((row) => ({
        id: row.id,
        githubOrg: row.github_org,
        installation: row.github_installation_id === null ? null : Number(row.github_installation_id),
        planRepo: row.plan_repo,
      }));
    },
  };
}
export type OmniSettingsRepository = ReturnType<typeof omniSettingsRepository>;
