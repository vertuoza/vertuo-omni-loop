// `/api/github`'s handlers (PRD 1059): a Vercel function in the web-standard shape (a `Request` in, a
// `Response` out), bound to the groups of the app's environment it needs (../env.ts). It reads the raw
// body — the signature is over the exact bytes — lets `receiveWebhook` verify and filter it, sends the
// resulting jobs and wakes (no event goes to another service, PRD omni-loop-4 s4), and forwards
// a stage event to galaxy, signed with `STAGE_EVENT_SECRET`, and each touch to galaxy's
// `/api/github/touched`, signed the same way (PRD 902, s3). The webhook secret is `GITHUB_WEBHOOK_SECRET`, required in production; unset
// elsewhere, every delivery is refused (fail closed).
//
// The knowledge pack (PRD 2676 s2): a merge into a repository a product holds adds a job to the ledger; once the delivery is answered, the jobs due run in `waitUntil` (GitHub gives a
// webhook 10 seconds). A repository no product holds adds nothing and reads nothing on GitHub; a database
// failure is logged and the delivery goes on (the sweep's comparison repairs it).
//
// The fix row stamp (PRD 2011 s7) and the fleet board (PRD 2530), PRD omni-loop-3 s3: a pull request merged, closed or
// reopened adds its `fix-row-stamp` job, a merge into the default branch its `knowledge-harvest`, `retro` and `main-watch` jobs
// (PRD omni-loop-4 s2, s3, s4), and a loop pull request into the default branch its `fleet-board` job, on
// any repository the App is installed on; so does a click of a canon button (PRD
// 839) its `canon-action` job (PRD omni-loop-3 s4). A database that refuses answers 500, so
// GitHub's redelivery adds the job then; once the delivery is answered, the jobs due run in `waitUntil`.
//
// A red check suite on a watched merge commit (PRD omni-loop-4 s4) wakes the `main-watch` jobs waiting on it, and the
// jobs due run in `waitUntil` at once.
//
// The checks (PRD 2688 s7): a pull request event refreshes its checks' jobs before anything else is called,
// on any repository the App is installed on; the approved label's re-run finds its PRD's open pull requests
// on GitHub once the delivery is answered, and refreshes their `pr-approved` jobs. Then, the refresh's delay
// gone by (5 seconds, so a burst of events runs each check once, on the latest head), the jobs due run in
// `waitUntil`, every kind's handler wired (../jobs/pr-checks.ts). A database failure is logged and the
// delivery goes on: the next event, or a re-run, refreshes the jobs again.
//
// Every delivery, a GET included, writes one `webhook` line (PRD 1723 s6, ../run-log/run-log.ts): its
// outcome and status, the delivery id and the GitHub event's name in `fn`, and, once the signature is
// checked, the repository. A thrown error is logged `failed` and rethrown unchanged.
import { githubClient } from '@omni/github';
import { waitUntil } from '@vercel/functions';
import { log, type Logger } from 'omni-loop/kit/lib/log/log.ts';
import type { AppEnv } from '../env.ts';
import { MAIN_WATCH_KIND } from '../main-watch/main-watch.ts';
import { watchingJobKeys } from '../main-watch/store.ts';
import { jobLedger, REFRESH_DELAY_SECONDS, type NewJob, type RefreshJob } from '../jobs/ledger.ts';
import { approvedRerunJobs, liveWorkers, type ApprovedRerun, type WorkerEnv } from '../jobs/pr-checks.ts';
import { runDue } from '../jobs/worker.ts';
import { knowledgePackStore } from '../knowledge-pack/store.ts';
import { githubStoreOf, installationOctokitFor } from '../octokit-for.ts';
import { forwardStageEvent, stageEventUrl } from '../stage-forward/stage-forward.ts';
import { forwardTouch, touchedUrl } from '../stage-forward/touch.ts';
import { loggedHandler, noteTo } from '../run-log/run-log.ts';
import { receiveWebhook } from './webhook.ts';

/** The groups the route reads: its own, and those the checks' worker reads (../jobs/pr-checks.ts). */
export type GithubRouteEnv = Pick<AppEnv, 'webhook' | 'stageEvents' | 'galaxyUrl'> &
  Partial<Pick<AppEnv, 'supabase' | 'githubApp' | 'openrouter' | 'lawJudge' | 'constituentJudge' | 'businessLawsJudge'>>;

/** The ledger as the route uses it: add a job (whether it did), refresh one, find an approval's jobs, run the jobs due. */
export type RouteJobs = {
  /** Adds the job when a product holds its repository; whether one was added. */
  add: (job: NewJob) => Promise<boolean>;
  /** Adds the job on any repository (the fix row stamp's, the fleet board's, a canon click's); whether one was added. A refusal is thrown. */
  queue: (job: NewJob) => Promise<boolean>;
  /** Refreshes a check's job, on any repository: the latest event wins. */
  refresh: (job: RefreshJob) => Promise<unknown>;
  /** The `pr-approved` jobs of the open pull requests of the PRD whose approved label changed, read from GitHub. */
  approved: (rerun: ApprovedRerun) => Promise<RefreshJob[]>;
  /** Wakes the main watches waiting on the merge commit `sha` (a red check suite ran on it); whether one was woken. */
  wake: (sha: string) => Promise<boolean>;
  run: () => Promise<unknown>;
};

/** How long after a refresh the route runs the jobs due: the refresh's delay, and a second for the clocks. */
export const RUN_AFTER_REFRESH_MS = (REFRESH_DELAY_SECONDS + 1) * 1000;

/** The ledger on the database as the service role, every kind's handler wired; none where the App has no database. */
function liveJobs(env: GithubRouteEnv, logger: Logger): RouteJobs | null {
  const { supabase } = env;
  if (!supabase) return null;
  const ledger = jobLedger(supabase);
  const watchingKeys = watchingJobKeys(supabase);
  const store = knowledgePackStore(supabase);
  const octokitFor = installationOctokitFor(env.githubApp ?? null, githubClient({ store: githubStoreOf(supabase), log: noteTo('github', logger) }));
  const workerEnv: WorkerEnv = { ...env, supabase };
  return {
    add: async (job) => (await store.held(job.subject)) && ledger.add(job),
    queue: (job) => ledger.add(job),
    refresh: (job) => ledger.refresh(job),
    approved: async (rerun) => approvedRerunJobs(await octokitFor(rerun.installationId), rerun),
    wake: async (sha) => {
      let woke = false;
      for (const key of await watchingKeys(sha)) woke = (await ledger.wake({ kind: MAIN_WATCH_KIND, key })) || woke;
      return woke;
    },
    run: () => runDue({ ledger, ...liveWorkers(workerEnv, octokitFor) }),
  };
}

/** Waits `ms` milliseconds. */
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * One delivery's jobs: the hooks `receiveWebhook` calls (refresh the checks' jobs, take the approvals' re-runs,
 * add the pack's jobs, add the fix row stamp's and the fleet board's, a refusal of which is thrown), and the work
 * after the answer, or null when the delivery left the ledger nothing to run.
 */
function deliveryJobs(jobs: RouteJobs | null) {
  let added = false;
  let refreshed = false;
  const reruns: ApprovedRerun[] = [];
  return {
    hooks: {
      refreshJobs: async (checks: RefreshJob[]) => {
        if (!jobs) return;
        for (const job of checks) {
          await jobs.refresh(job);
          refreshed = true;
        }
      },
      rerunApproved: (asked: ApprovedRerun[]) => {
        if (jobs) reruns.push(...asked);
        return Promise.resolve();
      },
      addJobs: async (newJobs: NewJob[]) => {
        if (!jobs) return;
        for (const job of newJobs) added = (await jobs.add(job)) || added;
      },
      queueJobs: async (newJobs: NewJob[]) => {
        if (!jobs) return;
        for (const job of newJobs) added = (await jobs.queue(job)) || added;
      },
      wakeWatch: async (shas: string[]) => {
        if (!jobs) return;
        for (const sha of shas) added = (await jobs.wake(sha)) || added;
      },
    },
    after: ({ pause, say }: { pause: (ms: number) => Promise<void>; say: (line: string) => void }): Promise<void> | null => {
      const wait = refreshed || reruns.length > 0;
      if (!jobs || !(added || wait)) return null;
      return afterAnswer(jobs, { reruns, wait, pause, say });
    },
  };
}

/**
 * The work after the answer: each approval's `pr-approved` jobs found and refreshed, then, once a refreshed
 * job is due, the jobs due run. Nothing it meets is thrown: a failure is logged, and the next event, a re-run
 * or the sweep picks the jobs up.
 */
async function afterAnswer(
  jobs: RouteJobs,
  { reruns, wait, pause, say }: { reruns: ApprovedRerun[]; wait: boolean; pause: (ms: number) => Promise<void>; say: (line: string) => void },
): Promise<void> {
  const why = (error: unknown) => (error instanceof Error ? error.message : String(error));
  for (const rerun of reruns) {
    try {
      for (const job of await jobs.approved(rerun)) await jobs.refresh(job);
    } catch (error) {
      say(`the approved check of ${rerun.repository} PRD ${String(rerun.prd)} was not refreshed — ${why(error)}`);
    }
  }
  try {
    if (wait) await pause(RUN_AFTER_REFRESH_MS);
    await jobs.run();
  } catch (error) {
    say(`the run failed — ${why(error)}`);
  }
}

/** The repository a delivery names, `full_name`, or undefined when it names none. */
function repositoryOf(body: string): string | undefined {
  try {
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed !== 'object' || parsed === null || !('repository' in parsed)) return undefined;
    const { repository } = parsed;
    if (typeof repository !== 'object' || repository === null || !('full_name' in repository)) return undefined;
    return typeof repository.full_name === 'string' ? repository.full_name : undefined;
  } catch {
    return undefined;
  }
}

/**
 * `POST` and `GET` of `/api/github`, bound to `env`; `logger` is the structured logger's.
 */
export function githubRoute(
  env: GithubRouteEnv,
  {
    logger = log,
    jobs = liveJobs(env, logger),
    keepAlive = waitUntil,
    pause = sleep,
  }: {
    logger?: Logger;
    jobs?: RouteJobs | null;
    /** Keeps the function alive for the jobs after the answer: `waitUntil` of `@vercel/functions` unless given. */
    keepAlive?: (work: Promise<unknown>) => void;
    /** Waits for a refreshed job to fall due before the run: a timer unless given. */
    pause?: (ms: number) => Promise<void>;
  } = {},
) {
  const stage = { url: stageEventUrl(env.galaxyUrl), secret: env.stageEvents?.secret };
  const touched = { url: touchedUrl(env.galaxyUrl), secret: env.stageEvents?.secret };
  const say = noteTo('jobs', logger);
  return {
    POST: loggedHandler(logger, 'webhook', async (request, note) => {
      note({ deliveryId: request.headers.get('x-github-delivery') ?? undefined, fn: request.headers.get('x-github-event') ?? undefined });
      const text = await request.text();
      const delivery = deliveryJobs(jobs);
      const { status, body } = await receiveWebhook({
        body: text,
        headers: request.headers,
        secret: env.webhook?.secret,
        ...delivery.hooks,
        forward: (stageEvent) => forwardStageEvent(stageEvent, stage),
        touch: (touch) => forwardTouch(touch, touched),
      });
      // A delivery whose signature was not checked names no repository in the log.
      if (env.webhook?.secret && status !== 401) note({ repo: repositoryOf(text) });
      const after = delivery.after({ pause, say });
      if (after) keepAlive(after);
      return new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }),
    GET: loggedHandler(logger, 'webhook', () => new Response('method not allowed', { status: 405, headers: { allow: 'POST' } })),
  };
}
