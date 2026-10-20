import { z } from 'zod';
import { JobReplySchema, type Job } from '../runners.contract';
import type { Called } from '../runners.client';

// The browser's call for Fix with answers (PRD 2270 s2): the page's session cookies go with it, the answer
// is parsed by the contract, a refusal is its `{error}` in plain words.

const RefusalSchema = z.object({ error: z.string() });
const UNREACHABLE = 'The Omni app could not be reached. Try again.';

/** Queues `/omni:yolo-fix <n>` as the continuation of the job `id` that waited on answers. */
export async function postFixWithAnswers(id: string, fetcher: typeof fetch = fetch): Promise<Called<Job>> {
  let response: Response;
  try {
    response = await fetcher(`/api/runners/jobs/${encodeURIComponent(id)}/fix`, { method: 'POST', credentials: 'same-origin' });
  } catch {
    return { ok: false, error: UNREACHABLE };
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const refusal = RefusalSchema.safeParse(body);
    return { ok: false, error: refusal.success ? refusal.data.error : UNREACHABLE };
  }
  const read = JobReplySchema.safeParse(body);
  return read.success ? { ok: true, value: read.data.job } : { ok: false, error: UNREACHABLE };
}
