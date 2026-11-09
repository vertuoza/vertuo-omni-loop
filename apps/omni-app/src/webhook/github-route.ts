// `/api/github`'s handlers (PRD 1059): a Vercel function in the web-standard shape (a `Request` in, a
// `Response` out), bound to the groups of the app's environment it needs (../env.ts). It reads the raw
// body — the signature is over the exact bytes — lets `receiveWebhook` verify and filter it, sends the
// resulting events, the fix stamps (PRD 2011 s7), the main watch's (PRD 2410) and the fleet board's (PRD 2530) among them, on the app's Inngest client, and forwards
// a stage event to galaxy, signed with `STAGE_EVENT_SECRET`, and each touch to galaxy's
// `/api/github/touched`, signed the same way (PRD 902, s3). The webhook secret is `GITHUB_WEBHOOK_SECRET`, required in production; unset
// elsewhere, every delivery is refused (fail closed).
//
// The knowledge pack (PRD 2676 s2): a merge into a repository a product holds adds a job to the ledger before
// anything goes to Inngest; once the delivery is answered, the jobs due run in `waitUntil` (GitHub gives a
// webhook 10 seconds). A repository no product holds adds nothing and reads nothing on GitHub; a database
// failure is logged and the delivery goes on (the sweep's comparison repairs it).
//
// Every delivery, a GET included, writes one `webhook` line (PRD 1723 s6, ../run-log/run-log.ts): its
// outcome and status, the delivery id and the GitHub event's name in `fn`, and, once the signature is
// checked, the repository. A thrown error is logged `failed` and rethrown unchanged.
import { githubClient } from '@omni/github';
import { waitUntil } from '@vercel/functions';
import { log, type Logger } from 'omni-loop/kit/lib/log/log.ts';
import type { AppEnv } from '../env.ts';
import type { FixStampRequest } from '../fix-rows/fix-stamp.ts';
import type { FleetBoardRequest } from '../fleet-board/events.ts';
import type { MainWatchRequest } from '../main-watch/events.ts';
import { type AppEvent, type ApprovedLabelRequest, inngest } from '../inngest-client.ts';
import { jobLedger, type NewJob } from '../jobs/ledger.ts';
import { packHandler, PACK_KIND } from '../jobs/pack.ts';
import { runDue } from '../jobs/worker.ts';
import { knowledgePackStore } from '../knowledge-pack/store.ts';
import { githubStoreOf, installationOctokitFor } from '../octokit-for.ts';
import { forwardStageEvent, stageEventUrl } from '../stage-forward/stage-forward.ts';
import { forwardTouch, touchedUrl } from '../stage-forward/touch.ts';
import { loggedHandler, noteTo } from '../run-log/run-log.ts';
import { receiveWebhook } from './webhook.ts';

/** Every event the route sends on the app's Inngest client. */
type RouteEvent = AppEvent | ApprovedLabelRequest | FixStampRequest | MainWatchRequest | FleetBoardRequest;

/** The groups the route reads. */
export type GithubRouteEnv = Pick<AppEnv, 'webhook' | 'stageEvents' | 'galaxyUrl'> & Partial<Pick<AppEnv, 'supabase' | 'githubApp'>>;

/** The ledger as the route uses it: add a job (whether it did), and run the jobs due. */
export type RouteJobs = {
  /** Adds the job when a product holds its repository; whether one was added. */
  add: (job: NewJob) => Promise<boolean>;
  run: () => Promise<unknown>;
};

/** The ledger on the database as the service role, with the pack as its one handler; none where the App has no database. */
function liveJobs(env: GithubRouteEnv, logger: Logger): RouteJobs | null {
  if (!env.supabase) return null;
  const ledger = jobLedger(env.supabase);
  const store = knowledgePackStore(env.supabase);
  return {
    add: async (job) => (await store.held(job.subject)) && ledger.add(job),
    run: () => {
      const octokitFor = installationOctokitFor(env.githubApp ?? null, githubClient({ store: githubStoreOf(env.supabase ?? null), log: noteTo('github', logger) }));
      return runDue({ ledger, handlers: { [PACK_KIND]: packHandler({ octokitFor, store }) } });
    },
  };
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
 * `POST` and `GET` of `/api/github`, bound to `env`; `send` is the app's Inngest client's unless given,
 * `logger` the structured logger's.
 */
export function githubRoute(
  env: GithubRouteEnv,
  {
    send = (events: RouteEvent[]) => inngest.send(events),
    logger = log,
    jobs = liveJobs(env, logger),
    keepAlive = waitUntil,
  }: {
    send?: (events: RouteEvent[]) => Promise<unknown>;
    logger?: Logger;
    jobs?: RouteJobs | null;
    /** Keeps the function alive for the jobs after the answer: `waitUntil` of `@vercel/functions` unless given. */
    keepAlive?: (work: Promise<unknown>) => void;
  } = {},
) {
  const stage = { url: stageEventUrl(env.galaxyUrl), secret: env.stageEvents?.secret };
  const touched = { url: touchedUrl(env.galaxyUrl), secret: env.stageEvents?.secret };
  return {
    POST: loggedHandler(logger, 'webhook', async (request, note) => {
      note({ deliveryId: request.headers.get('x-github-delivery') ?? undefined, fn: request.headers.get('x-github-event') ?? undefined });
      const text = await request.text();
      const added = { any: false };
      const { status, body } = await receiveWebhook({
        body: text,
        headers: request.headers,
        secret: env.webhook?.secret,
        send,
        sendApproved: send,
        sendStamps: send,
        sendWatch: send,
        sendBoard: send,
        addJobs: async (newJobs) => {
          if (!jobs) return;
          for (const job of newJobs) added.any = (await jobs.add(job)) || added.any;
        },
        forward: (stageEvent) => forwardStageEvent(stageEvent, stage),
        touch: (touch) => forwardTouch(touch, touched),
      });
      // A delivery whose signature was not checked names no repository in the log.
      if (env.webhook?.secret && status !== 401) note({ repo: repositoryOf(text) });
      if (added.any && jobs) keepAlive(jobs.run().catch((error: unknown) => { noteTo('jobs', logger)(`the run failed — ${error instanceof Error ? error.message : String(error)}`); }));
      return new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }),
    GET: loggedHandler(logger, 'webhook', () => new Response('method not allowed', { status: 405, headers: { allow: 'POST' } })),
  };
}
