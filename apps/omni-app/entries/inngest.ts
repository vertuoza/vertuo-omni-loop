// `/api/inngest`: where Inngest syncs the app and calls its functions. A Vercel function in the
// web-standard shape (a `Request` in, a `Response` out), served through the SDK's web-standard
// adapter. Inngest's signing key (`INNGEST_SIGNING_KEY`) is read by the SDK itself; in production
// every call not signed with it is refused.
//
// The app's environment is read when this module loads (../src/env.ts): a half-set group, a malformed
// value, or in production a missing GITHUB_WEBHOOK_SECRET or GitHub App, fails the function's start
// with one error naming every variable concerned, never a value.
//
// It serves eight functions (../src/functions.ts): the outbox check (PRD 28), the inbox check (PRD 675), the approved
// check (PRD 1548), the retro (PRD 72) and the knowledge harvest (PRD 82), the outbox, inbox, retro and harvest each with
// its own failure handler, which Inngest registers as a function of its own, `prStats` (PRD 612), the Engineering
// board's collector, on a 15-minute schedule, `canonAction` (PRD 839), which answers a click of a button on a red canon
// check, and `serverEvent` (PRD 1548), which re-checks a product PRD's open target pull requests once galaxy says the
// server approved it or voided its approval (`/api/server-event`, ./server-event.ts).
import { serve } from 'inngest/edge';
import { processEnv, readEnv } from '../src/env.ts';
import { appFunctions } from '../src/functions.ts';
import { inngest } from '../src/inngest-client.ts';

export const functions = Object.values(appFunctions(readEnv(processEnv())));

const handler = serve({ client: inngest, functions });

export { handler as GET, handler as POST, handler as PUT };
