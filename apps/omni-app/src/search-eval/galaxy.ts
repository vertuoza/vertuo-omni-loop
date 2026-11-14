// The search eval jobs' galaxy ports (PRD omni-loop-8 s4, plan "Shared ground"): the two signed routes galaxy
// answers, since only galaxy holds a workspace's sealed Jev key and its search.
//
//   POST /api/search/relevant     {workspaceId, productId, question, entryIds}   (at most 20 ids)
//                                 -> {verdicts: [{entryId, relevant: true | false | null, confidence}]}
//                                 `null` for every id when the decision is off, the workspace has no Jev key or
//                                 Jev did not answer
//   POST /api/search/eval-search  {workspaceId, productId, question}
//                                 -> {ids, mode}: the product's `search_knowledge` as the MCP runs it, top 10,
//                                 never logged in `mcp_search_log`
//
// Both are signed as `POST /api/search/categorize` is (../search-categorize/galaxy.ts): an HMAC-SHA256 over the exact
// body in x-omni-signature-256, under SEARCH_CATEGORIZE_SECRET, which both apps hold. A port throws when galaxy
// cannot be asked or answers out of shape, and answers null with no secret. The question is never logged, and an
// error names a status or a field, never the question (L-GDPR-2).
import { z } from 'zod';
import { STAGE_SIGNATURE_HEADER, signStageEvent, stageEventUrl } from '../stage-forward/stage-forward.ts';

/** Galaxy's routes allow themselves a minute; a run asks many questions, so one slow answer is cut sooner. */
const TIMEOUT_MS = 20_000;
/** The most entries one `relevant` call judges. */
export const RELEVANT_MAX = 20;

/** What the promotion asks galaxy to judge: the question and the entries to weigh against it. */
export type RelevantAsk = { workspaceId: string; productId: string; question: string; entryIds: readonly string[] };
/** One entry's verdict: whether it answers the question, null when galaxy kept none. */
export type Verdict = { entryId: string; relevant: boolean | null; confidence: number };
/** Galaxy's verdicts for the entries of a question, or null when galaxy could not be asked (no secret). */
export type Judge = (ask: RelevantAsk) => Promise<Verdict[] | null>;

/** What a run asks galaxy to search: a question of a product. */
export type EvalSearchAsk = { workspaceId: string; productId: string; question: string };
/** The entry ids a search ranked, best first, or null when galaxy could not be asked (no secret). */
export type EvalSearcher = (ask: EvalSearchAsk) => Promise<string[] | null>;

const VerdictsSchema = z.looseObject({
  verdicts: z.array(z.looseObject({ entryId: z.string().min(1), relevant: z.boolean().nullable(), confidence: z.number().min(0).max(1).nullable().optional() })),
});
const SearchSchema = z.looseObject({ ids: z.array(z.string().min(1)) });

type Post = (url: string, init: RequestInit) => Promise<Response>;

const host = (galaxyUrl: string): string => new URL(stageEventUrl(galaxyUrl)).origin;

/** Galaxy's relevant route, on galaxy's host (`GALAXY_URL` or its default), as the stage events. */
export const relevantUrl = (galaxyUrl: string): string => `${host(galaxyUrl)}/api/search/relevant`;
/** Galaxy's eval-search route. */
export const evalSearchUrl = (galaxyUrl: string): string => `${host(galaxyUrl)}/api/search/eval-search`;

/** One signed POST: the parsed answer, or the refusal thrown under `name`. */
async function signedPost({ name, url, secret, body, post, timeoutMs }: { name: string; url: string; secret: string; body: unknown; post: Post; timeoutMs: number }): Promise<unknown> {
  const text = JSON.stringify(body);
  const headers = { 'content-type': 'application/json', [STAGE_SIGNATURE_HEADER]: signStageEvent(secret, text) };
  let response: Response;
  try {
    response = await post(url, { method: 'POST', body: text, headers, signal: AbortSignal.timeout(timeoutMs) });
  } catch {
    throw new Error(`${name}: galaxy could not be reached`);
  }
  if (!response.ok) throw new Error(`${name}: galaxy answered ${String(response.status)}`);
  return response.json().catch(() => null);
}

type PortOptions = { url: string; secret: string | undefined; fetch?: Post; timeoutMs?: number };

/** The relevant port bound to galaxy's route and the shared secret; with no secret nothing is judged. */
export function galaxyJudge({ url, secret, fetch: post = fetch, timeoutMs = TIMEOUT_MS }: PortOptions): Judge {
  return async ({ workspaceId, productId, question, entryIds }) => {
    if (!secret) return null;
    if (entryIds.length === 0) return [];
    if (entryIds.length > RELEVANT_MAX) throw new Error(`relevant: at most ${String(RELEVANT_MAX)} entries a call`);
    const reply = VerdictsSchema.safeParse(await signedPost({ name: 'relevant', url, secret, body: { workspaceId, productId, question, entryIds }, post, timeoutMs }));
    if (!reply.success) throw new Error('relevant: galaxy answered out of shape');
    return reply.data.verdicts.map((v) => ({ entryId: v.entryId, relevant: v.relevant, confidence: v.confidence ?? 0 }));
  };
}

/** The eval-search port bound to galaxy's route and the shared secret; with no secret nothing is searched. */
export function galaxyEvalSearcher({ url, secret, fetch: post = fetch, timeoutMs = TIMEOUT_MS }: PortOptions): EvalSearcher {
  return async ({ workspaceId, productId, question }) => {
    if (!secret) return null;
    const reply = SearchSchema.safeParse(await signedPost({ name: 'eval-search', url, secret, body: { workspaceId, productId, question }, post, timeoutMs }));
    if (!reply.success) throw new Error('eval-search: galaxy answered out of shape');
    return reply.data.ids;
  };
}
