// The one way into fix_bug_push() (supabase/migrations/20261211090000_fix_rows.sql, PRD 2011 s6): records
// one push of a bug born on the server, as the caller. The answer is parsed where it comes in
// (data/parse-rows.ts); a refusal throws with the database's reason.
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { parseRow } from '../data/parse-rows';
import { StoreError } from '../data/store-error';

/** What a push carries to the database: the product, the place, the title, bug.md and the rows. */
export type FixRowsPush = {
  productKey: string;
  bug?: number | undefined;
  repo?: string | undefined;
  title: string;
  record: string;
  rows: ReadonlyArray<{ repo: string; pull: number | null; changes: string; reproduction: string | null; guard: string | null }>;
};

/** The database refused or failed; `code` is Postgres's. */
export class FixRowsStoreError extends StoreError {}

const Answer = z.strictObject({
  dossierId: z.string(),
  bug: z.string(),
  created: z.boolean(),
  product: z.strictObject({ id: z.string(), name: z.string() }),
  rows: z.array(z.strictObject({ position: z.number().int(), repository: z.string(), pull: z.number().int().nullable(), state: z.string() })),
  added: z.array(z.strictObject({ kind: z.string(), version: z.number().int() })),
  unchanged: z.array(z.string()),
});

/** Records one push of a bug born on the server: the product's next bug when `bug` is null, else a push to
 * `<key>-B<n>`. */
export async function pushBug(db: Pick<SupabaseClient, 'rpc'>, push: FixRowsPush): Promise<z.output<typeof Answer>> {
  const { productKey, bug, repo, title, record, rows } = push;
  const { data, error } = await db.rpc('fix_bug_push', { p_key: productKey, p_bug: bug ?? null, p_body: { title, record, rows }, p_repo: repo ?? null });
  if (error) throw new FixRowsStoreError('push the bug', error.code, error.message);
  const parsed = parseRow(Answer, data, 'fixes/rows: fix_bug_push');
  if (!parsed.ok) throw new FixRowsStoreError('push the bug', undefined, parsed.error);
  return parsed.value;
}

