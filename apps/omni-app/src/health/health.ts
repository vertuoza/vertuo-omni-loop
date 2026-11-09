// `/api/health` of the GitHub App (PRD 1723): whether this deployment is alive and its environment
// parses, and which commit it runs. Public, so it never shows a variable's value, an error's text or
// anything about a person, and it calls nothing outside: no GitHub, no Inngest, no OpenRouter. Its one read
// is the job ledger's counts (PRD 2676), from the database, and only when a database is set.
//
// Answers, always with `Cache-Control: no-store`:
//   - GET, the environment parses, no job jammed → 200 `{ ok: true,  app: "omni-app", commit, checks: { env: "ok", jobs } }`
//   - GET, the environment does not parse        → 503 `{ ok: false, …, checks: { env: "failed", jobs: "unknown" } }`
//   - GET, a job is late                         → 503 `{ ok: false, …, checks: { env: "ok", jobs: "late" } }`
//   - any other method                           → 405, `Allow: GET`
// `commit` is `VERCEL_GIT_COMMIT_SHA`, `null` when unset. `jobs` is `ok`; `late` (a job due over an hour ago, or
// a failed one no later job of its repository made up for); `unknown` (the database cannot be read in time:
// a database that blinked is not a jam, so `ok` stays as it was); or `off` (no database here). Never a
// repository's name, a job's key or an error's text.
import { readCommit, readEnv, type EnvSource } from '../env.ts';
import { jobLedger, type JobsHealth } from '../jobs/ledger.ts';

/** What `/api/health` answers. */
export type Health = {
  ok: boolean;
  app: 'omni-app';
  commit: string | null;
  checks: { env: 'ok' | 'failed'; jobs: JobsCheck };
};

/** The state of the job ledger, as `/api/health` says it. */
export type JobsCheck = 'ok' | 'late' | 'unknown' | 'off';

/** The ledger's counts, read from the database the environment names. */
export type JobsReader = (supabase: { url: string; key: string }) => Promise<JobsHealth>;

/** How long the database has to answer: `/api/health` has 10 seconds in all. */
const JOBS_TIMEOUT_MS = 5000;

const readJobs: JobsReader = (connection) => jobLedger(connection).health();

/** `checks.jobs` for the environment `source`; never throws, never reads when no database is set. */
export async function jobsCheck(source: EnvSource, read: JobsReader = readJobs): Promise<JobsCheck> {
  let supabase: { url: string; key: string } | null | undefined;
  try {
    supabase = readEnv(source).supabase;
  } catch {
    return 'unknown';
  }
  if (!supabase) return 'off';
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error('timed out'));
      }, JOBS_TIMEOUT_MS);
    });
    const { state } = await Promise.race([read(supabase), timeout]);
    return state;
  } catch {
    // What failed is for the function logs, never for this public body.
    return 'unknown';
  } finally {
    clearTimeout(timer);
  }
}

/** The health of the deployment whose environment is `source`, and its status. Never throws. */
export function healthOf(source: EnvSource, jobs: JobsCheck = 'off'): { status: 200 | 503; body: Health } {
  let env: 'ok' | 'failed' = 'ok';
  try {
    readEnv(source);
  } catch {
    // What failed is for the function logs (every other entry fails its start with it), never for this public body.
    env = 'failed';
  }
  const ok = env === 'ok' && jobs !== 'late';
  return { status: ok ? 200 : 503, body: { ok, app: 'omni-app', commit: readCommit(source), checks: { env, jobs: env === 'ok' ? jobs : 'unknown' } } };
}

const NO_STORE = { 'cache-control': 'no-store' };

const notAllowed = (): Response =>
  new Response('method not allowed', { status: 405, headers: { ...NO_STORE, allow: 'GET', 'content-type': 'text/plain; charset=utf-8' } });

/** The methods of `/api/health`, reading the environment from `source` on each request. */
export function healthRoute(source: () => EnvSource, read: JobsReader = readJobs) {
  return {
    GET: async (): Promise<Response> => {
      const env = source();
      const { status, body } = healthOf(env, await jobsCheck(env, read));
      return Response.json(body, { status, headers: NO_STORE });
    },
    POST: notAllowed,
    PUT: notAllowed,
    PATCH: notAllowed,
    DELETE: notAllowed,
  };
}
