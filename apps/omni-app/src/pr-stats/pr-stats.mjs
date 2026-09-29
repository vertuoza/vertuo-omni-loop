// `prStats`: the Inngest function that feeds the Engineering board (PRD 612). Every 15 minutes it
// collects every tracked repository of every workspace with an installation of the app (`collect.mjs`),
// through that installation, into the database (`supabase-store.mjs`), one Inngest step per repository
// and batch, so a failure stays on its repository.
//
// It needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. With either unset it logs one line and
// writes nothing. Like every new function, Inngest calls it only once the app is resynced.
//
// `createPrStats` takes the Inngest client, `octokitFor(installationId)` and `storeFor({ url, key })`,
// so a test runs the real function against a stubbed GitHub and a fake store.
import { inngest } from '../inngest-client.mjs';
import { installationOctokit } from '../outbox-check/outbox-check.mjs';
import { collectAll } from './collect.mjs';
import { supabaseStore } from './supabase-store.mjs';

export const PR_STATS_FUNCTION_ID = 'pr-stats';
export const EVERY_15_MINUTES = '*/15 * * * *';

/**
 * @param {{
 *   client: import('inngest').Inngest,
 *   octokitFor: (installationId: number) => Promise<{ graphql: Function }> | { graphql: Function },
 *   env?: Record<string, string | undefined>,
 *   storeFor?: (connection: { url: string, key: string }) => object,
 *   log?: (line: string) => void,
 *   clock?: () => number,
 * }} deps
 */
export function createPrStats({ client, octokitFor, env = process.env, storeFor = supabaseStore, log = console.log, clock = Date.now }) {
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
      const url = env.SUPABASE_URL;
      const key = env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !key) {
        log('prStats: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set, so nothing is collected.');
        return { skipped: 'no store' };
      }
      const store = storeFor({ url, key });
      const now = await step.run('clock', () => clock());
      return collectAll({ store, octokitFor, step, now });
    },
  );
}

export const prStats = createPrStats({ client: inngest, octokitFor: installationOctokit });
