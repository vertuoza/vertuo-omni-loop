// The sync's read of the PRDs born on the server (PRD 1299, s6), as the service role: a repository's PRD
// dossiers whose birthplace is `server` (supabase/migrations/20261123090000_approvals.sql), each with the
// time of its first approval, which dates its inbox (./core.ts); null while nobody approved it. A refusal
// throws with Supabase's reason, and the sync logs it.
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from '../../../../../supabase/database.types.ts';
import { orThrow, parseRows } from '../../data/parse-rows';
import { settle } from '../store';
import type { ServerBorn } from './core';
import { PrdNumberSchema } from 'vertuo-omni-plan/kit/lib/ids.ts';

export type ServerBornStore = {
  /** The repository's PRDs born on the server, each with its first approval. */
  serverBorn(workspaceId: string, repository: string): Promise<ServerBorn[]>;
};

export const SERVER_BORN_COLUMNS = 'prd, approvals(approved_at)';

/** A ◆ PRD's dossier, as SERVER_BORN_COLUMNS reads it: its PRD and every approval's time. */
export const ServerBornRow = z.object({
  prd: PrdNumberSchema,
  approvals: z.array(z.object({ approved_at: z.string().refine((at) => !Number.isNaN(Date.parse(at))) })),
});

type Db = Pick<SupabaseClient<Database>, 'from'>;

/** The earliest of the times, in ISO 8601; null for none. */
function first(times: readonly string[]): string | null {
  const earliest = Math.min(...times.map((at) => Date.parse(at)));
  return times.length === 0 ? null : new Date(earliest).toISOString();
}

export function serverBornStore(db: Db): ServerBornStore {
  return {
    async serverBorn(workspaceId, repository) {
      const { data, error } = await db.from('dossiers').select(SERVER_BORN_COLUMNS).eq('workspace_id', workspaceId).eq('kind', 'prd')
        .eq('birthplace', 'server').eq('home_repo', repository.toLowerCase()).not('prd', 'is', null);
      settle('read the PRDs born on the server', error);
      return orThrow(parseRows(ServerBornRow, data ?? [], 'stages/sync: dossiers born on the server'))
        .map(({ prd, approvals }) => ({ prd, approved_at: first(approvals.map((a) => a.approved_at)) }));
    },
  };
}
