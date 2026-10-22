// The one way into the stored waits (PRD 2377, s1; supabase/migrations/20261224090000_waits.sql), as the
// service role, for the stages sync: a repository's open waits, what a run changes in them, and the GitHub
// login of each PRD's owner (who opened its dossier, as their player row in the workspace names them).
// No rule lives here: which waits are open and how they are kept is ./waits.ts's. The database keeps a
// row's since and its end once written; nobody deletes. A refusal throws with Supabase's reason, and an
// answer out of shape too.
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from '../../../../../supabase/database.types.ts';
import { orThrow, parseRows } from '../../data/parse-rows';
import { settle } from '../store';
import { WAIT_KINDS, type WaitStore } from './waits';
import { PrdNumberSchema, PrNumberSchema, type PrdNumber } from 'omni-loop/kit/lib/ids.ts';

type Db = Pick<SupabaseClient<Database>, 'from'>;

const WAITS_TABLE = 'waits';
const WHERE = 'stages/sync/waits.repository';

const WAIT_COLUMNS = 'id, prd, pr, kind, turn, since, seen_at';
/** An open wait, as WAIT_COLUMNS reads it. */
export const StoredWaitRow = z.strictObject({
  id: z.string(),
  prd: PrdNumberSchema.nullable(),
  pr: PrNumberSchema.nullable(),
  kind: z.enum(WAIT_KINDS),
  turn: z.array(z.string()),
  since: z.string(),
  seen_at: z.string(),
});

const OWNER_COLUMNS = 'prd, opened_by';
/** A PRD's dossier, as OWNER_COLUMNS reads it: who opened it. */
export const StoredOwnerRow = z.strictObject({ prd: PrdNumberSchema, opened_by: z.string() });

const LOGIN_COLUMNS = 'user_id, github_login';
/** A player of the workspace, as LOGIN_COLUMNS reads them: their GitHub login. */
export const StoredLoginRow = z.strictObject({ user_id: z.string(), github_login: z.string() });

/** Every open wait the caller reads. */
export const openWaitsOf = (db: Db) => db.from(WAITS_TABLE).select(WAIT_COLUMNS).is('ended_at', null);
/** Every numbered PRD dossier the caller reads that someone opened. */
export const ownersOf = (db: Db) => db.from('dossiers').select(OWNER_COLUMNS).eq('kind', 'prd').not('prd', 'is', null).not('opened_by', 'is', null);
/** Every player the caller reads who has a GitHub login. */
export const loginsOf = (db: Db) => db.from('players').select(LOGIN_COLUMNS).not('github_login', 'is', null);

const lower = (repository: string) => repository.toLowerCase();

export function waitsRepository(db: Db): WaitStore {
  return {
    async openWaits(workspaceId, repository) {
      const { data, error } = await openWaitsOf(db).eq('workspace_id', workspaceId).eq('repo', lower(repository));
      settle(`read the open waits of ${lower(repository)}`, error);
      return orThrow(parseRows(StoredWaitRow, data, `${WHERE}: waits`));
    },

    async applyWaits(workspaceId, repository, { opened, refreshed, ended }, at) {
      const repo = lower(repository);
      if (ended.length > 0) {
        const { error } = await db.from(WAITS_TABLE).update({ ended_at: at }).in('id', ended).is('ended_at', null);
        settle(`end ${String(ended.length)} ${ended.length === 1 ? 'wait' : 'waits'} of ${repo}`, error);
      }
      if (refreshed.length > 0) {
        const rows = refreshed.map((w) => ({ id: w.id, workspace_id: workspaceId, repo, prd: w.prd, pr: w.pr, kind: w.kind, turn: w.turn, since: w.since, seen_at: w.seen_at }));
        const { error } = await db.from(WAITS_TABLE).upsert(rows, { onConflict: 'id' });
        settle(`refresh ${String(rows.length)} ${rows.length === 1 ? 'wait' : 'waits'} of ${repo}`, error);
      }
      if (opened.length > 0) {
        const rows = opened.map((w) => ({ workspace_id: workspaceId, repo, prd: w.prd, pr: w.pr, kind: w.kind, turn: w.turn, since: w.since, seen_at: w.seen_at }));
        const { error } = await db.from(WAITS_TABLE).insert(rows);
        settle(`open ${String(rows.length)} ${rows.length === 1 ? 'wait' : 'waits'} of ${repo}`, error);
      }
    },

    async owners(workspaceId, repository, prds) {
      if (prds.length === 0) return new Map();
      const dossiers = await ownersOf(db).eq('workspace_id', workspaceId).eq('home_repo', lower(repository)).in('prd', [...prds]);
      settle(`read the owners of ${lower(repository)}'s PRDs`, dossiers.error);
      const opened = orThrow(parseRows(StoredOwnerRow, dossiers.data, `${WHERE}: dossiers`));
      if (opened.length === 0) return new Map();
      const players = await loginsOf(db).eq('workspace_id', workspaceId).in('user_id', [...new Set(opened.map((d) => d.opened_by))]);
      settle(`read the logins of ${lower(repository)}'s PRD owners`, players.error);
      const logins = new Map(orThrow(parseRows(StoredLoginRow, players.data, `${WHERE}: players`)).map((p) => [p.user_id, p.github_login]));
      return new Map(opened.flatMap(({ prd, opened_by }): [PrdNumber, string][] => {
        const login = logins.get(opened_by);
        return login === undefined ? [] : [[prd, login]];
      }));
    },
  };
}
