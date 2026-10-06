// The collector's one storage layer (PRD 612): the only place `prStats` reaches the database. It
// reads the tracked repositories and writes, as the service role, the collection columns of
// `repositories` and the `pull_requests` and `pull_request_reviews` rows. Upserts on each table's key
// make a second write of the same pull request change nothing.
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../../../supabase/database.types.ts';
import type { ReviewRow } from './github.ts';
import { parsedOr, TrackedRowSchema, type TrackedRepositorySchema } from './schema.ts';
import type { z } from 'zod';

/** A tracked repository, the installation it is read through, and its cursor. */
export type TrackedRepository = z.infer<typeof TrackedRepositorySchema>;

/** A `pull_requests` row as written: every column with a default may be left out. */
export type PullInsert = Database['public']['Tables']['pull_requests']['Insert'];

/** What the collector writes on a `repositories` row: its collection columns. */
export type RepositoryPatch = Pick<Database['public']['Tables']['repositories']['Update'], 'collected_at' | 'collected_until' | 'collect_error'>;

/** The store the collector reads and writes through. */
export type PrStatsStore = {
  trackedRepositories: () => Promise<TrackedRepository[]>;
  savePull: (row: PullInsert, reviews: ReviewRow[]) => Promise<void>;
  updateRepository: (workspaceId: string, fullName: string, patch: RepositoryPatch) => Promise<void>;
};

export const TRACKED = 'workspace_id, full_name, collected_until, workspaces!inner(github_installation_id)';

/** The store on the database at `url`, as the service role `key`; `fetch` for tests only. */
export function supabaseStore({ url, key, fetch }: { url: string; key: string; fetch?: typeof globalThis.fetch | undefined }): PrStatsStore {
  const db = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    ...(fetch ? { global: { fetch } } : {}),
  });

  return {
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
      return parsedOr(TrackedRowSchema.array(), rows, 'The database answered the tracked repositories unexpectedly').map((row) => ({
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

function checked<T>({ data, error }: { data: T[] | null; error: { message: string; code?: string } | null }): T[] {
  if (error) throw new Error(`The database refused: ${error.message}${error.code ? ` (${error.code})` : ''}`);
  return data ?? [];
}
