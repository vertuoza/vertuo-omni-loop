// The Engineering board's collector as a job of the ledger (PRD omni-loop-3 s2; PRD 612): what the `prStats`
// Inngest function did, moved over. The schedule (../jobs/schedule.ts) adds one `pr-stats` job every 15 minutes,
// keyed `pr-stats@<slot start>`, in the lane `pr-stats` (one collection at a time: a run still backfilling is
// never raced by the next slot), with 3 tries. A run collects every tracked repository of every workspace with an
// installation of the app (./collect.ts), through that installation, into the database (./supabase-store.ts).
//
// A job re-runs whole: no step is saved, and a second run writes the same rows (upserts keyed on the pull request
// and the reviewer), each repository from its cursor. A slot the sweep missed is not added later: the next one
// reads everything since each cursor. The collector keeps its own floor (half of each budget, bug 638); a call the
// shared GitHub client refuses unsent (the installation's budget below its background floor, or paused) ends the
// run `waiting`, as the worker reads every budget refusal (../jobs/worker.ts), the cursor at what was written.
//
// It needs the Supabase pair of the app's environment (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, ../env.ts).
// With the pair unset it logs one line, writes nothing and ends `skipped`. The payload holds the slot only, never a
// token (L-GDPR-2).
import type { SupabaseEnv } from '../env.ts';
import type { JobHandler, JobResult } from '../jobs/worker.ts';
import type { OctokitFor } from '../octokit-for.ts';
import { noteTo } from '../run-log/run-log.ts';
import { collectAll, type CollectSummary } from './collect.ts';
import type { GraphqlOctokit } from './github.ts';
import { type PrStatsStore, supabaseStore } from './supabase-store.ts';

export const PR_STATS_KIND = 'pr-stats';

/** The line a run that collected logs: its repositories by how they ended, and the pull requests saved. */
function collectedLine({ repositories, collected, failed, unfinished, paused, saved }: CollectSummary): string {
  return `pr-stats: ${String(repositories)} repositories: ${String(collected)} collected, ${String(failed)} failed, ${String(unfinished)} unfinished, ${String(paused)} paused; ${String(saved)} pull requests saved`;
}

/** The handler of the `pr-stats` kind, bound to GitHub, the Supabase pair (`null`: off), the store, a log and a clock. */
export function prStatsHandler({
  octokitFor,
  supabase,
  storeFor = supabaseStore,
  log = noteTo('pr-stats'),
  clock = Date.now,
}: {
  octokitFor: OctokitFor<GraphqlOctokit>;
  supabase: SupabaseEnv | null;
  storeFor?: (connection: { url: string; key: string }) => PrStatsStore;
  log?: (line: string) => void;
  clock?: () => number;
}): JobHandler {
  return async (): Promise<JobResult> => {
    if (!supabase) {
      log('prStats: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not set, so nothing is collected.');
      return { outcome: 'skipped', reason: 'no store: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not set' };
    }
    const summary = await collectAll({ store: storeFor(supabase), octokitFor, now: clock() });
    log(collectedLine(summary));
    return { outcome: 'done' };
  };
}
