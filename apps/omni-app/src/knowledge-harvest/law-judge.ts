// The harvest's law judge port (PRD 1342 s5): the one call to galaxy's `POST /api/laws/judge`, which
// runs the workspace's `law-worth` Jev decision, since only galaxy holds its sealed Jev key.
//
//   request  {repo, state, old, ref}     signed as the constituent judge is (../canon/judge.ts): an
//                                        HMAC-SHA256 over the exact body, `sha256=<hex>` in
//                                        x-omni-signature-256, under LAW_JUDGE_SECRET (shared by both apps).
//                                        `state` is exactly the five fields the kit's `lawQuestions` gives
//                                        (statement, why, principle, domain, prdTitle): galaxy refuses any other
//   reply    {answer, confidence, decidedBy}
//
// Only Jev's answer is handed back (`decidedBy: "jev"`, with its confidence): the kit's writer counts the
// classifier's own `worthALaw` whenever it is given none. Never throws: no secret, a refusal, a reply with
// no verdict, a network failure or galaxy keeping today's answer all come back as `worth: null` with the
// reason, and the harvest carries on with the classifier's answer.
import { z } from 'zod';
import type { LawQuestion } from 'vertuo-omni-plan/kit/lib/knowledge/pipeline.ts';
import type { LawWorth } from 'vertuo-omni-plan/kit/lib/knowledge/write.ts';
import { STAGE_SIGNATURE_HEADER, signStageEvent, stageEventUrl } from '../stage-forward/stage-forward.ts';

const LAW_JUDGE_SECRET_VAR = 'LAW_JUDGE_SECRET';
/** Galaxy's route allows itself a minute. */
const JUDGE_TIMEOUT_MS = 55_000;

/** The reply's verdict: `answer` "true" or "false"; a confidence or a decider of another kind reads as null. */
const VerdictSchema = z.looseObject({
  answer: z.enum(['true', 'false']),
  confidence: z.number().nullable().catch(null),
  decidedBy: z.string().nullable().catch(null),
});

/** A refusal's reply, read for its `error` line. */
const RefusalSchema = z.looseObject({ error: z.string().optional().catch(undefined) });

/** What the judge hands the harvest: Jev's answer when it counted, else null and why. */
export type LawJudgement = { worth: LawWorth | null; reason: string | null };

/** The law judge: one question, the repository it is asked for and the ref the decision logs. */
export type LawJudge = (question: LawQuestion, asked: { repo: string; ref: string }) => Promise<LawJudgement>;

/** Galaxy's law judge route, on galaxy's host (`GALAXY_URL` or its default), as the stage events. */
export function lawJudgeUrl(galaxyUrl: string): string {
  return `${new URL(stageEventUrl(galaxyUrl)).origin}/api/laws/judge`;
}

const kept = (reason: string): LawJudgement => ({ worth: null, reason });

/** Galaxy's answer, as the judge reads it: its status and its body as JSON (`null` when it is not). */
type Answered = { status: number; ok: boolean; reply: unknown };

/** One signed POST to galaxy: its answer, or why it was never answered. */
function signedPost(
  post: (url: string, init: RequestInit) => Promise<Response>,
  { url, secret, body, timeoutMs }: { url: string; secret: string; body: string; timeoutMs: number },
): Promise<Answered | { unreached: string }> {
  const headers = { 'content-type': 'application/json', [STAGE_SIGNATURE_HEADER]: signStageEvent(secret, body) };
  return post(url, { method: 'POST', body, headers, signal: AbortSignal.timeout(timeoutMs) }).then(
    async (response): Promise<Answered> => ({ status: response.status, ok: response.ok, reply: await response.json().catch(() => null) }),
    (error: unknown) => ({ unreached: error instanceof Error ? error.message : String(error) }),
  );
}

/** What galaxy's answer means for the harvest: Jev's answer when it counted, else why the classifier's counts. */
function judgementOf({ status, ok, reply }: Answered): LawJudgement {
  if (!ok) {
    const error = RefusalSchema.safeParse(reply).data?.error;
    return kept(`galaxy answered ${status}${error ? `: ${error}` : ''}`);
  }
  const verdict = VerdictSchema.safeParse(reply);
  if (!verdict.success) return kept('galaxy answered no verdict');
  const { answer, confidence, decidedBy } = verdict.data;
  if (decidedBy !== 'jev' || confidence === null) return kept("galaxy kept the classifier's answer");
  return { worth: { worth: answer === 'true', decidedBy: 'Jev', confidence }, reason: null };
}

/** The judge bound to galaxy's route and the shared secret. */
export function lawJudge({ url, secret, fetch: post = fetch, timeoutMs = JUDGE_TIMEOUT_MS }: {
  url: string;
  secret: string | undefined;
  fetch?: (url: string, init: RequestInit) => Promise<Response>;
  timeoutMs?: number;
}): LawJudge {
  return async ({ state, old }, { repo, ref }) => {
    if (!secret) return kept(`${LAW_JUDGE_SECRET_VAR} is not set`);
    const { statement, why, principle, domain, prdTitle } = state;
    const body = JSON.stringify({ repo, state: { statement, why, principle, domain, prdTitle }, old: String(old), ref });
    const answered = await signedPost(post, { url, secret, body, timeoutMs });
    return 'unreached' in answered ? kept(`galaxy could not be reached: ${answered.unreached}`) : judgementOf(answered);
  };
}
