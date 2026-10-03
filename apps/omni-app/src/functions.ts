// The six Inngest functions `/api/inngest` serves, each wired to the app's Inngest client, to
// installation tokens signed with the GitHub App's key, and to the groups of the app's environment it
// needs (./env.ts): the outbox check (PRD 28), the inbox check (PRD 675) with its canon gate (PRD 839),
// the retro with its day-14 run (PRD 72), the knowledge harvest (PRD 82), the pr-stats collector
// (PRD 612) and the canon buttons (PRD 839). A test hands `octokitFor` a stubbed GitHub.
import type { AppEnv } from './env.ts';
import { liveCanon } from './canon/live.ts';
import { createCanonAction } from './inbox-check/canon-action.ts';
import { createInboxCheck } from './inbox-check/inbox-check.ts';
import { inngest } from './inngest-client.ts';
import { createKnowledgeHarvest } from './knowledge-harvest/knowledge-harvest.ts';
import { createOutboxCheck, installationOctokitFor } from './outbox-check/outbox-check.ts';
import { createPrStats } from './pr-stats/pr-stats.ts';
import { createRetro } from './retro/retro.ts';

/** An installation's GitHub, as the app reads it. */
type AppOctokitFor = ReturnType<typeof installationOctokitFor>;

/** The functions, by name, in the order they are served, bound to `env`. */
export function appFunctions(env: AppEnv, { octokitFor = installationOctokitFor(env.githubApp) }: { octokitFor?: AppOctokitFor } = {}) {
  return {
    outboxCheck: createOutboxCheck({ client: inngest, octokitFor }),
    inboxCheck: createInboxCheck({ client: inngest, octokitFor, canon: liveCanon(env) }),
    retro: createRetro({ client: inngest, octokitFor, openrouter: env.openrouter, followUp: true }),
    knowledgeHarvest: createKnowledgeHarvest({ client: inngest, octokitFor, openrouter: env.openrouter }),
    prStats: createPrStats({ client: inngest, octokitFor, supabase: env.supabase }),
    canonAction: createCanonAction({ client: inngest, octokitFor, galaxyUrl: env.galaxyUrl }),
  };
}
