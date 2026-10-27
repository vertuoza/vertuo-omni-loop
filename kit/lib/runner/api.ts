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
//
// A job that runs as the Omni GitHub App (PRD 2433) asks `githubToken` for a fresh installation token
// before the one it holds runs out; a reply the runner cannot read is a refusal, never a token.
//
// A job's questions (PRD 2255) are the other client here, `jobQuestionsApi`: `omni runner ask` and
// `omni runner answers` run inside a job's session, not in the runner, and what they print is the app's own
// words, so a refusal there carries the app's `error` rather than `refused (<status>)` alone.
import { z } from 'zod';
import { askClient } from '../ask/client.ts';
import type { Fetch, TokenStore } from '../ask/client.ts';
import { field, jsonObject } from '../ask/schema.ts';
import type { JsonObject } from '../ask/schema.ts';
import type { IssueNumber, PrdNumber } from '../ids.ts';
import type { Sample } from './health.ts';
import type { BugFixOutcome, RunOutcome } from './log.ts';
import type { JobQuestionList } from './questions.ts';
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

/**
 * The GitHub App a key's job runs as (PRD 2433): an installation token, when it expires, and the app's
 * bot, its login (`<slug>[bot]`) and its email. A `github` that holds less than all four never reads as
 * none: the job is not handed over, so no machine account runs it.
 */
const GithubGrantSchema = z.object({
  token: z.string().min(1),
  expiresAt: z.string().refine((value) => !Number.isNaN(Date.parse(value)), 'a date'),
  login: z.string().min(1),
  email: z.string().min(1),
});

/** A fresh token of a job's GitHub App (PRD 2433, s3): what `POST /api/runners/jobs/<id>/github-token` answers. */
const FreshTokenSchema = z.object({ token: GithubGrantSchema.shape.token, expiresAt: GithubGrantSchema.shape.expiresAt });

/** A job `next` hands over. `allowedSkills` are the skills of its repository's own an owner allowed,
 * read when it was claimed (PRD 2313): an older app sends none, and the job allows none, as before.
 * `github` is the app a key's job runs as and `sentByKey` the key's name (PRD 2433): an older app sends
 * neither, and the job reads as a person's. */
const JobSchema = z.object({
  id: z.union([z.string().min(1), z.number()]).transform(String),
  line: z.string(),
  repo: z.string(),
  sentBy: z.string().nullish().transform((value) => value ?? null),
  allowedSkills: z.array(z.string()).nullish().transform((value) => value ?? []),
  github: GithubGrantSchema.nullish().transform((value) => value ?? null),
  sentByKey: z.string().nullish().transform((value) => value ?? null),
});

/** A job as the runner reads it: its id, its line, its repository (`owner/name`), who sent it, the
 * repository's own skills it may run, the GitHub App it runs as and the API key that sent it. */
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
  /** The claims the runner released once the job ended (PRD 2175): their pull requests' numbers, at most 50. */
  released?: number[];
  /** Why releasing them failed, at most 200 characters, or `null` when nothing failed (PRD 2175). */
  releaseError?: string | null;
  /**
   * What a done `/omni:yolo` or `/omni:yolo-fix` job's hand-off ended on (PRD 2223), or the word a done
   * `/omni:bug-fix` or `/omni:mega-bug-fix` job's `Outcome:` line gave (PRD 2425); never sent for any other job.
   */
  outcome?: RunOutcome | BugFixOutcome | null;
  /** The pull request a done bug fix proved had already fixed the bug, from its `Fixed by:` line (PRD 2425); left out when it names none. */
  fixedBy?: string;
  /** The pull requests a bug fix's log names with a `PR:` line, of any repository, in order, at most 50 (PRD 2425): sent done or failed, left out when it names none. */
  prs?: string[];
  /** The problems a done bug fix saw and did not fix, from its `Follow-up:` lines, at most 5 (PRD 2508); left out when it names none. */
  followUps?: { repos: string[]; summary: string }[];
  /** The PRD's slices merged and its slices in all, read from its board when a job ended `stopped` (PRD 2375); left out when the board cannot be read. */
  slicesMerged?: number;
  slicesTotal?: number;
};

/** The limits a runner pauses at (PRD 2102): memory used above, in percent; disk free below, in GB; load above, times its cores. */
export type HealthLimits = { maxMemory: number; minDiskGb: number; maxLoad: number };

/** A health report: the machine's sample, why it is paused and at which limits, and its tokens of the last 5 h and today. Numbers only. */
export type HealthReport = Sample & { paused?: string | null; limits?: HealthLimits; tokens?: MachineTokens };

/**
 * What the runner says about itself when it registers. `githubApp` says it can run a job as an API key's
 * GitHub App (PRD 2433): the app hands a job of a key with an app only to a runner that said so.
 */
export type Registration = { name: string; slots: number; repos: string[]; version: string; githubApp: boolean };

export type RunnerApi = {
  register(registration: Registration): Promise<{ id: string }>;
  /** The job claimed for `runner`, or `null` when the hold ended with none. */
  next(runner: string, signal?: AbortSignal): Promise<RunnerJob | null>;
  update(job: string, update: JobUpdate): Promise<{ cancel: boolean }>;
  /** Sends the machine's health: throws `RunnerUnreachable` or `RunnerRefused` as every call, and the runner only prints it. */
  health(runner: string, report: HealthReport): Promise<void>;
  /**
   * A fresh token of the GitHub App job `job` runs as (PRD 2433, s3), `POST /api/runners/jobs/<id>/github-token`,
   * with the runner's own sign-in. Throws `RunnerRefused` with the app's own words, or `RunnerUnreachable`.
   */
  githubToken(job: string): Promise<{ token: string; expiresAt: string }>;
};

/** A runner of the workspace, as the terminal reads it (`GET /api/runners?repo=`). */
const KitRunnerSchema = z.object({
  id: z.string(),
  name: z.string(),
  fleet: z.string().nullable(),
  state: z.enum(['online', 'busy', 'offline']),
  used: z.number(),
  slots: z.number(),
  repos: z.array(z.string()),
});
export type KitRunner = z.output<typeof KitRunnerSchema>;

/** A PRD's job, as the terminal follows it (`GET /api/runners/jobs?repo=&prd=`). */
const PrdJobSchema = z.object({
  id: z.string(),
  line: z.string(),
  status: z.enum(['queued', 'claimed', 'running', 'done', 'failed', 'cancelled']),
  runner: z.string().nullable(),
  prUrl: z.string().nullable(),
  exitCode: z.number().nullable(),
  reason: z.string().nullable(),
  // A bug fix (PRD 2425) has outcomes of its own, which a PRD's follower has no word for: they, and any word
  // that comes later, read as none, so one such job never makes a whole list unreadable.
  outcome: z.enum(['answers', 'held', 'ready', 'human', 'stopped']).nullable().optional().catch(null).transform((value) => value ?? null),
  queuedAt: z.string(),
});
export type PrdJob = z.output<typeof PrdJobSchema>;

/** A read of a job's live lines (`GET /api/runners/jobs/<id>/lines?after=`): the lines are numbered. */
const JobLinesSchema = z.object({
  status: PrdJobSchema.shape.status,
  lines: z.array(z.object({ seq: z.number(), text: z.string() })),
  more: z.boolean(),
});
export type JobLinesRead = z.output<typeof JobLinesSchema>;

/** Where a job goes: any runner of the workspace, a fleet's, or one runner (by its id). */
export type SendTarget = { kind: 'any' } | { kind: 'fleet'; fleet: string } | { kind: 'runner'; runner: string };

/** The reads and the send the terminal makes with its own sign-in (PRD 2251). */
export type KitReads = {
  /** The runners of `repo`'s workspace. */
  runners(repo: string): Promise<KitRunner[]>;
  /** `prd`'s jobs in `repo`, newest first. */
  prdJobs(repo: string, prd: PrdNumber): Promise<PrdJob[]>;
  /** The lines of job `job` after sequence number `after`. */
  lines(job: string, after: number): Promise<JobLinesRead>;
  /** Queues `line` for `repo`; answers the job's id. A refusal throws `RunnerRefused` with the app's words. */
  send(request: { line: string; repo: string; target: SendTarget }): Promise<{ id: string }>;
};

/** What a running job asks the person (PRD 2255): the issue its skill stopped on, why it stopped, and the questions. */
export type JobQuestions = { issue: IssueNumber; lead: string; questions: JobQuestionList };

export type JobQuestionsApi = {
  /** Stores a running job's questions: throws `RunnerRefused` with the app's own words, or `RunnerUnreachable`. */
  ask(job: string, request: JobQuestions): Promise<void>;
  /** A job's row of questions as the app answers it (the answers once given): throws as `ask` does. */
  answers(job: string): Promise<JsonObject>;
};

const timedOut = (error: unknown): boolean => typeof error === 'object' && error !== null && 'name' in error && error.name === 'TimeoutError';

/** A refusal in the app's own words (its `error`, on one line), else `refused (<status>)`. */
function refusalWords(status: number, body: unknown): string {
  const words = field(body, 'error');
  const line = typeof words === 'string' ? words.replace(/\s+/g, ' ').trim() : '';
  return line === '' ? `refused (${String(status)})` : line;
}

/** `response` when it may be read: a refused sign-in, a 5xx and any other refusal but `allow` throw. */
function checked(response: Response, what: string, allow: readonly number[] = []): Response {
  if (response.status === 401 || (response.status === 403 && !allow.includes(403))) throw new RunnerRefused(NO_SIGN_IN);
  if (response.status >= 500) throw new RunnerUnreachable(`${what}: ${String(response.status)}`);
  if (!response.ok && !allow.includes(response.status)) throw new RunnerRefused(`refused (${String(response.status)})`);
  return response;
}

type Wiring = { askUrl: string; tokens: TokenStore; fetch: Fetch };

/** The calls every client here makes: the sign-in on each, renewed once when a call answers 401, and a timeout. */
function transport({ askUrl, tokens, fetch }: Wiring) {
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

  async function json(response: Response): Promise<unknown> {
    const text = await response.text().catch(() => '');
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      return {};
    }
  }

  /**
   * A 2xx response: a 401 renews the sign-in once and tries again. With `words`, any other refusal below 500
   * (a 403 included) throws the app's own words, as `refusalWords` reads them.
   */
  async function call(method: string, path: string, options: { body?: unknown; timeoutMs?: number; signal?: AbortSignal | undefined; allow?: readonly number[]; words?: true } = {}): Promise<Response> {
    const timeoutMs = options.timeoutMs ?? CALL_MS;
    const held = tokens.read(host)?.access_token;
    const token = held ? held : await renewed();
    let response = await send(method, path, token, { ...options, timeoutMs });
    if (response.status === 401) response = await send(method, path, await renewed(), { ...options, timeoutMs });
    if (options.words === true && response.status !== 401 && response.status < 500 && !response.ok) {
      throw new RunnerRefused(refusalWords(response.status, await json(response)));
    }
    return checked(response, `${method} ${path}`, options.allow);
  }

  return { call, json, segment };
}

/** A 403 on a read is a repository outside the workspace, not a refused sign-in. */
function forbidden(response: Response): Response {
  if (response.status === 403) throw new RunnerRefused('refused (403: this repository is not in your workspace)');
  return response;
}

export function runnerApi(wiring: Wiring): RunnerApi & KitReads {
  const { call, json, segment } = transport(wiring);
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
      const response = await call('POST', `/api/runners/jobs/${segment(job)}`, { body: update, allow: [409] });
      if (response.status === 409) return { cancel: true };
      const reply = UpdatedSchema.safeParse(await json(response));
      return { cancel: reply.success && reply.data.cancel === true };
    },
    async health(runner, report) {
      // A 403 is another owner's runner, not a refused sign-in: it is named as the refusal it is.
      const response = await call('POST', `/api/runners/${segment(runner)}/health`, { body: report, timeoutMs: HEALTH_MS, allow: [403] });
      if (response.status === 403) throw new RunnerRefused('refused (403)');
    },
    async githubToken(job) {
      // A refusal is the app's own words (a job that ended more than 10 minutes ago, another runner's job): they are the reason the job ends on.
      const reply = FreshTokenSchema.safeParse(await json(await call('POST', `/api/runners/jobs/${segment(job)}/github-token`, { words: true })));
      if (!reply.success) throw new RunnerRefused('refused (the app answered no token)');
      return reply.data;
    },
    async runners(repo) {
      const reply = z.object({ runners: z.array(KitRunnerSchema) }).safeParse(await json(await call('GET', `/api/runners?${new URLSearchParams({ repo })}`, { allow: [403] }).then(forbidden)));
      if (!reply.success) throw new RunnerRefused('refused (the app answered no runners)');
      return reply.data.runners;
    },
    async prdJobs(repo, prd) {
      const query = new URLSearchParams({ repo, prd: String(prd) });
      const reply = z.object({ jobs: z.array(PrdJobSchema) }).safeParse(await json(await call('GET', `/api/runners/jobs?${query}`, { allow: [403] }).then(forbidden)));
      if (!reply.success) throw new RunnerRefused('refused (the app answered no jobs)');
      return reply.data.jobs;
    },
    async lines(job, after) {
      const reply = JobLinesSchema.safeParse(await json(await call('GET', `/api/runners/jobs/${segment(job)}/lines?after=${String(after)}`)));
      if (!reply.success) throw new RunnerRefused('refused (the app answered no lines)');
      return reply.data;
    },
    async send(request) {
      const response = await call('POST', '/api/runners/jobs', { body: request, allow: [400, 403] });
      if (!response.ok) {
        const error = z.object({ error: z.string() }).safeParse(await json(response));
        throw new RunnerRefused(error.success ? error.data.error : `refused (${String(response.status)})`);
      }
      const reply = z.object({ job: z.object({ id: z.union([z.string().min(1), z.number()]).transform(String) }) }).safeParse(await json(response));
      if (!reply.success) throw new RunnerRefused('refused (the app answered no job)');
      return { id: reply.data.job.id };
    },
  };
}

/** A job's questions (PRD 2255): the app's `POST` and `GET /api/runners/jobs/<job>/questions`, with the runner's sign-in. */
export function jobQuestionsApi(wiring: Wiring): JobQuestionsApi {
  const { call, json, segment } = transport(wiring);
  const route = (job: string): string => `/api/runners/jobs/${segment(job)}/questions`;
  return {
    async ask(job, request) {
      await call('POST', route(job), { body: request, words: true });
    },
    async answers(job) {
      const reply = jsonObject(await json(await call('GET', route(job), { words: true })));
      if (reply === null || !Array.isArray(reply['questions'])) throw new RunnerRefused('refused (the app answered no questions)');
      return reply;
    },
  };
}
