import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { orThrow, parseRows } from '../data/parse-rows';

// The Omni settings area's storage (PRD 2417, s3; ADR-0095): the workspaces that list a repository,
// on the signed-in caller's client, so row-level security decides which ones they read. No rule lives
// here: which workspace answers and what its settings repository is, is omni-settings.service.ts's.
// The edit (s7) asks one more thing, whether the caller owns a workspace, through `is_owner()`, so the
// database's own rule decides it.

export type OmniSettingsDb = Pick<SupabaseClient, 'from' | 'rpc'>;

/** What a database function answers, before it is read. */
type RpcAnswer = { data: unknown; error: { message: string } | null };

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

async function workspacesOf(db: OmniSettingsDb, ids: string[], what: string): Promise<SettingsWorkspace[]> {
  const found = await db.from('workspaces').select(WORKSPACE_COLUMNS).in('id', ids).order('id');
  if (found.error) throw new Error(`read ${what}: ${found.error.message}`);
  return orThrow(parseRows(StoredWorkspace, found.data, 'omni-settings: workspaces')).map((row) => ({
    id: row.id,
    githubOrg: row.github_org,
    installation: row.github_installation_id === null ? null : Number(row.github_installation_id),
    planRepo: row.plan_repo,
  }));
}

export function omniSettingsRepository(db: OmniSettingsDb) {
  return {
    /** The workspaces the caller reads that list `repo` (owner/name, lower case), by id. */
    async workspacesListing(repo: string): Promise<SettingsWorkspace[]> {
      const listed = await db.from('repositories').select('workspace_id').eq('full_name', repo).is('removed_at', null);
      if (listed.error) throw new Error(`read the workspaces of ${repo}: ${listed.error.message}`);
      const ids = orThrow(parseRows(Listing, listed.data, 'omni-settings: repositories')).map((row) => row.workspace_id);
      if (ids.length === 0) return [];
      return workspacesOf(db, ids, `the workspaces of ${repo}`);
    },

    /** The workspace `id` when the caller reads it, else null (PRD 2417, s6: the page's own read). */
    async workspaceById(id: string): Promise<SettingsWorkspace | null> {
      return (await workspacesOf(db, [id], `the workspace ${id}`))[0] ?? null;
    },

    /** Whether the caller owns the workspace `id` (PRD 2417, s7: only an owner proposes a change). */
    async isOwner(id: string): Promise<boolean> {
      const answer: RpcAnswer = await db.rpc('is_owner', { workspace: id });
      if (answer.error) throw new Error(`read your role in the workspace ${id}: ${answer.error.message}`);
      return answer.data === true;
    },
  };
}
export type OmniSettingsRepository = ReturnType<typeof omniSettingsRepository>;
