// The Fixes rows of a bug record born on the server (PRD 2011, s6), as a plain function of a Request, so
// it is tested with a stubbed Supabase client and the route under app/api/fixes/ stays one line:
//
//   POST /api/fixes {productKey, new: true | bug: <n>, repo?, check?, title, record,
//                    rows: [{repo (owner/name), pull?, changes, reproduction?, guard?}]}
//     → 201 the product's next bug, 200 a push to `<key>-B<n>`: {dossierId, bug, created,
//       product: {id, name}, rows: [{position, repository, pull, state}], added: [{kind, version}],
//       unchanged: [kind]}
//
// The bug is a dossier of its product, with no issue: fix_bug_push()
// (supabase/migrations/20261211090000_fix_rows.sql) numbers it from the product's own counter
// (`products.bug_seq`), keeps one fix_rows row per fix and adds bug.md as a bug-record version only when it
// changed. Every row's repository is checked here against the product's own repositories before
// anything is written: a row naming one outside the product is refused 400 by name. The database checks
// it again. With `check: true` nothing is written either: the answer is 200 {checked: true, product:
// {key, name}, repositories: [{repository, readOnly}]}, which `omni bug check --product` grades the rows
// against. A product the caller reads none of is 404.
//
// Refusals follow ADR-0029, each `{error}` in plain words: 400 a malformed body or a row outside the
// product, 401 no valid bearer token, 403 not allowed, 404 no such product or bug, 413 a body over its cap,
// 503 no database here or the sign-in service down, 500 the database failed.
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { TokenCheck } from '../ask/auth';
import { bodyOf, Line, receivePush, refuse } from '../data/kit-push';
import { parseRow } from '../data/parse-rows';
import { StoreError } from '../data/store-error';
import { readProductRepositories, RoadmapStoreError } from '../roadmap/store';

/** The largest push: a bug.md and fifty rows, with room to spare. */
const MAX_PUSH_BYTES = 256 * 1024;

/** A Supabase client acting as one access token: the Auth server's check and the function. */
export type FixRowsClient = TokenCheck & Pick<SupabaseClient, 'rpc' | 'from'>;

export type FixRowsDeps = {
  /** A client acting as the given access token, or null when no database is configured. */
  connect: ((token: string) => FixRowsClient) | null;
};

const Row = z.strictObject({
  repo: z.string().max(200).regex(/^[\w.-]+\/[\w.-]+$/, 'owner/name'),
  pull: z.number().int().min(1).max(2 ** 31 - 1).nullable().default(null),
  changes: Line(2000),
  reproduction: Line(2000).nullable().default(null),
  guard: Line(2000).nullable().default(null),
});

const Push = z.strictObject({
  productKey: z.string().max(40).regex(/^[a-z][a-z0-9]*(-[a-z][a-z0-9]*)*$/, 'a product key such as mobile'),
  new: z.literal(true).optional(),
  bug: z.number().int().min(1).max(2 ** 31 - 1).optional(),
  repo: z.string().max(200).regex(/^[\w.-]+\/[\w.-]+$/, 'owner/name').optional(),
  check: z.literal(true).optional(),
  title: Line(200),
  record: z.string().min(1).max(200_000),
  rows: z.array(Row).max(50),
}).refine((push) => push.check === true || (push.new === true) !== (push.bug !== undefined), {
  message: 'name where it goes: `new` for the next bug, or `bug` for one', path: ['bug'],
}).refine((push) => push.check === true || push.rows.length > 0, { message: 'a bug carries at least one Fixes row', path: ['rows'] });

/** The database refused or failed; `code` is Postgres's. */
class FixRowsStoreError extends StoreError {}

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
async function pushBug(db: Pick<SupabaseClient, 'rpc'>, push: z.output<typeof Push>): Promise<z.output<typeof Answer>> {
  const { productKey, bug, repo, title, record, rows } = push;
  const { data, error } = await db.rpc('fix_bug_push', { p_key: productKey, p_bug: bug ?? null, p_body: { title, record, rows }, p_repo: repo ?? null });
  if (error) throw new FixRowsStoreError('push the bug', error.code, error.message);
  const parsed = parseRow(Answer, data, 'fixes/rows: fix_bug_push');
  if (!parsed.ok) throw new FixRowsStoreError('push the bug', undefined, parsed.error);
  return parsed.value;
}

/** The status each refusal of the database answers with; any other failure is a 500. */
const REFUSAL_STATUS: Readonly<Record<string, number>> = { '42501': 403, '22023': 400, '23514': 400, P0002: 404 };

/** The pushed rows naming a repository outside the product, by name, one line each. */
function outside(push: z.output<typeof Push>, product: { name: string; repositories: Array<{ repository: string }> }): string[] {
  const owned = new Set(product.repositories.map((r) => r.repository.toLowerCase()));
  const names = product.repositories.map((r) => r.repository).join(', ');
  return push.rows.flatMap((row, at) => owned.has(row.repo.toLowerCase()) ? [] : [`Fixes row ${at + 1}: ${row.repo} is not a repository of product ${product.name} (${names}).`]);
}

export async function fixRowsPush(request: Request, deps: FixRowsDeps): Promise<Response> {
  const received = await receivePush(request, deps.connect, {
    unavailable: 'Bug records are not available here: this deployment has no database.',
    maxBytes: MAX_PUSH_BYTES,
  });
  if (received instanceof Response) return received;
  const push = bodyOf(Push, received.sent, 'A bug push');
  if ('problem' in push) return refuse(400, push.problem);
  const client = received.client();
  try {
    const product = await readProductRepositories(client, push.productKey, push.repo ?? null);
    if (product === null) return refuse(404, `No product keyed ${push.productKey} in your workspaces.`);
    const rejected = outside(push, product);
    if (rejected.length > 0) return refuse(400, `${rejected.join(' ')} Nothing was written.`);
    if (push.check === true) {
      return Response.json({
        checked: true,
        product: { key: product.key, name: product.name },
        repositories: product.repositories.map((r) => ({ repository: r.repository, readOnly: r.readOnly })),
      }, { status: 200, headers: { 'cache-control': 'no-store' } });
    }
    const answer = await pushBug(client, push);
    return Response.json(answer, { status: answer.created ? 201 : 200, headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    if (!(error instanceof FixRowsStoreError) && !(error instanceof RoadmapStoreError)) throw error;
    const status = error.code === undefined ? undefined : REFUSAL_STATUS[error.code];
    if (status === undefined) {
      console.error(`fixes: ${error.message}`);
      return refuse(500, 'The bug could not be recorded. Try again.');
    }
    return refuse(status, error.reason);
  }
}
