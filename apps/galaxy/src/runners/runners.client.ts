import { z } from 'zod';
import { JobLinesSchema, JobQuestionsSchema, JobReplySchema, RunnerReplySchema, type Job, type JobLines, type JobQuestions, type Runner, type Target } from './runners.contract';

// The browser's calls to the runners' routes (PRD 1830 s1; ADR-0095), for the Runners page and Send to
// terminal: each answer parsed by the contract, each refusal its `{error}` in plain words. Never
// `@supabase/*`: the page's session cookies go with each call.

/** A call's answer: its value, or the route's words for why not. */
export type Called<T> = { ok: true; value: T } | { ok: false; error: string };

const RefusalSchema = z.object({ error: z.string() });
export const UNREACHABLE = 'The Omni app could not be reached. Try again.';

export async function call<T>(fetcher: typeof fetch, url: string, init: RequestInit, read: (body: unknown) => T): Promise<Called<T>> {
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

/** A job's live lines after the sequence number `after` (0: from the first), at most 5,000 (PRD 1904). */
export function readJobLines(id: string, after: number, fetcher: typeof fetch = fetch): Promise<Called<JobLines>> {
  return call(fetcher, `/api/runners/jobs/${encodeURIComponent(id)}/lines?after=${String(after)}`, { method: 'GET' }, (body) => JobLinesSchema.parse(body));
}

/** A job's questions, with the answers once someone gave them (PRD 2255). */
export function readJobQuestions(id: string, fetcher: typeof fetch = fetch): Promise<Called<JobQuestions>> {
  return call(fetcher, `/api/runners/jobs/${encodeURIComponent(id)}/questions`, { method: 'GET' }, (body) => JobQuestionsSchema.parse(body));
}

/** Answers a job's questions, each question's text to its answer: the first answer queues the job that resumes
 * the run, answered here; a second reads who was first (PRD 2255). */
export function answerRunnerJob(id: string, answers: Record<string, string>, fetcher: typeof fetch = fetch): Promise<Called<Job>> {
  return call(fetcher, `/api/runners/jobs/${encodeURIComponent(id)}/answers`, { method: 'POST', body: JSON.stringify({ answers }) }, (body) => JobReplySchema.parse(body).job);
}

/** Closes a job's questions with no answers and no job queued: they leave the badge (PRD 2255). */
export function dismissRunnerJob(id: string, fetcher: typeof fetch = fetch): Promise<Called<JobQuestions>> {
  return call(fetcher, `/api/runners/jobs/${encodeURIComponent(id)}/dismiss`, { method: 'POST' }, (body) => JobQuestionsSchema.parse(body));
}
