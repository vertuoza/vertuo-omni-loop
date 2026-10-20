import { JobReplySchema, type Job } from '../runners.contract';
import { call, UNREACHABLE, type Called } from '../runners.client';

// The browser's call for Fix with answers (PRD 2270 s2): the page's session cookies go with it, the answer
// is parsed by the contract, a refusal is its `{error}` in plain words, an answer out of shape unreachable.

/** Queues `/omni:yolo-fix <n>` as the continuation of the job `id` that waited on answers. */
export async function postFixWithAnswers(id: string, fetcher: typeof fetch = fetch): Promise<Called<Job>> {
  const called = await call(fetcher, `/api/runners/jobs/${encodeURIComponent(id)}/fix`, { method: 'POST' }, (body) => JobReplySchema.safeParse(body));
  if (!called.ok) return called;
  return called.value.success ? { ok: true, value: called.value.data.job } : { ok: false, error: UNREACHABLE };
}
