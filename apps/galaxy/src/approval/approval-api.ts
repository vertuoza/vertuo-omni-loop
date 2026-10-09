// The approval of a PRD born on the server (PRD 1299 s2), as plain functions of a Request, so they are
// tested with a stubbed Supabase client and the route stays one line each:
//
//   GET  /api/dossiers/approval?repo=<owner/name>&prd=<n>  → 200 {url, approval}
//   POST /api/dossiers/approval {dossier}                  → 201 {url, approval}
//
// `approval` is the approval in force, or null when nobody approved the PRD yet:
// {approver: {login, member}, approvedAt, files: [{kind, path, sha256, versionId, content?}]}, the shape
// the kit reads (kit/lib/approval/approval.ts; settled item s4-02-approval-route-shape). `url` is the
// PRD page. `member` is whether the approver belongs to the dossier's workspace today; `content` is the
// approved text, so the kit tells a whitespace-only drift from a change of content.
//
// The kit reads with the terminal's sign-in (a bearer token). The page approves with the person's own
// session; a POST that carries a bearer token approves as that sign-in instead. Both run as the caller:
// dossier_approve() and dossier_approval() (supabase/migrations/20261121090000_approvals.sql) check who
// calls. Once an approval is written, the PRD's issue gets its approved label (./label.ts): a label that
// cannot be added is logged and never undoes the approval, which is the record.
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
};

const REPO = /^[\w.-]+\/[\w.-]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRD_MAX = 2 ** 31 - 1;
const MAX_BODY_BYTES = 4 * 1024;

const NO_DATABASE = 'Approvals are not available here: this deployment has no database.';
const NOT_READ = 'The approval could not be read. Try again.';
const NOT_WRITTEN = 'The approval could not be written. Try again.';

const text = z.string().min(1);

/** What dossier_approval() answers: the dossier and its approval in force, or none yet. */
const InForce = z.object({
  dossier: z.string().regex(UUID),
  approval: z.object({
    approver: z.object({ login: text, member: z.boolean() }),
    approvedAt: z.string().refine((at) => !Number.isNaN(Date.parse(at))),
    files: z.array(z.object({ kind: text, path: text, sha256: text, versionId: text, content: z.string().nullable() })),
  }).nullable(),
});

/** What dossier_approve() answers: the approval's id, and the PRD it approved. */
const Approved = z.object({ id: text, repo: z.string().regex(REPO), prd: PrdNumberSchema });

/** The approval in force as the route answers it: the PRD page's link, the time in ISO 8601, and a
 * file's approved text only when the database still holds it. */
function answerOf(request: Request, read: z.infer<typeof InForce>) {
  const url = `${callerOrigin(request)}/prd/${read.dossier}`;
  if (!read.approval) return { url, approval: null };
  const { approver, approvedAt, files } = read.approval;
  return {
    url,
    approval: {
      approver,
      approvedAt: new Date(approvedAt).toISOString(),
      files: files.map(({ content, ...file }) => (content === null ? file : { ...file, content })),
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

/** The approval in force of PRD `prd` of `repo`, as `db`'s caller reads it, or the Response that says why not. */
async function inForce(request: Request, db: ApprovalDb, repo: string, prd: PrdNumber, deps: ApprovalDeps): Promise<Response> {
  const answer = await db.rpc('dossier_approval', { p_repo: repo, p_prd: prd });
  if (answer.error) return refusalOf(answer.error, deps, NOT_READ);
  if (answer.data === null) return refuse(404, `No dossier for PRD #${prd} of ${repo}.`);
  const read = InForce.safeParse(answer.data);
  if (!read.success) {
    console.error(`approval: the database answered out of shape for ${repo} #${prd}`);
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

/** GET: the approval in force, for the kit's `omni approval`. */
export async function answerApproval(request: Request, deps: ApprovalDeps): Promise<Response> {
  if (!deps.connect) return refuse(503, NO_DATABASE);
  const auth = await authenticate(request.headers.get('authorization'), deps.connect);
  if (!auth.ok) return refuse(auth.status, auth.error);
  const query = new URL(request.url).searchParams;
  const repo = query.get('repo') ?? '';
  if (repo.length > 200 || !REPO.test(repo)) return refuse(400, '`repo` must be the repository as owner/name.');
  const prd = prdOf(query.get('prd'));
  if (prd === null) return refuse(400, "`prd` is the PRD's number.");
  return inForce(request, deps.connect(auth.caller.token), repo.toLowerCase(), prd, deps);
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
  const { repo, prd } = approved.data;
  try {
    await deps.label(repo, prd);
  } catch (error) {
    console.error(`approval: PRD #${prd} of ${repo} is approved, but its label was not added: ${error instanceof Error ? error.message : String(error)}`);
  }
  const read = await inForce(request, db, repo, prd, deps);
  return read.status === 200 ? reply(201, await read.json()) : read;
}
