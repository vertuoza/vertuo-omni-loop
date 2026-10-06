// The business read of the kit's contract (PRD 748's spec, "The read"), as a plain function of a
// Request, so it is tested with a stubbed Supabase client and app/api/business/route.ts stays one line:
//
//   GET /api/business?repo=<owner/name>   → 200 {state, business, product, claims, personas}   (decision 14, PRD 799)
//   POST /api/business/citations {repo, ids, by, ref?}   → 200 {cited}   the citation log (decision 6)
//   POST /api/business/claims {repo, kind, value, state, ref}   → 200 {id, state, added}   an answered claim (PRD 822)
//
// The kit calls it with the terminal's sign-in. Only confirmed and contradicted claims come back, each
// with its `state` (decision 15, and PRD 774's decision 12): the database's business_for_repo() picks
// them, and the answer is checked against the contract's schema before it leaves. `state` is `none` when the workspace has no business or no confirmed claim for the
// repository; the kit's own states (`no-sign-in`, `unreachable`, `refused`) are never the server's.
//
// Refusals follow ADR-0029, each `{error}` in plain words: 400 a malformed query, 401 no valid bearer
// token, 403 a repository outside the caller's workspaces (the database's reason, and the App's install
// link after its install hint), 404 a claim id the business does not hold (the citation log), 413 a
// citation too large, 503 no database here or the sign-in service down, 500 the database failed.
import type { SupabaseClient } from '@supabase/supabase-js';
import { authenticate, withInstallLink, type TokenCheck } from '../ask/auth';
import { ANSWER_KINDS, ANSWER_STATES, businessReader, BusinessStoreError, type AnswerKind, type AnswerState } from './read';
import { refuse, reply } from './reply';
import { isOneOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';

/** A Supabase client acting as one access token: the Auth server's check and the functions. */
export type BusinessClient = TokenCheck & Pick<SupabaseClient, 'rpc'>;

export type BusinessDeps = {
  /** A client acting as the given access token, or null when no database is configured. */
  connect: ((token: string) => BusinessClient) | null;
  /** The App's install link, put after the database's install hint; null or missing: the hint alone. */
  installLink?: string | null;
};

const REPO = /^[\w.-]+\/[\w.-]+$/;
/** The largest citation call: the database takes 1 to 100 ids. */
const MAX_BODY_BYTES = 16 * 1024;

type Citation = { repo: string; ids: string[]; by: string; ref: string | null };
type Answer = { repo: string; kind: AnswerKind; value: string; state: AnswerState; ref: string };

function refusal(error: BusinessStoreError, deps: BusinessDeps): Response {
  if (error.code === '42501') return refuse(403, withInstallLink(error.reason, deps.installLink));
  if (error.code === '22023') return refuse(400, error.reason);
  if (error.code === 'P0002') return refuse(404, error.reason);
  console.error(`business: ${error.message}`);
  return refuse(500, 'The business database could not answer. Try again.');
}

/** A reader acting as the caller, or the Response that refuses them. */
async function readerFor(request: Request, deps: BusinessDeps): Promise<ReturnType<typeof businessReader> | Response> {
  if (!deps.connect) return refuse(503, 'The business is not available here: this deployment has no database.');
  const auth = await authenticate(request.headers.get('authorization'), deps.connect);
  if (!auth.ok) return refuse(auth.status, auth.error);
  return businessReader(deps.connect(auth.caller.token));
}

/** `work`'s answer, or the refusal of a database that refused or failed. */
async function answer(deps: BusinessDeps, work: () => Promise<unknown>): Promise<Response> {
  try {
    return reply(200, await work());
  } catch (error) {
    if (!(error instanceof BusinessStoreError)) throw error;
    return refusal(error, deps);
  }
}

const isRepo = (repo: unknown): repo is string => typeof repo === 'string' && repo.length <= 200 && REPO.test(repo);

/** What agents in `?repo=` read of their workspace's business. */
export async function readBusiness(request: Request, deps: BusinessDeps): Promise<Response> {
  const reader = await readerFor(request, deps);
  if (reader instanceof Response) return reader;
  const repo = new URL(request.url).searchParams.get('repo') ?? '';
  if (!isRepo(repo)) return refuse(400, '`repo` must be the repository as owner/name.');
  return answer(deps, () => reader.forRepo(repo));
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isClaimId = (id: unknown) => typeof id === 'string' && id.length > 0 && id.length <= 40;
const isIdList = (ids: unknown): ids is string[] =>
  Array.isArray(ids) && ids.length >= 1 && ids.length <= 100 && ids.every(isClaimId);
const isSkill = (by: unknown): by is string => typeof by === 'string' && by.trim() !== '' && by.length <= 80;
const isRef = (ref: unknown): ref is string | null | undefined => ref === undefined || ref === null || typeof ref === 'string';
const refOf = (ref: string | null | undefined) => (typeof ref === 'string' && ref.trim() ? ref : null);

/** The citation a call sent, or what is wrong with its fields. The ids' own shape is the database's to judge. */
function citationOf(value: unknown): Citation | string {
  if (!isRecord(value)) return 'The body must be a JSON object.';
  const { repo, ids, by, ref } = value;
  if (!isRepo(repo)) return '`repo` must be the repository as owner/name.';
  if (!isIdList(ids)) return '`ids` must be 1 to 100 claim ids, like rival#4.';
  if (!isSkill(by)) return '`by` must name the skill that cited them.';
  if (!isRef(ref)) return '`ref`, when given, must be text.';
  return { repo, ids, by, ref: refOf(ref) };
}

/** The JSON a body carries, or undefined when it is not JSON. */
function parsed(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** The JSON body a call sent, or the refusal of one over the cap. */
async function bodyOf(request: Request, what: string): Promise<{ json: unknown } | Response> {
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return refuse(413, `${what} carries ${MAX_BODY_BYTES / 1024} KiB at most.`);
  return { json: parsed(text) };
}

/** Appends to the citation log the claims an agent in `repo` cited, by which skill, in which run. */
export async function citeClaims(request: Request, deps: BusinessDeps): Promise<Response> {
  const reader = await readerFor(request, deps);
  if (reader instanceof Response) return reader;
  const body = await bodyOf(request, 'A citation');
  if (body instanceof Response) return body;
  const citation = citationOf(body.json);
  if (typeof citation === 'string') return refuse(400, citation);
  return answer(deps, async () => ({ cited: await reader.cite(citation.repo, citation.ids, citation.by, citation.ref) }));
}

const isLine = (max: number) => (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== '' && value.length <= max && !/[\r\n]/.test(value);
const isValue = isLine(80);
const isReceipt = isLine(200);
const isKind = (kind: unknown): kind is AnswerKind => isOneOf(ANSWER_KINDS, kind);
const isAnswerState = (state: unknown): state is AnswerState => isOneOf(ANSWER_STATES, state);

/** The answered claim a call sent, or what is wrong with its fields. A size's own shape is the database's to judge. */
function answerOf(body: unknown): Answer | string {
  if (!isRecord(body)) return 'The body must be a JSON object.';
  const { repo, kind, value, state, ref } = body;
  if (!isRepo(repo)) return '`repo` must be the repository as owner/name.';
  if (!isKind(kind)) return `\`kind\` must be one of ${ANSWER_KINDS.join(', ')}.`;
  if (!isAnswerState(state)) return `\`state\` must be ${ANSWER_STATES.join(' or ')}.`;
  if (!isValue(value)) return '`value` must be 1 to 80 characters, on one line.';
  if (!isReceipt(ref)) return '`ref` must say which skill and run gave the answer, up to 200 characters on one line.';
  return { repo, kind, value: value.trim(), state, ref: ref.trim() };
}

/** Stores a claim a person gave as an answer in a skill run in `repo` (PRD 822): `proposed` when it
 * overrules the voice, for a member to confirm, or `confirmed` when it answers the gap question. */
export async function addClaim(request: Request, deps: BusinessDeps): Promise<Response> {
  const reader = await readerFor(request, deps);
  if (reader instanceof Response) return reader;
  const body = await bodyOf(request, 'A claim');
  if (body instanceof Response) return body;
  const claim = answerOf(body.json);
  if (typeof claim === 'string') return refuse(400, claim);
  return answer(deps, () => reader.answer(claim.repo, claim.kind, claim.value, claim.state, claim.ref));
}
