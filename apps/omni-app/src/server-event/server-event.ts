// `/api/server-event` (PRD 1548 s4): galaxy tells the App that the server changed a product PRD, so the
// App re-posts its checks, `omni/approved`, the outbox check and `omni / budgets` (PRD 1679), on that
// PRD's open target pull requests without waiting for a webhook.
//
// Galaxy POSTs `{ event, dossier, at }` here, signed with an HMAC-SHA256 over the exact body under
// `STAGE_EVENT_SECRET`, the secret both apps already share for the stage events, in the same
// `x-omni-signature-256: sha256=<hex>` header (../stage-forward/stage-forward.ts):
//
//   - `event`    `approved` (a member approved the PRD on its page), `voided` (a push changed a file
//                the approval in force pinned), `item-opened` (an outbox item was raised or rewritten
//                while open) or `item-settled` (an item was answered, or adopted as it was raised;
//                PRD 1548 s8);
//   - `dossier`  the product PRD's dossier, its id;
//   - `at`       when it happened, ISO 8601.
//
// Answers:
//   - a missing secret, or a bad or missing signature → 401, nothing queued;
//   - a signed body that is not a server event → 400;
//   - a server event → 202, its `server-event` job refreshed on the ledger (PRD omni-loop-3 s4, ./job.ts),
//     keyed by the dossier and due 5 seconds on, so a burst of events for one PRD re-checks once, from the
//     last; a queue the database refuses, or no database here → 500, said in the log. Once answered, the
//     jobs due run in `waitUntil`, after the job's 5 seconds: a failure there is logged, and the sweep runs
//     the job within a minute.
//
// Every call, a GET included, writes one `server-event` line (PRD 1723 s6, ../run-log/run-log.ts): `ok`,
// `refused` (401, 400, 405) or `failed` (500, or a thrown error, rethrown unchanged).
import { createHmac, timingSafeEqual } from 'node:crypto';
import { githubClient } from '@omni/github';
import { waitUntil } from '@vercel/functions';
import { log, type Logger } from 'omni-loop/kit/lib/log/log.ts';
import type { AppEnv } from '../env.ts';
import { jobLedger, REFRESH_DELAY_SECONDS, type RefreshJob } from '../jobs/ledger.ts';
import { liveWorkers } from '../jobs/pr-checks.ts';
import { runDue } from '../jobs/worker.ts';
import { githubStoreOf, installationOctokitFor } from '../octokit-for.ts';
import { loggedHandler, noteTo } from '../run-log/run-log.ts';
import { STAGE_SIGNATURE_HEADER } from '../stage-forward/stage-forward.ts';
import { ServerEventSchema, serverEventJob } from './job.ts';

/** The header galaxy signs with, the stage events' own. */
export const SERVER_SIGNATURE_HEADER = STAGE_SIGNATURE_HEADER;

/** True only for `sha256=<hex>` of the exact body under the secret, compared in constant time. */
export function verifyServerEvent(secret: string, body: string, signature: string | null): boolean {
  const given = /^sha256=([0-9a-f]{64})$/.exec(signature ?? '')?.[1];
  return given !== undefined && timingSafeEqual(Buffer.from(given, 'hex'), createHmac('sha256', secret).update(body).digest());
}

export type Reply = { status: number; body: string };

/** One server event in: verified, parsed and its job refreshed on the ledger. Never throws. */
export async function receiveServerEvent(
  request: { body: string; headers: Headers },
  { secret, queue, log = noteTo('server-event') }: { secret: string | undefined; queue: (job: RefreshJob) => Promise<unknown>; log?: (line: string) => void },
): Promise<Reply> {
  if (!secret) {
    log('server event: STAGE_EVENT_SECRET is not set on this deployment, every server event is refused');
    return { status: 401, body: 'server events are not accepted here' };
  }
  if (!verifyServerEvent(secret, request.body, request.headers.get(SERVER_SIGNATURE_HEADER))) return { status: 401, body: 'bad signature' };
  let value: unknown;
  try {
    value = JSON.parse(request.body);
  } catch {
    return { status: 400, body: 'the body is not JSON' };
  }
  const parsed = ServerEventSchema.safeParse(value);
  if (!parsed.success) return { status: 400, body: 'the body is not a server event' };
  try {
    await queue(serverEventJob(parsed.data));
  } catch (error) {
    log(`server event: the ${parsed.data.event} of dossier ${parsed.data.dossier} was not queued — ${error instanceof Error ? error.message : String(error)}`);
    return { status: 500, body: 'the server event could not be queued' };
  }
  return { status: 202, body: 'accepted' };
}

/** The groups the route reads: its own, and those the ledger's worker reads (../jobs/pr-checks.ts). */
export type ServerEventRouteEnv = Pick<AppEnv, 'stageEvents'> &
  Partial<Pick<AppEnv, 'supabase' | 'githubApp' | 'openrouter' | 'constituentJudge' | 'businessLawsJudge' | 'galaxyUrl'>>;

/** The ledger as the route uses it: refresh the event's job, then run the jobs due. */
export type ServerEventJobs = { refresh: (job: RefreshJob) => Promise<unknown>; run: (endsAt: number) => Promise<unknown> };

/** How long Vercel lets `/api/server-event` run, its `maxDuration` in ../../vercel.json (bug #2756): the run after the answer runs within it. */
export const SERVER_EVENT_MAX_DURATION_SECONDS = 60;

/** The ledger on the database as the service role, every kind's handler wired; none where the App has no database. */
function liveJobs(env: ServerEventRouteEnv, logger: Logger): ServerEventJobs | null {
  const { supabase } = env;
  if (!supabase) return null;
  const ledger = jobLedger(supabase);
  const octokitFor = installationOctokitFor(env.githubApp ?? null, githubClient({ store: githubStoreOf(supabase), log: noteTo('github', logger) }));
  const workers = liveWorkers({ ...env, supabase }, octokitFor);
  return { refresh: (job) => ledger.refresh(job), run: (endsAt) => runDue({ ledger, ...workers, endsAt }) };
}

/** How long after the refresh the route runs the jobs due: the job's delay, and a second for the clocks. */
const RUN_AFTER_REFRESH_MS = (REFRESH_DELAY_SECONDS + 1) * 1000;

/** Waits `ms` milliseconds. */
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** A ledger that refuses every job: the App has no database here. */
const NO_DATABASE: ServerEventJobs = {
  refresh: () => Promise.reject(new Error('the App has no database here')),
  run: () => Promise.resolve(),
};

/**
 * `POST` and `GET` of `/api/server-event`, bound to `env`; `jobs` is the ledger on the app's database unless given,
 * `logger` the structured logger's.
 */
export function serverEventRoute(
  env: ServerEventRouteEnv,
  {
    logger = log,
    jobs = liveJobs(env, logger),
    keepAlive = waitUntil,
    pause = sleep,
    clock = Date.now,
  }: {
    logger?: Logger;
    jobs?: ServerEventJobs | null;
    /** The time, to know when the function is stopped: `Date.now` unless given. */
    clock?: () => number;
    /** Keeps the function alive for the run after the answer: `waitUntil` of `@vercel/functions` unless given. */
    keepAlive?: (work: Promise<unknown>) => void;
    /** Waits for the refreshed job to fall due before the run: a timer unless given. */
    pause?: (ms: number) => Promise<void>;
  } = {},
) {
  const ledger = jobs ?? NO_DATABASE;
  const say = noteTo('jobs', logger);
  const runAfter = async (endsAt: number) => {
    try {
      await pause(RUN_AFTER_REFRESH_MS);
      await ledger.run(endsAt);
    } catch (error) {
      say(`the run failed — ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  return {
    POST: loggedHandler(logger, 'server-event', async (request) => {
      const endsAt = clock() + SERVER_EVENT_MAX_DURATION_SECONDS * 1000;
      const { status, body } = await receiveServerEvent({ body: await request.text(), headers: request.headers }, { secret: env.stageEvents?.secret, queue: ledger.refresh });
      if (status === 202 && jobs) keepAlive(runAfter(endsAt));
      return new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }),
    GET: loggedHandler(logger, 'server-event', () => new Response('method not allowed', { status: 405, headers: { allow: 'POST' } })),
  };
}
