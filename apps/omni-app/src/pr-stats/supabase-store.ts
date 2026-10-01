// @ts-nocheck
// The collector's one storage layer (PRD 612): the only place `prStats` reaches the database. It
// reads the tracked repositories and writes, as the service role, the collection columns of
// `repositories` and the `pull_requests` and `pull_request_reviews` rows. Upserts on each table's key
// make a second write of the same pull request change nothing.
import { createClient } from '@supabase/supabase-js';

const TRACKED = 'workspace_id, full_name, collected_until, workspaces!inner(github_installation_id)';

/**
 * @param {{ url: string, key: string, fetch?: typeof fetch }} connection  `fetch` for tests only
 */
export function supabaseStore({ url, key, fetch = undefined }) {
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    ...(fetch ? { global: { fetch } } : {}),
  });

  return {
    /** @returns {Promise<{ workspaceId: string, installationId: number, fullName: string, collectedUntil: string | null }[]>} */
    async trackedRepositories() {
      const rows = checked(
        await db
          .from('repositories')
          .select(TRACKED)
          .eq('tracked', true)
          .not('workspaces.github_installation_id', 'is', null)
          .order('workspace_id')
          .order('full_name'),
      );
      return rows.map((row) => ({
        workspaceId: row.workspace_id,
        installationId: Number(row.workspaces.github_installation_id),
        fullName: row.full_name,
        collectedUntil: row.collected_until ?? null,
      }));
    },

    async savePull(row, reviews) {
      checked(await db.from('pull_requests').upsert(row, { onConflict: 'workspace_id,repo,number' }));
      if (reviews.length > 0) {
        checked(await db.from('pull_request_reviews').upsert(reviews, { onConflict: 'workspace_id,repo,number,reviewer' }));
      }
    },

    async updateRepository(workspaceId, fullName, patch) {
      checked(await db.from('repositories').update(patch).eq('workspace_id', workspaceId).eq('full_name', fullName));
    },
  };
}

function checked({ data, error }) {
  if (error) throw new Error(`The database refused: ${error.message}${error.code ? ` (${error.code})` : ''}`);
  return data ?? [];
}
