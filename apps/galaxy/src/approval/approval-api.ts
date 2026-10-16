// The approval of a PRD born on the server (PRD 1299 s2), as plain functions of a Request, so they are
// tested with a stubbed Supabase client and the route stays one line each:
//
//   GET  /api/dossiers/approval?repo=<owner/name>&prd=<n>  → 200 {url, approval}
//   GET  /api/dossiers/approval?prd=<key>-<n>[&repo=…]     → 200 {url, approval}
//   POST /api/dossiers/approval {dossier}                  → 201 {url, approval}
//
// A product PRD (PRD 1548) has no repository: it is found by its id, `mobile-12`, the repository only
// saying which workspace when two of the caller's hold the product's key (settled item
// s1-02-a-key-two-workspaces-share). It has no issue either, so approving it labels nothing.
//
// `approval` is the approval in force, or null when nobody approved the PRD yet:
// {approver: {login, member}, approvedAt, files: [{kind, path, sha256, versionId, content?}]}, the shape
// the kit reads (kit/lib/approval/approval.ts; settled item s4-02-approval-route-shape). `url` is the
// PRD page. `member` is whether the approver belongs to the dossier's workspace today; `content` is the
// approved text, so the kit tells a whitespace-only drift from a change of content. Since PRD 1322 the
// approval carries `voids`, [{pusher, kind, from, to, voidedAt}], the pushes that changed a pinned file
// since (supabase/migrations/20261126090000_approval_voiding.sql): with one, it is no longer in force,
// and the kit reads it as drifted.
//
// The kit reads with the terminal's sign-in (a bearer token). The page approves with the person's own
// session; a POST that carries a bearer token approves as that sign-in instead. Both run as the caller:
// dossier_approve() and dossier_approval() (supabase/migrations/20261123090000_approvals.sql) check who
// calls. Once an approval is written, the PRD's issue gets its approved label (./label.ts): a label that
// cannot be added is logged and never undoes the approval, which is the record. A product PRD's approval
// instead tells the GitHub App, with one signed server event (PRD 1548 s4, ../server-event/), which re-posts
// `omni/approved` on its open target pull requests; telling never undoes the approval either.
//
// Refusals follow ADR-0029, each `{error}` in plain words: 400 a malformed query or body (or the
// database's own: a ◇ dossier, a draft, a missing spec, plan or before/after), 401 no valid sign-in, 403
// not a member of the dossier's workspace, 404 no such dossier, 503 no database here, 500 the database
// failed or answered out of shape.
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { type PrdNumber, PrdNumberSchema } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { authenticate, callerOrigin, withInstallLink, type TokenCheck } from '../ask/auth';
import { refuse, reply } from '../business-api/reply';
import type { ServerEvent } from '../server-event/server-event.service';

/** A Supabase client acting as the caller: the functions. */
export type ApprovalDb = Pick<SupabaseClient, 'rpc'>;
/** A client acting as one access token: the Auth server's check and the functions. */
export type ApprovalClient = TokenCheck & ApprovalDb;

export type ApprovalDeps = {
  /** A client acting as the given access token, or null when no database is configured. */
  connect: ((token: string) => ApprovalClient) | null;
  /** The signed-in person's own session (the page), or null when nobody is signed in. */
  session: () => Promise<ApprovalDb | null>;
  /** Adds the approved label to PRD `prd`'s issue in `repo`; may throw. */
  label: (repo: string, prd: PrdNumber) => Promise<void>;
  /** The App's install link, put after the database's install hint; null or missing: the hint alone. */
  installLink?: string | null;
  /** Tells the GitHub App a product PRD was approved (PRD 1548 s4); never throws. Missing: the App is not told. */
  tellApp?: (event: ServerEvent) => Promise<unknown>;
  /** The clock the server event is dated by. */
  now?: () => Date;
};

const REPO = /^[\w.-]+\/[\w.-]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRD_MAX = 2 ** 31 - 1;
const MAX_BODY_BYTES = 4 * 1024;

const NO_DATABASE = 'Approvals are not available here: this deployment has no database.';
const NOT_READ = 'The approval could not be read. Try again.';
const NOT_WRITTEN = 'The approval could not be written. Try again.';
const NOT_A_PRD = "`prd` is the PRD's number, or a product PRD's id like mobile-12.";

const text = z.string().min(1);

/** What dossier_approval() answers: the dossier and its approval in force, or none yet. */
const InForce = z.object({
  dossier: z.string().regex(UUID),
  approval: z.object({
    approver: z.object({ login: text, member: z.boolean() }),
    approvedAt: z.string().refine((at) => !Number.isNaN(Date.parse(at))),
    files: z.array(z.object({ kind: text, path: text, sha256: text, versionId: text, content: z.string().nullable() })),
    voids: z.array(z.object({ pusher: text, kind: text, from: text, to: text, voidedAt: z.string().refine((at) => !Number.isNaN(Date.parse(at))) })).optional(),
  }).nullable(),
});

/** A product PRD's id, `<key>-<n>`: the product's key (lowercase kebab-case, each part starting with a letter), then its number. */
const PRODUCT_PRD = /^([a-z][a-z0-9]*(?:-[a-z][a-z0-9]*)*)-([1-9]\d{0,9})$/;
const KEY_MAX = 40;

/** A product roadmap's id, `<key>-R<n>`. */
const ROADMAP_ID = /^[a-z][a-z0-9]*(?:-[a-z][a-z0-9]*)*-R[1-9]\d{0,9}$/;

/** Which PRD a call names: a repository's by its number, or a product's by its key and number. */
export type PrdKey = { repo: string; prd: PrdNumber; product: null } | { repo: string; seq: number; product: string };

/** A product PRD's key and number, from its id; null when the id is out of shape. */
function productPrdOf(id: string): { product: string; seq: number } | null {
  const match = PRODUCT_PRD.exec(id);
  if (!match) return null;
  const [, product = '', digits = ''] = match;
  const seq = Number(digits);
  return product.length <= KEY_MAX && seq <= PRD_MAX ? { product, seq } : null;
}

/** What dossier_approve() answers: the approval's id, and the PRD it approved, a product PRD by its id (settled item s1-05). */
const Approved = z.union([
  z.object({ id: text, repo: z.string().regex(REPO), prd: PrdNumberSchema }),
  z.object({ id: text, repo: z.null(), prd: z.null(), prdId: z.string().refine((id) => productPrdOf(id) !== null) }),
  // A product roadmap (PRD 2011): approved by its dossier, answered by its id `<key>-R<n>`.
  z.object({ id: text, repo: z.null(), prd: z.null(), roadmap: z.string().regex(ROADMAP_ID) }),
]);

/** The approval in force as the route answers it: the PRD page's link, the time in ISO 8601, and a
 * file's approved text only when the database still holds it. */
function answerOf(request: Request, read: z.infer<typeof InForce>) {
  const url = `${callerOrigin(request)}/prd/${read.dossier}`;
  if (!read.approval) return { url, approval: null };
  const { approver, approvedAt, files, voids } = read.approval;
  return {
    url,
    approval: {
      approver,
      approvedAt: new Date(approvedAt).toISOString(),
      files: files.map(({ content, ...file }) => (content === null ? file : { ...file, content })),
      ...(voids ? { voids: voids.map((v) => ({ ...v, voidedAt: new Date(v.voidedAt).toISOString() })) } : {}),
    },
  };
}

/** The database's refusal as the route answers it; anything else is a 500, never a guess. */
function refusalOf(error: { code?: string; message?: string }, deps: ApprovalDeps, failed: string): Response {
  const { code, message } = error;
  if (code === '42501') return refuse(403, withInstallLink(message || 'Not a member of the workspace that owns this PRD.', deps.installLink));
  if (code === 'P0002') return refuse(404, message || 'No such dossier.');
  if (code === '22023') return refuse(400, message || failed);
  console.error(`approval: ${message || code || 'the database failed'}`);
  return refuse(500, failed);
}

/** The PRD `key` names, as a person reads it. */
const nameOf = (key: PrdKey): string => (key.product === null ? `#${key.prd} of ${key.repo}` : `${key.product}-${key.seq}`);

/** The approval in force of the PRD `key` names, as `db`'s caller reads it, or the Response that says why not
 * (`key` itself, when the query was refused). */
async function inForce(request: Request, db: ApprovalDb, key: PrdKey | Response, deps: ApprovalDeps): Promise<Response> {
  if (key instanceof Response) return key;
  const args = key.product === null ? { p_repo: key.repo, p_prd: key.prd } : { p_repo: key.repo, p_prd: key.seq, p_product: key.product };
  const answer = await db.rpc('dossier_approval', args);
  if (answer.error) return refusalOf(answer.error, deps, NOT_READ);
  if (answer.data === null) return refuse(404, `No dossier for PRD ${nameOf(key)}.`);
  const read = InForce.safeParse(answer.data);
  if (!read.success) {
    console.error(`approval: the database answered out of shape for PRD ${nameOf(key)}`);
    return refuse(500, NOT_READ);
  }
  return reply(200, answerOf(request, read.data));
}

/** A PRD's number as a query sends it: digits only, 1 to 2³¹−1; or null. */
function prdOf(value: string | null): PrdNumber | null {
  if (value === null || !/^\d{1,10}$/.test(value)) return null;
  const parsed = PrdNumberSchema.safeParse(Number(value));
  return parsed.success && parsed.data <= PRD_MAX ? parsed.data : null;
}

/** The PRD a GET's query names, `?repo=<owner/name>&prd=<n>` or `?prd=<key>-<n>[&repo=…]`, its
 * repository in lower case; or the 400 that refuses it. Shared with the App's judge route
 * (src/approvals/judge.controller.ts, PRD 1612), which reads a repository's PRD only. */
export function prdQueryOf(request: Request): PrdKey | Response {
  const query = new URL(request.url).searchParams;
  const repo = query.get('repo') ?? '';
  const named = query.get('prd') ?? '';
  const product = productPrdOf(named);
  const badRepo = () => refuse(400, '`repo` must be the repository as owner/name.');
  if (product) {
    if (repo !== '' && (repo.length > 200 || !REPO.test(repo))) return badRepo();
    return { repo: repo.toLowerCase(), ...product };
  }
  if (/[^\d.]/.test(named)) return refuse(400, NOT_A_PRD);
  if (repo.length > 200 || !REPO.test(repo)) return badRepo();
  const prd = prdOf(named === '' ? null : named);
  if (prd === null) return refuse(400, "`prd` is the PRD's number.");
  return { repo: repo.toLowerCase(), prd, product: null };
}

/** GET: the approval in force, for the kit's `omni approval`. */
export async function answerApproval(request: Request, deps: ApprovalDeps): Promise<Response> {
  if (!deps.connect) return refuse(503, NO_DATABASE);
  const auth = await authenticate(request.headers.get('authorization'), deps.connect);
  if (!auth.ok) return refuse(auth.status, auth.error);
  return inForce(request, deps.connect(auth.caller.token), prdQueryOf(request), deps);
}

/** The caller of a POST: its bearer token's client when it carries one, else the page's session. */
async function callerOf(request: Request, deps: ApprovalDeps & { connect: NonNullable<ApprovalDeps['connect']> }): Promise<ApprovalDb | Response> {
  const header = request.headers.get('authorization');
  if (header) {
    const auth = await authenticate(header, deps.connect);
    return auth.ok ? deps.connect(auth.caller.token) : refuse(auth.status, auth.error);
  }
  return (await deps.session()) ?? refuse(401, 'Sign in first to approve a PRD.');
}

/** The dossier a POST names, or the Response that refuses the body. */
async function dossierOf(request: Request): Promise<string | Response> {
  const body = await request.text();
  const notObject = () => refuse(400, 'The body must be a JSON object.');
  if (new TextEncoder().encode(body).length > MAX_BODY_BYTES) return notObject();
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    return notObject();
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return notObject();
  const parsed = z.object({ dossier: z.string().regex(UUID) }).safeParse(value);
  return parsed.success ? parsed.data.dossier : refuse(400, "`dossier` is the id of the PRD's dossier.");
}

/** The PRD dossier_approve() says it approved: a repository's, or a product's by its id (no repository hint). */
function keyOf(approved: Exclude<z.infer<typeof Approved>, { roadmap: string }>): PrdKey {
  if (approved.repo !== null) return { repo: approved.repo, prd: approved.prd, product: null };
  const { product, seq } = productPrdOf(approved.prdId) ?? { product: '', seq: 0 };
  return { repo: '', seq, product };
}

/** POST: the caller approves the dossier, its issue is labelled, and the approval in force answers. */
export async function approveDossier(request: Request, deps: ApprovalDeps): Promise<Response> {
  const { connect } = deps;
  if (!connect) return refuse(503, NO_DATABASE);
  const db = await callerOf(request, { ...deps, connect });
  if (db instanceof Response) return db;
  const dossier = await dossierOf(request);
  if (dossier instanceof Response) return dossier;
  const answer = await db.rpc('dossier_approve', { p_dossier: dossier });
  if (answer.error) return refusalOf(answer.error, deps, NOT_WRITTEN);
  const approved = Approved.safeParse(answer.data);
  if (!approved.success) {
    console.error(`approval: dossier_approve() answered out of shape for ${dossier}`);
    return refuse(500, NOT_WRITTEN);
  }
  // A product roadmap has no issue to label and no target pull request to tell the App of: its approval is the
  // record, and the roadmap's page (dossier_approval() finds PRDs only) reads it from the approvals table.
  if ('roadmap' in approved.data) return reply(201, { url: `${callerOrigin(request)}/roadmaps/${dossier}`, roadmap: approved.data.roadmap, approval: { id: approved.data.id } });
  const key = keyOf(approved.data);
  if (key.product === null) {
    try {
      await deps.label(key.repo, key.prd);
    } catch (error) {
      console.error(`approval: PRD #${key.prd} of ${key.repo} is approved, but its label was not added: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else {
    await deps.tellApp?.({ event: 'approved', dossier, at: (deps.now?.() ?? new Date()).toISOString() });
  }
  const read = await inForce(request, db, key, deps);
  return read.status === 200 ? reply(201, await read.json()) : read;
}
