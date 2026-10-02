// `/api/inngest`: where Inngest syncs the app and calls its functions. A Vercel function in the
// web-standard shape (a `Request` in, a `Response` out), served through the SDK's web-standard
// adapter. Inngest's signing key (`INNGEST_SIGNING_KEY`) is read by the SDK itself; in production
// every call not signed with it is refused.
//
// It serves six functions: the outbox check (PRD 28), the inbox check (PRD 675), the retro (PRD 72)
// and the knowledge harvest (PRD 82), each with its own failure handler, which Inngest registers as a function of its own,
// `prStats` (PRD 612), the Engineering board's collector, on a 15-minute schedule, and `canonAction`
// (PRD 839), which answers a click of a button on a red canon check.
import { serve } from 'inngest/edge';
import { canonAction } from '../src/inbox-check/canon-action.ts';
import { inboxCheck } from '../src/inbox-check/inbox-check.ts';
import { inngest } from '../src/inngest-client.ts';
import { knowledgeHarvest } from '../src/knowledge-harvest/knowledge-harvest.ts';
import { outboxCheck } from '../src/outbox-check/outbox-check.ts';
import { prStats } from '../src/pr-stats/pr-stats.ts';
import { retro } from '../src/retro/retro.ts';

export const functions = [outboxCheck, inboxCheck, retro, knowledgeHarvest, prStats, canonAction];

const handler = serve({ client: inngest, functions });

export { handler as GET, handler as POST, handler as PUT };
