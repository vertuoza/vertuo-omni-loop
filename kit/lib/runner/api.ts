// The runner's side of the Omni app's runner routes (PRD 1830, "The routes"): register, wait on `next`
// for a job, send a job's status, and send the machine's health (PRD 2102). Each call carries the
// sign-in every kit command carries (the kit token `OMNI_TOKEN`, else the sign-in `omni signin` keeps),
// renewed once through the ask client when a call answers 401.
//
// A call fails in one of two ways, and the runner treats them apart:
// - `RunnerUnreachable`: the app did not answer, timed out, or answered 5xx. The runner backs off and
//   tries again, and its running jobs keep going.
// - `RunnerRefused`: the app refused the sign-in (`no sign-in (omni setup-token)`) or the call
//   (`refused (<status>)`, a 404 once the routes are gone). The runner stops.
// A health report's failure, either way, stops nothing: the runner prints one line and carries on.
// A job report the app answers 409 is not a refusal: the job ended meanwhile (cancelled, or failed as
// `runner lost`), so the runner stops that job alone, as for a cancel.
import { z } from 'zod';
import { askClient } from '../ask/client.ts';
import type { Fetch, TokenStore } from '../ask/client.ts';
import type { Sample } from './health.ts';
import type { MachineTokens, TokenCounts } from './tokens.ts';

/** The line a refused sign-in stops the runner on. */
const NO_SIGN_IN = 'no sign-in (omni setup-token)';

/** How long a call waits, `next` aside. */
const CALL_MS = 10_000;
/** How long a `next` waits: the app holds it up to 40 s. */
const NEXT_MS = 65_000;
/** How long a health report waits: well under the 15 s between two. */
const HEALTH_MS = 5000;

export class RunnerUnreachable extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RunnerUnreachable';
  }
}

export class RunnerRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RunnerRefused';
  }
}

/** What `register` answers: the runner's id. */
const RegisteredSchema = z.object({ id: z.union([z.string().min(1), z.number()]).transform(String) });

/** A job `next` hands over. */
const JobSchema = z.object({
  id: z.union([z.string().min(1), z.number()]).transform(String),
  line: z.string(),
  repo: z.string(),
  sentBy: z.string().nullish().transform((value) => value ?? null),
});

/** A job as the runner reads it: its id, its line, its repository (`owner/name`), and who sent it. */
export type RunnerJob = z.output<typeof JobSchema>;

/** What a job update answers: whether a cancel waits. */
const UpdatedSchema = z.object({ cancel: z.boolean().optional() }).loose();

/** A job's status as the runner reports it. */
export type JobUpdate = {
  status: 'running' | 'done' | 'failed' | 'cancelled';
  logTail?: string;
  /** The number of the first of `lines`: its 1-based line number in the job's log (PRD 1904). */
  from?: number;
  /** The log's lines after the runner's cursor, sent with `from` or not at all. */
  lines?: string[];
  prUrl?: string | null;
  exitCode?: number | null;
  reason?: string | null;
  /** The tokens the job's transcripts hold, sub-agents included (PRD 2102): numbers only. */
  tokens?: TokenCounts;
};

/** The limits a runner pauses at (PRD 2102): memory used above, in percent; disk free below, in GB; load above, times its cores. */
export type HealthLimits = { maxMemory: number; minDiskGb: number; maxLoad: number };

/** A health report: the machine's sample, why it is paused and at which limits, and its tokens of the last 5 h and today. Numbers only. */
export type HealthReport = Sample & { paused?: string | null; limits?: HealthLimits; tokens?: MachineTokens };

/** What the runner says about itself when it registers. */
export type Registration = { name: string; slots: number; repos: string[]; version: string };

export type RunnerApi = {
  register(registration: Registration): Promise<{ id: string }>;
  /** The job claimed for `runner`, or `null` when the hold ended with none. */
  next(runner: string, signal?: AbortSignal): Promise<RunnerJob | null>;
  update(job: string, update: JobUpdate): Promise<{ cancel: boolean }>;
  /** Sends the machine's health: throws `RunnerUnreachable` or `RunnerRefused` as every call, and the runner only prints it. */
  health(runner: string, report: HealthReport): Promise<void>;
};

const timedOut = (error: unknown): boolean => typeof error === 'object' && error !== null && 'name' in error && error.name === 'TimeoutError';

/** `response` when it may be read: a refused sign-in, a 5xx and any other refusal but `allow` throw. */
function checked(response: Response, what: string, allow: number | undefined): Response {
  if (response.status === 401 || (response.status === 403 && allow !== 403)) throw new RunnerRefused(NO_SIGN_IN);
  if (response.status >= 500) throw new RunnerUnreachable(`${what}: ${String(response.status)}`);
  if (!response.ok && response.status !== allow) throw new RunnerRefused(`refused (${String(response.status)})`);
  return response;
}

export function runnerApi({ askUrl, tokens, fetch }: { askUrl: string; tokens: TokenStore; fetch: Fetch }): RunnerApi {
  const root = askUrl.replace(/\/+$/, '');
  const host = new URL(askUrl).host;
  const client = askClient({ baseUrl: root, host, tokens, fetch });
  const segment = (value: string): string => encodeURIComponent(value);

  async function renewed(): Promise<string> {
    const result = await client.renew();
    if (result === 'refused') throw new RunnerRefused(NO_SIGN_IN);
    if (result === 'unreachable') throw new RunnerUnreachable(`${host} is unreachable`);
    const fresh = tokens.read(host)?.access_token;
    if (!fresh) throw new RunnerRefused(NO_SIGN_IN);
    return fresh;
  }

  async function send(method: string, path: string, token: string, { body, timeoutMs, signal }: { body?: unknown; timeoutMs: number; signal?: AbortSignal | undefined }): Promise<Response> {
    const headers: Record<string, string> = { accept: 'application/json', authorization: `Bearer ${token}` };
    if (body !== undefined) headers['content-type'] = 'application/json';
    const timeout = AbortSignal.timeout(timeoutMs);
    try {
      return await fetch(`${root}${path}`, {
        method,
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new RunnerUnreachable(`${method} ${path}: ${timedOut(error) ? 'timed out' : 'unreachable'}`);
    }
  }

  /** A 2xx response: a 401 renews the sign-in once and tries again. */
  async function call(method: string, path: string, options: { body?: unknown; timeoutMs?: number; signal?: AbortSignal | undefined; allow?: number } = {}): Promise<Response> {
    const timeoutMs = options.timeoutMs ?? CALL_MS;
    const held = tokens.read(host)?.access_token;
    const token = held ? held : await renewed();
    let response = await send(method, path, token, { ...options, timeoutMs });
    if (response.status === 401) response = await send(method, path, await renewed(), { ...options, timeoutMs });
    return checked(response, `${method} ${path}`, options.allow);
  }

  async function json(response: Response): Promise<unknown> {
    const text = await response.text().catch(() => '');
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      return {};
    }
  }

  return {
    async register(registration) {
      const reply = RegisteredSchema.safeParse(await json(await call('POST', '/api/runners/register', { body: registration })));
      if (!reply.success) throw new RunnerRefused('refused (the app answered no runner id)');
      return reply.data;
    },
    async next(runner, signal) {
      const response = await call('GET', `/api/runners/next?${new URLSearchParams({ runner })}`, { timeoutMs: NEXT_MS, signal });
      if (response.status === 204) return null;
      const job = JobSchema.safeParse(await json(response));
      return job.success ? job.data : null;
    },
    async update(job, update) {
      const response = await call('POST', `/api/runners/jobs/${segment(job)}`, { body: update, allow: 409 });
      if (response.status === 409) return { cancel: true };
      const reply = UpdatedSchema.safeParse(await json(response));
      return { cancel: reply.success && reply.data.cancel === true };
    },
    async health(runner, report) {
      // A 403 is another owner's runner, not a refused sign-in: it is named as the refusal it is.
      const response = await call('POST', `/api/runners/${segment(runner)}/health`, { body: report, timeoutMs: HEALTH_MS, allow: 403 });
      if (response.status === 403) throw new RunnerRefused('refused (403)');
    },
  };
}
