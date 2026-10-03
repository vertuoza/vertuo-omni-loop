// `prStats`: the Inngest function that feeds the Engineering board (PRD 612). Every 15 minutes it
// collects every tracked repository of every workspace with an installation of the app (`collect.ts`),
// through that installation, into the database (`supabase-store.ts`), one Inngest step per repository
// and batch, so a failure stays on its repository.
//
// It needs the Supabase pair of the app's environment (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
// ../env.ts). With the pair unset it logs one line and writes nothing. Like every new function, Inngest calls it only once the app is resynced.
//
// `createPrStats` takes the Inngest client, `octokitFor(installationId)`, the pair and `storeFor({ url, key })`,
// so a test runs the real function against a stubbed GitHub and a fake store.
import type { Inngest } from 'inngest';
import type { SupabaseEnv } from '../env.ts';
import type { OctokitFor } from '../octokit-for.ts';
import { collectAll } from './collect.ts';
import type { GraphqlOctokit } from './github.ts';
import { type PrStatsStore, supabaseStore } from './supabase-store.ts';

export const PR_STATS_FUNCTION_ID = 'pr-stats';
export const EVERY_15_MINUTES = '*/15 * * * *';

/** The function, bound to its client, GitHub, the Supabase pair (`null`: off), the store, a log and a clock. */
export function createPrStats({ client, octokitFor, supabase, storeFor = supabaseStore, log = console.log, clock = Date.now }: {
  client: Inngest.Any;
  octokitFor: OctokitFor<GraphqlOctokit>;
  supabase: SupabaseEnv | null;
  storeFor?: (connection: { url: string; key: string }) => PrStatsStore;
  log?: (line: string) => void;
  clock?: () => number;
}) {
  return client.createFunction(
    {
      id: PR_STATS_FUNCTION_ID,
      name: 'omni-loop · pr stats',
      triggers: [{ cron: EVERY_15_MINUTES }],
      // One collection at a time: a run still backfilling is never raced by the next tick.
      concurrency: { limit: 1 },
      retries: 2,
    },
    async ({ step }) => {
      if (!supabase) {
        log('prStats: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not set, so nothing is collected.');
        return { skipped: 'no store' };
      }
      const store = storeFor(supabase);
      const now = await step.run('clock', () => clock());
      return collectAll({ store, octokitFor, step, now });
    },
  );
}
