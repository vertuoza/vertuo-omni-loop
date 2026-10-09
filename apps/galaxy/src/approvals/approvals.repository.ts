import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { type PrdNumber, PrdNumberSchema } from 'vertuo-omni-plan/kit/lib/ids.ts';
import type { Database } from '../../../../supabase/database.types.ts';

// The approvals' storage (PRD 1322 s2): the only file of this folder that reaches Supabase. It calls the
// database's functions (supabase/migrations/20261125090000_approval_requests.sql) and parses what they
// answer; it holds no rule. Two clients:
//
// - as the caller (a terminal's access token, or the page's session), so the database checks who calls:
//   approval_request() asks a PRD's approvers, approval_requests_waiting() reads the caller's bell;
// - as the service role, which alone reads how each asked person is reached (approval_recipients()) and
//   removes a device its push service says is gone.
//
// A database refusal comes back as its code and message; an answer out of shape as the code `shape`.

/** A Supabase client acting as the caller: the functions. */
type CallerDb = Pick<SupabaseClient, 'rpc'>;
/** The service role's client: the functions and the subscriptions table. */
type ServiceDb = Pick<SupabaseClient, 'rpc' | 'from'>;

/** Why the database said no: its code (42501, P0002, 22023…, or `shape`) and message. */
export type Refusal = { code: string | null; message: string | null };

/** A read: its value, or the refusal. */
export type Answer<T> = { ok: true; value: T } | { ok: false; refusal: Refusal };

const UUID = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const text = z.string().min(1);
const at = z.string().refine((value) => !Number.isNaN(Date.parse(value)));

/** What approval_request() answers: the request recorded, who it asked, and what a notification shows. */
const Requested = z.object({
  id: UUID,
  dossier: UUID,
  repo: text,
  prd: PrdNumberSchema,
  title: z.string(),
  kind: z.enum(['asked', 're-asked']),
  askedAt: at,
  product: text.nullable(),
  author: text,
  nobodyElse: z.boolean(),
  asked: z.array(z.object({ user: UUID, login: text, name: text.nullable() })),
  files: z.array(z.object({ kind: text, sha256: text })),
  spec: z.string().nullable(),
});

/** A request recorded, as approval_request() answers it. */
export type Requested = z.infer<typeof Requested>;

/** One request waiting on the caller, as approval_requests_waiting() lists it. */
const Waiting = z.array(z.object({ id: UUID, dossier: UUID, repo: text, prd: PrdNumberSchema, title: z.string(), askedAt: at }));

/** How each asked person is reached, as approval_recipients() answers it. */
const Recipients = z.array(z.object({
  user: UUID,
  email: text.nullable(),
  devices: z.array(z.object({ id: UUID, endpoint: text, p256dh: text, auth: text })),
}));

type Raw = { data: unknown; error: { code?: string; message?: string } | null };

/** A function's answer parsed by `schema`, or the refusal. */
async function parsed<T>(call: PromiseLike<Raw>, schema: z.ZodType<T>, fn: string): Promise<Answer<T>> {
  const { data, error } = await call;
  if (error) return { ok: false, refusal: { code: error.code ?? null, message: error.message ?? null } };
  const read = schema.safeParse(data);
  return read.success ? { ok: true, value: read.data } : { ok: false, refusal: { code: 'shape', message: `${fn}() answered out of shape` } };
}

/** The caller's side: asking, and the bell. */
export function approvalsRepository(db: CallerDb) {
  return {
    /** Records a request to approve PRD `prd` of `repo`, asking its approvers. */
    request: (repo: string, prd: PrdNumber) => parsed(db.rpc('approval_request', { p_repo: repo, p_prd: prd }), Requested, 'approval_request'),
    /** The requests that wait on the caller, oldest first. */
    waiting: () => parsed(db.rpc('approval_requests_waiting'), Waiting, 'approval_requests_waiting'),
  };
}

export type ApprovalsRepository = ReturnType<typeof approvalsRepository>;

/** The service role's side: how people are reached. */
export function reachRepository(db: ServiceDb) {
  return {
    /** How each person request `request` asked is reached. */
    recipients: (request: string) => parsed(db.rpc('approval_recipients', { p_request: request }), Recipients, 'approval_recipients'),
    /** Removes a device its push service says is gone. Throws when the database refuses. */
    async forget(device: string): Promise<void> {
      const { error } = await db.from('push_subscriptions').delete().eq('id', device);
      if (error) throw new Error(error.message);
    },
  };
}

export type ReachRepository = ReturnType<typeof reachRepository>;

// ── The approval stream's side (PRD 1322 s3) ──────────────────────────────────────
//
// As the caller (a terminal's access token), so row-level security decides what they read: a PRD's
// dossier, its requests, approvals and voids, the players they name and their products' names; and
// Supabase Realtime on the three tables for that dossier, which only says that something landed.

/** A Supabase client acting as the caller: its tables, and Realtime. */
type StreamDb = Pick<SupabaseClient<Database>, 'from' | 'channel' | 'removeChannel' | 'realtime'>;

/** A PRD's approval history, as the stream reads it: requests (with their product's name), approvals
 * and voids, the author (whoever opened the dossier, when anyone did) and the players they name. */
export type ApprovalHistory = {
  dossier: string;
  author: string | null;
  requests: Array<{ id: string; kind: 'asked' | 're-asked'; askedAt: string; askedBy: string; asked: string[]; nobodyElse: boolean; product: string | null }>;
  approvals: Array<{ id: string; approver: string; approvedAt: string; pinned: number }>;
  voids: Array<{ id: string; pusher: string; kind: string; from: string; to: string; voidedAt: string }>;
  people: Array<{ user: string; login: string | null; name: string | null }>;
};

const DossierRows = z.array(z.object({ id: UUID, workspace_id: UUID, opened_by: UUID.nullable() }));
const RequestRows = z.array(z.object({
  id: UUID, kind: z.enum(['asked', 're-asked']), asked_at: at, asked_by: UUID, asked: z.array(UUID), nobody_else: z.boolean(), product_id: UUID.nullable(),
}));
const ApprovalRows = z.array(z.object({ id: UUID, approver_login: text, approved_at: at, files: z.array(z.unknown()) }));
const VoidRows = z.array(z.object({ id: UUID, pusher_login: text, kind: text, from_sha256: text, to_sha256: text, voided_at: at }));
const PlayerRows = z.array(z.object({ user_id: UUID, github_login: z.string().nullable(), display_name: z.string().nullable() }));
const ProductRows = z.array(z.object({ id: UUID, name: text }));

/** The tables whose new rows the stream follows. */
const FOLLOWED: ReadonlyArray<'approval_requests' | 'approvals' | 'approval_voids'> = ['approval_requests', 'approvals', 'approval_voids'];

const none = <T>(): Promise<Answer<T[]>> => Promise.resolve({ ok: true, value: [] });

type Dossier = z.infer<typeof DossierRows>[number];
type Rows = { requests: z.infer<typeof RequestRows>; approvals: z.infer<typeof ApprovalRows>; voids: z.infer<typeof VoidRows> };
type Names = { players: z.infer<typeof PlayerRows>; products: z.infer<typeof ProductRows> };

/** The numbered PRD dossier the caller reads, the latest numbered first; none when there is no such. */
const dossierOf = (db: StreamDb, repo: string, prd: PrdNumber) => parsed(
  db.from('dossiers').select('id, workspace_id, opened_by').eq('home_repo', repo).eq('kind', 'prd').eq('prd', prd)
    .order('numbered_at', { ascending: false, nullsFirst: false }).order('id').limit(1),
  DossierRows, 'dossiers');

/** A dossier's requests, approvals and voids. */
async function rowsOf(db: StreamDb, dossier: string): Promise<Answer<Rows>> {
  const [requests, approvals, voids] = await Promise.all([
    parsed(db.from('approval_requests').select('id, kind, asked_at, asked_by, asked, nobody_else, product_id').eq('dossier_id', dossier), RequestRows, 'approval_requests'),
    parsed(db.from('approvals').select('id, approver_login, approved_at, files').eq('dossier_id', dossier), ApprovalRows, 'approvals'),
    parsed(db.from('approval_voids').select('id, pusher_login, kind, from_sha256, to_sha256, voided_at').eq('dossier_id', dossier), VoidRows, 'approval_voids'),
  ]);
  if (!requests.ok) return requests;
  if (!approvals.ok) return approvals;
  return voids.ok ? { ok: true, value: { requests: requests.value, approvals: approvals.value, voids: voids.value } } : voids;
}

/** The players the dossier and its requests name, in its workspace. */
function playersOf(db: StreamDb, dossier: Dossier, requests: Rows['requests']) {
  const users = [...new Set([dossier.opened_by, ...requests.flatMap((r) => [r.asked_by, ...r.asked])].filter((u): u is string => u !== null))];
  if (!users.length) return none<Names['players'][number]>();
  return parsed(db.from('players').select('user_id, github_login, display_name').eq('workspace_id', dossier.workspace_id).in('user_id', users), PlayerRows, 'players');
}

/** The products the requests name. */
function productsOf(db: StreamDb, requests: Rows['requests']) {
  const ids = [...new Set(requests.flatMap((r) => (r.product_id ? [r.product_id] : [])))];
  if (!ids.length) return none<Names['products'][number]>();
  return parsed(db.from('products').select('id, name').in('id', ids), ProductRows, 'products');
}

/** The players and the products the requests name. */
async function namesOf(db: StreamDb, dossier: Dossier, requests: Rows['requests']): Promise<Answer<Names>> {
  const [players, products] = await Promise.all([playersOf(db, dossier, requests), productsOf(db, requests)]);
  if (!players.ok) return players;
  return products.ok ? { ok: true, value: { players: players.value, products: products.value } } : products;
}

/** The rows read, as the stream's history. */
function historyOf(dossier: Dossier, { requests, approvals, voids }: Rows, { players, products }: Names): ApprovalHistory {
  const productName = new Map(products.map((p) => [p.id, p.name]));
  return {
    dossier: dossier.id,
    author: dossier.opened_by,
    requests: requests.map((r) => ({
      id: r.id, kind: r.kind, askedAt: r.asked_at, askedBy: r.asked_by, asked: r.asked, nobodyElse: r.nobody_else,
      product: productName.get(r.product_id ?? '') ?? null,
    })),
    approvals: approvals.map((a) => ({ id: a.id, approver: a.approver_login, approvedAt: a.approved_at, pinned: a.files.length })),
    voids: voids.map((v) => ({ id: v.id, pusher: v.pusher_login, kind: v.kind, from: v.from_sha256, to: v.to_sha256, voidedAt: v.voided_at })),
    people: players.map((p) => ({ user: p.user_id, login: p.github_login, name: p.display_name })),
  };
}

/** The caller's side of the stream; `token` is their access token, which Realtime needs set apart. */
export function historyRepository(db: StreamDb, token: string) {
  return {
    /** PRD `prd` of `repo`'s approval history, or null when the caller reads no such PRD. */
    async read(repo: string, prd: PrdNumber): Promise<Answer<ApprovalHistory | null>> {
      const found = await dossierOf(db, repo, prd);
      if (!found.ok) return found;
      const [dossier] = found.value;
      if (!dossier) return { ok: true, value: null };
      const rows = await rowsOf(db, dossier.id);
      if (!rows.ok) return rows;
      const names = await namesOf(db, dossier, rows.value.requests);
      return names.ok ? { ok: true, value: historyOf(dossier, rows.value, names.value) } : names;
    },
    /** Calls `nudge` whenever a request, an approval or a void of `dossier` lands, as the caller
     * (Realtime applies their row-level security); answers how to stop following. */
    async watch(dossier: string, nudge: () => void): Promise<() => void> {
      await db.realtime.setAuth(token);
      const channel = db.channel(`approval-stream:${dossier}:${crypto.randomUUID()}`);
      for (const table of FOLLOWED) {
        channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table, filter: `dossier_id=eq.${dossier}` }, () => { nudge(); });
      }
      channel.subscribe();
      return () => { void db.removeChannel(channel); };
    },
  };
}

export type HistoryRepository = ReturnType<typeof historyRepository>;
