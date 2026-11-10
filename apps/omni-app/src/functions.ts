// The seven Inngest functions `/api/inngest` serves, each wired to the app's Inngest client, to
// installation tokens signed with the GitHub App's key, and to the groups of the app's environment it
// needs (./env.ts): the retro with its day-14 run (PRD 72), queueing `/omni:retro-apply` as the service role (PRD 2338), the knowledge harvest (PRD 82) with its law judge (PRD 1342),
// the canon buttons (PRD 839), the server event (PRD 1548), which re-checks
// a product PRD's open target pull requests, read from the database, once galaxy says it was approved or voided,
// by refreshing their checks' jobs on the ledger and running them (PRD 2688), the fix row stamp
// (PRD 2011), which stamps a bug record's Fixes rows as the service role when their pull request merges, closes or
// reopens, and is handed no GitHub. The knowledge pack (PRD 2011) is no longer one of them: it is a job of the
// ledger (PRD 2676, ./jobs/pack.ts), so it can never run on both. Nor are the four pull-request checks, the
// outbox check (PRD 28), the inbox check (PRD 675), the approved check (PRD 1548) with its rerun on the approved
// label (PRD 1612) and the budgets check (PRD 1679): they are jobs of the ledger too (PRD 2688,
// ./jobs/pr-checks.ts), which the webhook refreshes (./webhook/github-route.ts). Nor are the pr-stats collector
// (PRD 612) and the hourly escalation sweep (PRD 1794): they are jobs the schedule adds (PRD omni-loop-3,
// ./jobs/schedule.ts, ./pr-stats/job.ts, ./escalation/job.ts). The main watch
// (PRD 2410) keeps a merged PRD's seven days on main in its tables as the service role, finds its installation on
// each target as the retro does, and queues `/omni:rewind` on its first break through the retro's runner queue. The fleet
// board (PRD 2530) reads the fleets and writes a fleet's note as the service role, and adds a loop pull request into the
// default branch to its author's fleet's GitHub project board as the delivery's installation. Every
// installation call spends the installation's budget through the shared client (PRD 902), on the store galaxy writes
// too; the retro also looks up its installation on each target of a multi-repository PRD as the App itself (PRD 1130).
// A test hands `octokitFor` a stubbed GitHub.
//
// Every function is created on the client through ./run-log/run-log.ts (PRD 1723 s6): each run that ends, its failure
// handler's included, writes one `inngest` line with the function's id in `fn`, the run id, `ok` or `failed`, and its
// `ms`. What a run throws is rethrown unchanged, so the retries and the failure handlers fire as before. The shared
// GitHub client's sentences (a budget paused or deferred) are JSON note lines too. A test hands `logger` a logger it reads.
import { githubClient } from '@omni/github';
import { log, type Logger } from 'omni-loop/kit/lib/log/log.ts';
import type { AppEnv } from './env.ts';
import { createFixRowStamp } from './fix-rows/fix-row-stamp.ts';
import { createFleetBoard } from './fleet-board/fleet-board.ts';
import { fleetBoardStore } from './fleet-board/store.ts';
import { fixRowStamper } from './fix-rows/stamp.ts';
import { createCanonAction } from './inbox-check/canon-action.ts';
import { inngest as appInngest } from './inngest-client.ts';
import { jobLedger } from './jobs/ledger.ts';
import { liveWorkers } from './jobs/pr-checks.ts';
import { runDue } from './jobs/worker.ts';
import { createKnowledgeHarvest } from './knowledge-harvest/knowledge-harvest.ts';
import { lawJudge, lawJudgeUrl } from './knowledge-harvest/law-judge.ts';
import { appOctokitFor, githubStoreOf, installationOctokitFor } from './octokit-for.ts';
import { createRetro } from './retro/retro.ts';
import { runnerQueue } from './retro/runner-queue.ts';
import { loggedClient, noteTo } from './run-log/run-log.ts';
import { createMainWatch } from './main-watch/main-watch.ts';
import { mainWatchStore } from './main-watch/store.ts';
import { createServerEventRecheck } from './server-event/recheck.ts';
import { targetsReader } from './server-event/targets.ts';

/** An installation's GitHub, as the app reads it. */
type AppOctokitFor = ReturnType<typeof installationOctokitFor>;

/** The functions, by name, in the order they are served, bound to `env`. */
export function appFunctions(
  env: AppEnv,
  {
    logger = log,
    octokitFor = installationOctokitFor(env.githubApp, githubClient({ store: githubStoreOf(env.supabase), log: noteTo('github', logger) })),
  }: { octokitFor?: AppOctokitFor; logger?: Logger } = {},
) {
  const inngest = loggedClient(appInngest, logger);
  const { supabase } = env;
  const ledger = supabase ? jobLedger(supabase) : null;
  // The server event's recheck refreshes the checks' jobs, then runs the jobs due with every kind's handler.
  const jobs = supabase && ledger ? { refresh: ledger.refresh, run: () => runDue({ ledger, ...liveWorkers({ ...env, supabase }, octokitFor) }) } : null;
  return {
    retro: createRetro({
      client: inngest,
      octokitFor,
      appOctokit: appOctokitFor(env.githubApp),
      openrouter: env.openrouter,
      followUp: true,
      queue: env.supabase ? runnerQueue(env.supabase) : null,
    }),
    knowledgeHarvest: createKnowledgeHarvest({
      client: inngest,
      octokitFor,
      openrouter: env.openrouter,
      lawJudge: env.lawJudge ? lawJudge({ url: lawJudgeUrl(env.galaxyUrl), secret: env.lawJudge.secret }) : null,
    }),
    canonAction: createCanonAction({ client: inngest, octokitFor, galaxyUrl: env.galaxyUrl }),
    serverEvent: createServerEventRecheck({ client: inngest, octokitFor, readTargets: supabase ? targetsReader(supabase) : null, jobs }),
    fixRowStamp: createFixRowStamp({ client: inngest, stamp: env.supabase ? fixRowStamper(env.supabase) : null }),
    mainWatch: createMainWatch({
      client: inngest,
      octokitFor,
      appOctokit: appOctokitFor(env.githubApp),
      store: env.supabase ? mainWatchStore(env.supabase) : null,
      queue: env.supabase ? runnerQueue(env.supabase) : null,
    }),
    fleetBoard: createFleetBoard({ client: inngest, octokitFor, store: env.supabase ? fleetBoardStore(env.supabase) : null }),
  };
}
