// The loop's reads' one database call (PRD 1665, s1; ADR-0095): where a repository belongs for a
// person, repo_workspace(), which no signed-in role may call, so it runs on the service role's client
// it is handed (./loop-reads-live.ts). No rule lives here: the service reads what comes back.
import type { SupabaseClient } from '@supabase/supabase-js';
import { propertyOf } from 'omni-loop/kit/lib/narrow.ts';
import type { Database } from '../../../../supabase/database.types';

type Db = SupabaseClient<Database>;

/** The plain words when the database refuses without saying why. */
const NO_REASON = 'This repository is not in your workspace.';

/** Where a repository belongs for a person: their workspace's id, or the database's reason why none. */
export type LoopWorkspaces = {
  workspaceOf(person: string, repo: string): Promise<{ workspace: string } | { refusal: string }>;
};

export function loopRepository(db: Db): LoopWorkspaces {
  return {
    async workspaceOf(person, repo) {
      const { data, error } = await db.rpc('repo_workspace', { person, repo });
      if (error) throw new Error(`repo_workspace: ${error.message}`);
      const row: unknown = Array.isArray(data) ? data[0] : data;
      const workspace = propertyOf(row, 'workspace_id');
      if (typeof workspace === 'string' && workspace) return { workspace };
      const refusal = propertyOf(row, 'refusal');
      return { refusal: typeof refusal === 'string' && refusal ? refusal : NO_REASON };
    },
  };
}
