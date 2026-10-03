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
// `{ ok: false, error, reason }`, which the gate shows as neutral, never red. The reply is read through
// VerdictSchema (PRD 725) before its answer counts.
import { z } from 'zod';
import { STAGE_SIGNATURE_HEADER, signStageEvent, stageEventUrl } from '../stage-forward/stage-forward.ts';
import { type Judge, type JudgeAnswer, JUDGE_NOT_CONFIGURED, stringOf, thrownMessage } from './canon.ts';

export const JUDGE_SECRET_VAR = 'CONSTITUENT_JUDGE_SECRET';
/** Jev reads a spec of 40,000 characters at most; galaxy's route allows itself a minute. */
const JUDGE_TIMEOUT_MS = 55_000;

/** The reply's verdict: `answer` "true" or "false"; a confidence or a decider of another kind reads as null. */
const VerdictSchema = z.looseObject({
  answer: z.enum(['true', 'false']),
  confidence: z.number().nullable().catch(null),
  decidedBy: z.string().nullable().catch(null),
});

/** A refusal's reply, read for its `error` line, whatever it is. */
const RefusalSchema = z.looseObject({ error: z.unknown().optional() });

/** Galaxy's judge route, on galaxy's host (`GALAXY_URL` or its default), as the stage events. */
export function judgeUrl(galaxyUrl: string): string {
  return `${new URL(stageEventUrl(galaxyUrl)).origin}/api/constituents/judge`;
}

const failed = (error: string, reason: string): JudgeAnswer => ({ ok: false, error, answer: null, confidence: null, decidedBy: null, reason });

/** The judge bound to galaxy's route and the shared secret. */
export function constituentJudge({ url, secret, fetch: post = fetch, timeoutMs = JUDGE_TIMEOUT_MS }: {
  url: string;
  secret: string | undefined;
  fetch?: (url: string, init: RequestInit) => Promise<Response>;
  timeoutMs?: number;
}): Judge {
  return async ({ repo, state, old, ref }) => {
    if (!secret) return failed(JUDGE_NOT_CONFIGURED, `${JUDGE_SECRET_VAR} is not set`);
    const body = JSON.stringify({ repo, state, old, ref });
    let response: Response;
    try {
      response = await post(url, {
        method: 'POST',
        body,
        headers: { 'content-type': 'application/json', [STAGE_SIGNATURE_HEADER]: signStageEvent(secret, body) },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      return failed('judge', `galaxy could not be reached: ${String(thrownMessage(error) ?? error)}`);
    }
    const reply: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const refusal = RefusalSchema.safeParse(reply);
      const said = refusal.success && refusal.data.error ? `: ${stringOf(refusal.data.error)}` : '';
      return failed('judge', `galaxy answered ${response.status}${said}`);
    }
    const verdict = VerdictSchema.safeParse(reply);
    if (!verdict.success) return failed('judge', 'galaxy answered no verdict');
    const { answer, confidence, decidedBy } = verdict.data;
    return { ok: true, error: null, answer, confidence, decidedBy, reason: null };
  };
}
