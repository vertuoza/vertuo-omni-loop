// The one way into the stored waits (PRD 2377, s1; supabase/migrations/20261226090000_waits.sql), as the
// service role, for the stages sync: a repository's open waits, what a run changes in them, and the GitHub
// login of each PRD's owner (who opened its dossier, as their player row in the workspace names them).
// No rule lives here: which waits are open and how they are kept is ./waits.ts's. The database keeps a
// row's since and its end once written; nobody deletes. A refusal throws with Supabase's reason, and an
// answer out of shape too.
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from '../../../../../supabase/database.types.ts';
import { orThrow, parseRows } from '../../data/parse-rows';
import { waitingOf } from '../outbox/store';
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

const PRODUCT_COLUMNS = 'product_id';
/** A repository's link to a product, as PRODUCT_COLUMNS reads it. */
export const StoredProductRow = z.strictObject({ product_id: z.string() });

const APPROVER_COLUMNS = 'user_id';
/** A member a product asks to approve, as APPROVER_COLUMNS reads them. */
export const StoredApproverRow = z.strictObject({ user_id: z.string() });

const ITEM_COLUMNS = 'prd, waiting';
/** A PRD's stored open outbox items, as ITEM_COLUMNS reads them (the items parsed by waitingOf). */
export const StoredItemsRow = z.strictObject({ prd: PrdNumberSchema, waiting: z.unknown() });

const REACHED_COLUMNS = 'prd, reached_at';
/** A PRD's stage `prd`, as REACHED_COLUMNS reads it. */
export const StoredReachedRow = z.strictObject({ prd: PrdNumberSchema, reached_at: z.string() });

/** Every product link the caller reads. */
export const productsOf = (db: Db) => db.from('product_repositories').select(PRODUCT_COLUMNS);
/** Every approver a product asks that the caller reads. */
export const approversOf = (db: Db) => db.from('product_approvers').select(APPROVER_COLUMNS).eq('state', 'asked');
/** Every stored outbox the caller reads. */
export const itemsOf = (db: Db) => db.from('prd_outbox').select(ITEM_COLUMNS);
/** Every stage `prd` the caller reads. */
export const reachedOf = (db: Db) => db.from('prd_stages').select(REACHED_COLUMNS).eq('stage', 'prd');

const lower = (repository: string) => repository.toLowerCase();

/** The GitHub login of each of `users` that has one, in the workspace; `whose` names them in a refusal. */
async function loginsFor(db: Db, workspaceId: string, users: readonly string[], whose: string): Promise<Map<string, string>> {
  const players = await loginsOf(db).eq('workspace_id', workspaceId).in('user_id', [...new Set(users)]);
  settle(`read the logins of ${whose}`, players.error);
  return new Map(orThrow(parseRows(StoredLoginRow, players.data, `${WHERE}: players`)).map((p) => [p.user_id, p.github_login]));
}

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
      const logins = await loginsFor(db, workspaceId, opened.map((d) => d.opened_by), `${lower(repository)}'s PRD owners`);
      return new Map(opened.flatMap(({ prd, opened_by }): [PrdNumber, string][] => {
        const login = logins.get(opened_by);
        return login === undefined ? [] : [[prd, login]];
      }));
    },

    async approvers(workspaceId, repository) {
      const links = await productsOf(db).eq('workspace_id', workspaceId).eq('repository', lower(repository));
      settle(`read the products of ${lower(repository)}`, links.error);
      const products = orThrow(parseRows(StoredProductRow, links.data, `${WHERE}: products`)).map((p) => p.product_id);
      if (products.length === 0) return [];
      const asked = await approversOf(db).eq('workspace_id', workspaceId).in('product_id', products);
      settle(`read the approvers of ${lower(repository)}'s products`, asked.error);
      const users = [...new Set(orThrow(parseRows(StoredApproverRow, asked.data, `${WHERE}: approvers`)).map((a) => a.user_id))];
      if (users.length === 0) return [];
      const logins = await loginsFor(db, workspaceId, users, `${lower(repository)}'s approvers`);
      return users.flatMap((user) => logins.get(user) ?? []);
    },

    async outboxes(workspaceId, repository, prds) {
      if (prds.length === 0) return new Map();
      const { data, error } = await itemsOf(db).eq('workspace_id', workspaceId).eq('repository', lower(repository)).in('prd', [...prds]);
      settle(`read the outboxes of ${lower(repository)}'s PRDs`, error);
      return new Map(orThrow(parseRows(StoredItemsRow, data, `${WHERE}: outboxes`)).map((row) => [row.prd, waitingOf(row.waiting)]));
    },

    async reached(workspaceId, repository, prds) {
      if (prds.length === 0) return new Map();
      const { data, error } = await reachedOf(db).eq('workspace_id', workspaceId).eq('repository', lower(repository)).in('prd', [...prds]);
      settle(`read when ${lower(repository)}'s PRDs reached stage prd`, error);
      return new Map(orThrow(parseRows(StoredReachedRow, data, `${WHERE}: stages`)).map((row) => [row.prd, row.reached_at]));
    },
  };
}
