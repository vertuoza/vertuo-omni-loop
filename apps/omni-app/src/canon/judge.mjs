// The canon gate's judge port (PRD 871): the one call to galaxy's `POST /api/constituents/judge`, which
// runs the workspace's `constituent-break` Jev decision, since only galaxy holds its sealed Jev key.
//
//   request  {repo, state, old, ref}     signed as stage events are: an HMAC-SHA256 over the exact body,
//                                        `sha256=<hex>` in x-omni-signature-256, under
//                                        CONSTITUENT_JUDGE_SECRET (shared by both apps)
//   reply    {answer, confidence, decidedBy}   `answer` is the verdict that counts, "true" broken or
//                                        "false", today's when Off or Shadow, Jev's when On and at or above
//                                        the floor
//
// Only `answer` decides; the reply's shape is the one place outbox item s4-01 may still change. Never
// throws: no secret, a refusal, a reply without an answer or a network failure comes back as
// `{ ok: false, error, reason }`, which the gate shows as neutral, never red.
import { STAGE_SIGNATURE_HEADER, signStageEvent, stageEventUrl } from '../stage-forward/stage-forward.mjs';
import { JUDGE_NOT_CONFIGURED } from './canon.mjs';

export const JUDGE_SECRET_VAR = 'CONSTITUENT_JUDGE_SECRET';
/** Jev reads a spec of 40,000 characters at most; galaxy's route allows itself a minute. */
const JUDGE_TIMEOUT_MS = 55_000;

/** Galaxy's judge route, on `GALAXY_URL` when set, as the stage events. */
export function judgeUrl(env = process.env) {
  return `${new URL(stageEventUrl(env)).origin}/api/constituents/judge`;
}

const failed = (error, reason) => ({ ok: false, error, answer: null, confidence: null, decidedBy: null, reason });

/** The reply's verdict, or null when it carries none. */
function verdictOf(body) {
  if (body?.answer !== 'true' && body?.answer !== 'false') return null;
  return {
    answer: body.answer,
    confidence: typeof body.confidence === 'number' ? body.confidence : null,
    decidedBy: typeof body.decidedBy === 'string' ? body.decidedBy : null,
  };
}

/**
 * The judge bound to galaxy's route and the shared secret.
 * @param {{ url: string, secret: string | undefined, fetch?: typeof fetch, timeoutMs?: number }} deps
 */
export function constituentJudge({ url, secret, fetch: post = fetch, timeoutMs = JUDGE_TIMEOUT_MS }) {
  return async ({ repo, state, old, ref = null }) => {
    if (!secret) return failed(JUDGE_NOT_CONFIGURED, `${JUDGE_SECRET_VAR} is not set`);
    const body = JSON.stringify({ repo, state, old, ref });
    let response;
    try {
      response = await post(url, {
        method: 'POST',
        body,
        headers: { 'content-type': 'application/json', [STAGE_SIGNATURE_HEADER]: signStageEvent(secret, body) },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      return failed('judge', `galaxy could not be reached: ${error?.message ?? error}`);
    }
    const reply = await response.json().catch(() => null);
    if (!response.ok) return failed('judge', `galaxy answered ${response.status}${reply?.error ? `: ${reply.error}` : ''}`);
    const verdict = verdictOf(reply);
    return verdict ? { ok: true, error: null, ...verdict, reason: null } : failed('judge', 'galaxy answered no verdict');
  };
}
