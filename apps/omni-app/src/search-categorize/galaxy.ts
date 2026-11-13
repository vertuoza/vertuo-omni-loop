// The categorize job's galaxy port (PRD omni-loop-7 s3, plan "Shared ground"): the one call to galaxy's
// `POST /api/search/categorize`, which runs the workspace's `search-category` Jev decision, since only galaxy
// holds its sealed Jev key.
//
//   request  {workspaceId, productId, question}   signed as the law judge is (../knowledge-harvest/law-judge.ts):
//                                                 an HMAC-SHA256 over the exact body, `sha256=<hex>` in
//                                                 x-omni-signature-256, under a secret both apps share
//   reply    {category, decidedBy, confidence}    `category` a domain of the product, "other", or null when the
//                                                 decision is off, the workspace has no Jev key or Jev did not answer
//
// The port throws when galaxy cannot be asked or answers out of shape; the job reads that as no category. The
// question is never logged, and an error names a status or a field, never the question (L-GDPR-2).
import { z } from 'zod';
import { STAGE_SIGNATURE_HEADER, signStageEvent, stageEventUrl } from '../stage-forward/stage-forward.ts';

/** Galaxy's route allows itself a minute; a run asks up to 200 questions, so one slow answer is cut sooner. */
const TIMEOUT_MS = 20_000;

/** What the job asks galaxy. */
export type CategorizeAsk = { workspaceId: string; productId: string; question: string };

/** Galaxy's category for a question, or null when it kept none. */
export type Categorizer = (ask: CategorizeAsk) => Promise<string | null>;

const ReplySchema = z.looseObject({ category: z.string().nullable() });

/** Galaxy's categorize route, on galaxy's host (`GALAXY_URL` or its default), as the stage events. */
export function categorizeUrl(galaxyUrl: string): string {
  return `${new URL(stageEventUrl(galaxyUrl)).origin}/api/search/categorize`;
}

/** The port bound to galaxy's route and the shared secret; with no secret every question keeps no category. */
export function galaxyCategorizer({ url, secret, fetch: post = fetch, timeoutMs = TIMEOUT_MS }: {
  url: string;
  secret: string | undefined;
  fetch?: (url: string, init: RequestInit) => Promise<Response>;
  timeoutMs?: number;
}): Categorizer {
  return async ({ workspaceId, productId, question }) => {
    if (!secret) return null;
    const body = JSON.stringify({ workspaceId, productId, question });
    const headers = { 'content-type': 'application/json', [STAGE_SIGNATURE_HEADER]: signStageEvent(secret, body) };
    let response: Response;
    try {
      response = await post(url, { method: 'POST', body, headers, signal: AbortSignal.timeout(timeoutMs) });
    } catch {
      throw new Error('categorize: galaxy could not be reached');
    }
    if (!response.ok) throw new Error(`categorize: galaxy answered ${String(response.status)}`);
    const reply = ReplySchema.safeParse(await response.json().catch(() => null));
    if (!reply.success) throw new Error('categorize: galaxy answered out of shape');
    return reply.data.category;
  };
}
