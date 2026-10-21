// The App's read of a PRD's approval in force (PRD 1612): galaxy's
// `GET /api/approvals/judge?repo=<owner/name>&prd=<n>`, signed with `STAGE_EVENT_SECRET` as the stage
// events are, over the path and query exactly as sent (a GET has no body):
// `x-omni-signature-256: sha256=<hmac-sha256 hex>`.
//
// It never throws: no secret here, a refusal (401, 404, 5xx), a timeout, a network error or an answer
// that is no approval each come back as `held`, with why. Held is never failed (the spec's table).
import { createHmac } from 'node:crypto';
import { parseApprovalReply, type ApprovalReply } from 'omni-loop/kit/lib/approval/approval.ts';
import type { PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import { messageOf } from '../outbox-check/github-schema.ts';
import { STAGE_SIGNATURE_HEADER } from '../stage-forward/stage-forward.ts';

/** How long the App waits for galaxy before it holds the check. */
const JUDGE_TIMEOUT_MS = 10_000;

/** What the judge answered: the reply, or why the check is held. */
export type JudgeAnswer = { reply: ApprovalReply } | { held: string };

/** Where the judge is asked, and with what: `fetch` is the platform's unless given. */
export type JudgeClient = {
  galaxyUrl: string;
  secret: string | undefined;
  fetch?: (url: string, init: RequestInit) => Promise<Response>;
  timeoutMs?: number;
};

const SLUG = /^[\w.-]+\/[\w.-]+$/;

/** The judge's path and query for PRD `prd` of `repo`, the string the App signs. */
export function judgePath(repo: string, prd: PrdNumber): string {
  if (!SLUG.test(repo)) throw new Error(`judge: "${repo}" is not an owner/name repository`);
  return `/api/approvals/judge?repo=${repo}&prd=${Number(prd)}`;
}

/** The signature header's value for `signed` under `secret`. */
export function signJudge(secret: string, signed: string): string {
  return `sha256=${createHmac('sha256', secret).update(signed).digest('hex')}`;
}

/** Asks galaxy for PRD `prd`'s approval in force. */
export async function askJudge(repo: string, prd: PrdNumber, { galaxyUrl, secret, fetch: get = fetch, timeoutMs = JUDGE_TIMEOUT_MS }: JudgeClient): Promise<JudgeAnswer> {
  if (!secret) return { held: 'STAGE_EVENT_SECRET is not set on the App' };
  const path = judgePath(repo, prd);
  let response: Response;
  try {
    response = await get(`${galaxyUrl.replace(/\/+$/, '')}${path}`, {
      method: 'GET',
      headers: { [STAGE_SIGNATURE_HEADER]: signJudge(secret, path) },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    return { held: `galaxy did not answer: ${String(messageOf(error))}` };
  }
  if (!response.ok) return { held: `galaxy answered ${response.status}` };
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { held: 'galaxy answered no JSON' };
  }
  const reply = parseApprovalReply(body);
  return reply ? { reply } : { held: 'galaxy answered no approval' };
}
