// `/api/inngest`: where Inngest syncs the app and calls its functions. A Vercel function in the
// web-standard shape (a `Request` in, a `Response` out), served through the SDK's web-standard
// adapter. Inngest's signing key (`INNGEST_SIGNING_KEY`) is read by the SDK itself; in production
// every call not signed with it is refused.
//
// The app's environment is read when this module loads (../src/env.ts): a half-set group, a malformed
// value, or in production a missing GITHUB_WEBHOOK_SECRET or GitHub App, fails the function's start
// with one error naming every variable concerned, never a value.
//
// It serves no function (../src/functions.ts): the retro, the knowledge harvest and the main watch (PRD omni-loop-4),
// the pull-request checks (PRD 2688) and the App's other background jobs run on the App's job ledger
// (../src/jobs/), never here. The route, the package and the client stay until PRD omni-loop-5 removes them.
import { serve } from 'inngest/edge';
import { processEnv, readEnv } from '../src/env.ts';
import { appFunctions } from '../src/functions.ts';
import { inngest } from '../src/inngest-client.ts';

// Read for its check only: a half-set group or a missing production variable still fails the function's start.
readEnv(processEnv());

export const functions = appFunctions();

const handler = serve({ client: inngest, functions });

export { handler as GET, handler as POST, handler as PUT };
