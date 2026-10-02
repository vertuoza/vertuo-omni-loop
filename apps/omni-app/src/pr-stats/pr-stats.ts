// `prStats`: the Inngest function that feeds the Engineering board (PRD 612). Every 15 minutes it
// collects every tracked repository of every workspace with an installation of the app (`collect.ts`),
// through that installation, into the database (`supabase-store.ts`), one Inngest step per repository
// and batch, so a failure stays on its repository.
//
// It needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. With either unset it logs one line and
// writes nothing. Like every new function, Inngest calls it only once the app is resynced.
//
// `createPrStats` takes the Inngest client, `octokitFor(installationId)` and `storeFor({ url, key })`,
// so a test runs the real function against a stubbed GitHub and a fake store.
import type { Inngest } from 'inngest';
import { inngest } from '../inngest-client.ts';
import { installationOctokit } from '../outbox-check/outbox-check.ts';
import { collectAll, type CollectStep, type OctokitFor } from './collect.ts';
import { StoreEnvSchema } from './schema.ts';
import { type PrStatsStore, supabaseStore } from './supabase-store.ts';

export const PR_STATS_FUNCTION_ID = 'pr-stats';
export const EVERY_15_MINUTES = '*/15 * * * *';

/** The function, bound to its client, GitHub, the environment, the store, a log and a clock. */
export function createPrStats({ client, octokitFor, env = process.env, storeFor = supabaseStore, log = console.log, clock = Date.now }: {
  client: Inngest.Any;
  octokitFor: OctokitFor;
  env?: Record<string, string | undefined>;
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
      const { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } = StoreEnvSchema.parse(env);
      if (!url || !key) {
        log('prStats: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set, so nothing is collected.');
        return { skipped: 'no store' };
      }
      const store = storeFor({ url, key });
      const now = await step.run('clock', () => clock());
      return collectAll({ store, octokitFor, step: step as CollectStep, now }); // ts-allow: Inngest's step answers each output as JSON, and every output the collector steps is JSON already
    },
  );
}

export const prStats = createPrStats({ client: inngest, octokitFor: installationOctokit });
