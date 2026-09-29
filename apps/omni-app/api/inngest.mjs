// `/api/inngest`: where Inngest syncs the app and calls its functions. A Vercel function in the
// web-standard shape (a `Request` in, a `Response` out), served through the SDK's web-standard
// adapter. Inngest's signing key (`INNGEST_SIGNING_KEY`) is read by the SDK itself; in production
// every call not signed with it is refused.
//
// It serves four functions: the outbox check (PRD 28), the retro (PRD 72) and the knowledge harvest
// (PRD 82), each with its own failure handler, which Inngest registers as a function of its own, and
// `prStats` (PRD 612), the Engineering board's collector, on a 15-minute schedule.
import { serve } from 'inngest/edge';
import { inngest } from '../src/inngest-client.mjs';
import { knowledgeHarvest } from '../src/knowledge-harvest/knowledge-harvest.mjs';
import { outboxCheck } from '../src/outbox-check/outbox-check.mjs';
import { prStats } from '../src/pr-stats/pr-stats.mjs';
import { retro } from '../src/retro/retro.mjs';

export const functions = [outboxCheck, retro, knowledgeHarvest, prStats];

const handler = serve({ client: inngest, functions });

export { handler as GET, handler as POST, handler as PUT };
