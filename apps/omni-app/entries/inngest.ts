// `/api/inngest`: where Inngest syncs the app and calls its functions. A Vercel function in the
// web-standard shape (a `Request` in, a `Response` out), served through the SDK's web-standard
// adapter. Inngest's signing key (`INNGEST_SIGNING_KEY`) is read by the SDK itself; in production
// every call not signed with it is refused.
//
// The app's environment is read when this module loads (../src/env.ts): a half-set group, a malformed
// value, or in production a missing GITHUB_WEBHOOK_SECRET or GitHub App, fails the function's start
// with one error naming every variable concerned, never a value.
//
// It serves three functions (../src/functions.ts): the retro (PRD 72), the knowledge harvest (PRD 82) and the main
// watch (PRD 2410), the retro and the harvest each with its own failure handler, which Inngest registers as a
// function of its own. The pull-request checks (PRD 2688) and the App's other background jobs, the Engineering
// board's collector, the escalation sweep, the fix row stamp, the fleet board, the canon buttons and the server
// event (PRD omni-loop-3), run on the App's job ledger instead (../src/jobs/), never here.
import { serve } from 'inngest/edge';
import { processEnv, readEnv } from '../src/env.ts';
import { appFunctions } from '../src/functions.ts';
import { inngest } from '../src/inngest-client.ts';

export const functions = Object.values(appFunctions(readEnv(processEnv())));

const handler = serve({ client: inngest, functions });

export { handler as GET, handler as POST, handler as PUT };
