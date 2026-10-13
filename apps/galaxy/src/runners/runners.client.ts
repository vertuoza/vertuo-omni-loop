import { z } from 'zod';
import { JobReplySchema, RunnerReplySchema, type Job, type Runner, type Target } from './runners.contract';

// The browser's calls to the runners' routes (PRD 1830 s1; ADR-0095), for the Runners page and Send to
// terminal: each answer parsed by the contract, each refusal its `{error}` in plain words. Never
// `@supabase/*`: the page's session cookies go with each call.

/** A call's answer: its value, or the route's words for why not. */
export type Called<T> = { ok: true; value: T } | { ok: false; error: string };

const RefusalSchema = z.object({ error: z.string() });
const UNREACHABLE = 'The Omni app could not be reached. Try again.';

async function call<T>(fetcher: typeof fetch, url: string, init: RequestInit, read: (body: unknown) => T): Promise<Called<T>> {
  let response: Response;
  try {
    response = await fetcher(url, { ...init, headers: { 'content-type': 'application/json' }, credentials: 'same-origin' });
  } catch {
    return { ok: false, error: UNREACHABLE };
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const refusal = RefusalSchema.safeParse(body);
    return { ok: false, error: refusal.success ? refusal.data.error : UNREACHABLE };
  }
  return { ok: true, value: read(body) };
}

/** Queues `line` for `repo`, to `target`. */
export function sendToRunner(line: string, repo: string, target: Target, fetcher: typeof fetch = fetch): Promise<Called<Job>> {
  return call(fetcher, '/api/runners/jobs', { method: 'POST', body: JSON.stringify({ line, repo, target }) }, (body) => JobReplySchema.parse(body).job);
}

/** Cancels a job: a queued one at once, a running one at its runner's next report. */
export function cancelRunnerJob(id: string, fetcher: typeof fetch = fetch): Promise<Called<Job>> {
  return call(fetcher, `/api/runners/jobs/${encodeURIComponent(id)}/cancel`, { method: 'POST' }, (body) => JobReplySchema.parse(body).job);
}

/** Gives a runner to a fleet, or makes it shared (null). */
export function setRunnerFleet(id: string, fleet: string | null, fetcher: typeof fetch = fetch): Promise<Called<Runner>> {
  return call(fetcher, `/api/runners/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ fleet }) }, (body) => RunnerReplySchema.parse(body).runner);
}
