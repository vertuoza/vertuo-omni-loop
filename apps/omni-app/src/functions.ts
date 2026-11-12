// The one Inngest function `/api/inngest` serves, wired to the app's Inngest client, to installation tokens signed
// with the GitHub App's key, and to the groups of the app's environment it needs (./env.ts): the main watch (below).
// The retro with its day-14 run (PRD 72), queueing `/omni:retro-apply` as the service role (PRD 2338), is no longer
// one of them: it is a job of the ledger (PRD omni-loop-4 s3, ./retro/retro.ts), which `/api/github` adds. Nor is
// the knowledge harvest (PRD 82, with its law judge, PRD 1342): it is a
// job of the ledger (PRD omni-loop-4 s2, ./knowledge-harvest/knowledge-harvest.ts), which `/api/github` adds. The knowledge pack (PRD 2011) is no longer one of them: it is a job of the
// ledger (PRD 2676, ./jobs/pack.ts), so it can never run on both. Nor are the four pull-request checks, the
// outbox check (PRD 28), the inbox check (PRD 675), the approved check (PRD 1548) with its rerun on the approved
// label (PRD 1612) and the budgets check (PRD 1679): they are jobs of the ledger too (PRD 2688,
// ./jobs/pr-checks.ts), which the webhook refreshes (./webhook/github-route.ts). Nor are the pr-stats collector
// (PRD 612) and the hourly escalation sweep (PRD 1794): they are jobs the schedule adds (PRD omni-loop-3,
// ./jobs/schedule.ts, ./pr-stats/job.ts, ./escalation/job.ts). Nor are the fix row stamp (PRD 2011) and the fleet
// board (PRD 2530): they are jobs the webhook adds (PRD omni-loop-3 s3, ./fix-rows/job.ts, ./fleet-board/job.ts). Nor are the canon buttons (PRD 839) and the server
// event (PRD 1548), which re-checks a product PRD's open target pull requests once galaxy says it was approved or
// voided: they are jobs `/api/github` and `/api/server-event` add (PRD omni-loop-3 s4, ./inbox-check/canon-action.ts,
// ./server-event/job.ts). The main watch
// (PRD 2410) keeps a merged PRD's seven days on main in its tables as the service role, finds its installation on
// each target as the retro does, as the App itself (PRD 1130), and queues `/omni:rewind` on its first break through
// the retro's runner queue. Every installation call spends the installation's budget through the shared client (PRD
// 902), on the store galaxy writes too. A test hands `octokitFor` a stubbed GitHub.
//
// Every function is created on the client through ./run-log/run-log.ts (PRD 1723 s6): each run that ends, a failure
// handler's included, writes one `inngest` line with the function's id in `fn`, the run id, `ok` or `failed`, and its
// `ms`. What a run throws is rethrown unchanged, so the retries and the failure handlers fire as before. The shared
// GitHub client's sentences (a budget paused or deferred) are JSON note lines too. A test hands `logger` a logger it reads.
import { githubClient } from '@omni/github';
import { log, type Logger } from 'omni-loop/kit/lib/log/log.ts';
import type { AppEnv } from './env.ts';
import { inngest as appInngest } from './inngest-client.ts';
import { appOctokitFor, githubStoreOf, installationOctokitFor } from './octokit-for.ts';
import { runnerQueue } from './retro/runner-queue.ts';
import { loggedClient, noteTo } from './run-log/run-log.ts';
import { createMainWatch } from './main-watch/main-watch.ts';
import { mainWatchStore } from './main-watch/store.ts';

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
  return {
    mainWatch: createMainWatch({
      client: inngest,
      octokitFor,
      appOctokit: appOctokitFor(env.githubApp),
      store: env.supabase ? mainWatchStore(env.supabase) : null,
      queue: env.supabase ? runnerQueue(env.supabase) : null,
    }),
  };
}
