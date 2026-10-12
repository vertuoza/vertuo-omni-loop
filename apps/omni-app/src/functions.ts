// The eight Inngest functions `/api/inngest` serves, each wired to the app's Inngest client, to
// installation tokens signed with the GitHub App's key, and to the groups of the app's environment it
// needs (./env.ts): the outbox check (PRD 28), the inbox check (PRD 675) with its canon gate (PRD 839),
// the approved check (PRD 1548), reading a product PRD's record as the service role,
// the retro with its day-14 run (PRD 72), the knowledge harvest (PRD 82) with its law judge (PRD 1342),
// the pr-stats collector (PRD 612), the canon buttons (PRD 839) and the server event (PRD 1548), which re-checks
// a product PRD's open target pull requests, read from the database, once galaxy says it was approved or voided. Every installation call spends the
// installation's budget through the shared client (PRD 902), on the store galaxy writes too; the retro also looks up its
// installation on each target of a multi-repository PRD as the App itself (PRD 1130). A test hands `octokitFor` a
// stubbed GitHub.
import { githubClient } from '@omni/github';
import type { AppEnv } from './env.ts';
import { liveCanon } from './canon/live.ts';
import { createApprovedCheck } from './approved-check/approved-check.ts';
import { recordReader } from './approved-check/record.ts';
import { createCanonAction } from './inbox-check/canon-action.ts';
import { createInboxCheck } from './inbox-check/inbox-check.ts';
import { inngest } from './inngest-client.ts';
import { createKnowledgeHarvest } from './knowledge-harvest/knowledge-harvest.ts';
import { lawJudge, lawJudgeUrl } from './knowledge-harvest/law-judge.ts';
import { appOctokitFor, githubStoreOf, installationOctokitFor } from './octokit-for.ts';
import { createOutboxCheck } from './outbox-check/outbox-check.ts';
import { productOutboxReader } from './outbox-check/product-outbox.ts';
import { createPrStats } from './pr-stats/pr-stats.ts';
import { createRetro } from './retro/retro.ts';
import { createServerEventRecheck } from './server-event/recheck.ts';
import { targetsReader } from './server-event/targets.ts';

/** An installation's GitHub, as the app reads it. */
type AppOctokitFor = ReturnType<typeof installationOctokitFor>;

/** The functions, by name, in the order they are served, bound to `env`. */
export function appFunctions(
  env: AppEnv,
  { octokitFor = installationOctokitFor(env.githubApp, githubClient({ store: githubStoreOf(env.supabase) })) }: { octokitFor?: AppOctokitFor } = {},
) {
  return {
    outboxCheck: createOutboxCheck({ client: inngest, octokitFor, readProductOutbox: env.supabase ? productOutboxReader(env.supabase) : null, galaxyUrl: env.galaxyUrl }),
    inboxCheck: createInboxCheck({ client: inngest, octokitFor, canon: liveCanon(env) }),
    approvedCheck: createApprovedCheck({ client: inngest, octokitFor, readRecord: env.supabase ? recordReader(env.supabase) : null, galaxyUrl: env.galaxyUrl }),
    retro: createRetro({ client: inngest, octokitFor, appOctokit: appOctokitFor(env.githubApp), openrouter: env.openrouter, followUp: true }),
    knowledgeHarvest: createKnowledgeHarvest({
      client: inngest,
      octokitFor,
      openrouter: env.openrouter,
      lawJudge: env.lawJudge ? lawJudge({ url: lawJudgeUrl(env.galaxyUrl), secret: env.lawJudge.secret }) : null,
    }),
    prStats: createPrStats({ client: inngest, octokitFor, supabase: env.supabase }),
    canonAction: createCanonAction({ client: inngest, octokitFor, galaxyUrl: env.galaxyUrl }),
    serverEvent: createServerEventRecheck({ client: inngest, octokitFor, readTargets: env.supabase ? targetsReader(env.supabase) : null }),
  };
}
