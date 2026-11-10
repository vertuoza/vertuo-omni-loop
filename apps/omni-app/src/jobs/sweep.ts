// `/api/jobs-sweep` (PRD 2676 s4, spec "The sweep"): a Vercel function in the web-standard shape, bound to the
// groups of the app's environment it needs (../env.ts). It finishes what the webhook left:
//
//   GET                   first posts, `queued` and delayed, the pull-request checks due over 10 minutes (./delayed.ts);
//                         then runs the jobs due: retries, claims that ran out, anything the webhook did not finish
//   GET ?gaps=1           first the comparison (./gaps.ts, hourly); then the jobs due; and at 03:00 UTC it
//                         also forgets the jobs finished over 90 days ago, with their attempts
//   POST {"replay": id}   a `failed` job put back to `queued`, its attempts kept, then the jobs due run
//
// It answers only `Authorization: Bearer <CRON_SECRET>`, the header Vercel's cron sends: a call without it or
// with another is 401, and with no `CRON_SECRET` set every call is (fail closed). Any other method is 405. The
// body holds counts and the job's id the caller named, never a repository, a key or an error's text. The jobs run
// inside the request, within the worker's own time budget (./worker.ts), not in `waitUntil`: a cron has the whole
// function to itself.
import { timingSafeEqual } from 'node:crypto';
import { githubClient } from '@omni/github';
import { z } from 'zod';
import { log, type Logger } from 'omni-loop/kit/lib/log/log.ts';
import type { AppEnv } from '../env.ts';
import { appOctokitFor, githubStoreOf, installationOctokitFor } from '../octokit-for.ts';
import { loggedHandler, noteTo } from '../run-log/run-log.ts';
import { delayedStore, postDelayed, type DelayedSummary } from './delayed.ts';
import { compareGaps, gapsStore, type GapsSummary } from './gaps.ts';
import { jobLedger, type Replayed } from './ledger.ts';
import { liveWorkers } from './pr-checks.ts';
import { runDue, type RunSummary } from './worker.ts';

/** The groups the route reads: its own, and those the checks' worker reads (./pr-checks.ts). */
export type SweepEnv = Pick<AppEnv, 'cron'> &
  Partial<Pick<AppEnv, 'supabase' | 'githubApp' | 'openrouter' | 'constituentJudge' | 'businessLawsJudge' | 'stageEvents' | 'galaxyUrl'>>;

/** What the route does on the ledger. */
export type SweepJobs = {
  run: () => Promise<RunSummary>;
  delayed: () => Promise<DelayedSummary>;
  gaps: () => Promise<GapsSummary>;
  replay: (id: string) => Promise<Replayed>;
  forget: () => Promise<number>;
};

/** The hour (UTC) the daily forgetting runs in: the first hourly call of the day's third hour. */
export const FORGET_HOUR_UTC = 3;

/** The ledger on the database as the service role, every kind's handler wired (./pr-checks.ts); none where the App has no database. */
function liveJobs(env: SweepEnv, logger: Logger): SweepJobs | null {
  const { supabase } = env;
  if (!supabase) return null;
  const ledger = jobLedger(supabase);
  const octokitFor = installationOctokitFor(env.githubApp ?? null, githubClient({ store: githubStoreOf(supabase), log: noteTo('github', logger) }));
  return {
    run: () => runDue({ ledger, ...liveWorkers({ ...env, supabase }, octokitFor) }),
    delayed: () => postDelayed({ store: delayedStore(supabase), octokitFor }),
    gaps: () => compareGaps({ store: gapsStore(supabase), ledger, appOctokit: appOctokitFor(env.githubApp ?? null), octokitFor }),
    replay: (id) => ledger.replay(id),
    forget: () => ledger.forget(),
  };
}

const ReplayBodySchema = z.object({ replay: z.string().min(1) });

const json = (status: number, body: unknown) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

/** Whether `header` is `Bearer <secret>`, compared in constant time. */
function authorized(header: string | null, secret: string | undefined): boolean {
  if (!secret || header === null) return false;
  const given = Buffer.from(header);
  const wanted = Buffer.from(`Bearer ${secret}`);
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}

/** `GET` and `POST` of `/api/jobs-sweep`, bound to `env`; `jobs` and `clock` are the live ones unless given. */
export function jobsSweepRoute(
  env: SweepEnv,
  { logger = log, jobs = liveJobs(env, logger), clock = Date.now }: { logger?: Logger; jobs?: SweepJobs | null; clock?: () => number } = {},
) {
  const guarded = (handle: (request: Request, ledger: SweepJobs) => Promise<Response>) =>
    loggedHandler(logger, 'jobs-sweep', async (request) => {
      if (!authorized(request.headers.get('authorization'), env.cron?.secret)) return json(401, { error: 'unauthorized' });
      if (!jobs) return json(503, { error: 'no database here' });
      return handle(request, jobs);
    });

  return {
    GET: guarded(async (request, ledger) => {
      const body: { delayed?: DelayedSummary; run?: RunSummary; gaps?: GapsSummary; forgotten?: number } = {};
      if (new URL(request.url).searchParams.get('gaps') === '1') {
        body.gaps = await ledger.gaps();
        if (new Date(clock()).getUTCHours() === FORGET_HOUR_UTC) body.forgotten = await ledger.forget();
      }
      body.delayed = await ledger.delayed();
      body.run = await ledger.run();
      return json(200, { ok: true, ...body });
    }),

    POST: guarded(async (request, ledger) => {
      const parsed = ReplayBodySchema.safeParse(await request.json().catch(() => null));
      if (!parsed.success) return json(400, { error: 'expected {"replay": "<job id>"}' });
      const replayed = await ledger.replay(parsed.data.replay);
      if (!replayed.replayed) return json(409, { ok: false, replayed: false, reason: replayed.reason });
      return json(200, { ok: true, replayed: true, id: replayed.id, run: await ledger.run() });
    }),

    PUT: methodNotAllowed(logger),
    PATCH: methodNotAllowed(logger),
    DELETE: methodNotAllowed(logger),
  };
}

function methodNotAllowed(logger: Logger) {
  return loggedHandler(logger, 'jobs-sweep', () => new Response('method not allowed', { status: 405, headers: { allow: 'GET, POST' } }));
}
