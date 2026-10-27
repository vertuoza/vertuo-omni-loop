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
type RpcAnswer = { data: unknown; error: { message: string; code?: string } | null };

const StoredChoice = z.object({ settings_repository: z.string().nullable() });

/** What choosing the settings repository came to: the repository now stored (null once cleared), or why
 * the database refused it (PRD 2543, s3): `not-owner` is 42501, `not-listed` is P0002. */
export type SettingsChoice = { ok: true; repository: string | null } | { ok: false; kind: 'not-owner' | 'not-listed' };

const Listing = z.object({ workspace_id: z.string() });
const ListedName = z.object({ full_name: z.string() });
const WORKSPACE_COLUMNS = 'id, github_org, github_installation_id, plan_repo, settings_repository';
const StoredWorkspace = z.object({
  id: z.string(),
  github_org: z.string().nullable(),
  github_installation_id: z.union([z.number(), z.string()]).nullable(),
  plan_repo: z.string().nullable(),
  settings_repository: z.string().nullable(),
});

/** A workspace the caller reads, as the settings read needs it. */
export type SettingsWorkspace = {
  id: string;
  githubOrg: string | null;
  installation: number | null;
  planRepo: string | null;
  /** The settings repository the owner chose (PRD 2543), owner/name in lower case, or null while none is. */
  settingsRepository: string | null;
};

async function workspacesOf(db: OmniSettingsDb, ids: string[], what: string): Promise<SettingsWorkspace[]> {
  const found = await db.from('workspaces').select(WORKSPACE_COLUMNS).in('id', ids).order('id');
  if (found.error) throw new Error(`read ${what}: ${found.error.message}`);
  return orThrow(parseRows(StoredWorkspace, found.data, 'omni-settings: workspaces')).map((row) => ({
    id: row.id,
    githubOrg: row.github_org,
    installation: row.github_installation_id === null ? null : Number(row.github_installation_id),
    planRepo: row.plan_repo,
    settingsRepository: row.settings_repository,
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

    /** The repositories the workspace lists and has not removed (full names), in Settings › Repositories'
     * order (PRD 2543, s3): the ones its owner may choose from. */
    async listedRepositories(workspace: string): Promise<string[]> {
      const listed = await db.from('repositories').select('full_name').eq('workspace_id', workspace).is('removed_at', null);
      if (listed.error) throw new Error(`read the repositories of ${workspace}: ${listed.error.message}`);
      return orThrow(parseRows(ListedName, listed.data, 'omni-settings: repositories'))
        .map((row) => row.full_name)
        .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase(), 'en'));
    },

    /** Stores `fullName` as the workspace's settings repository, null to clear it, as the signed-in caller
     * (PRD 2543, s3): the database's own owner-only function decides who may, and which repository. */
    async chooseSettingsRepository(workspace: string, fullName: string | null): Promise<SettingsChoice> {
      const answer: RpcAnswer = await db.rpc('set_workspace_settings_repository', { p_workspace: workspace, p_full_name: fullName });
      if (answer.error?.code === '42501') return { ok: false, kind: 'not-owner' };
      if (answer.error?.code === 'P0002') return { ok: false, kind: 'not-listed' };
      if (answer.error) throw new Error(`choose the settings repository of ${workspace}: ${answer.error.message}`);
      const stored = StoredChoice.safeParse(answer.data);
      if (!stored.success) throw new Error(`choose the settings repository of ${workspace}: the answer did not read`);
      return { ok: true, repository: stored.data.settings_repository };
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
