// `/api/inngest`: where Inngest syncs the app and calls its functions. A Vercel function in the
// web-standard shape (a `Request` in, a `Response` out), served through the SDK's web-standard
// adapter. Inngest's signing key (`INNGEST_SIGNING_KEY`) is read by the SDK itself; in production
// every call not signed with it is refused.
import { serve } from 'inngest/edge';
import { inngest } from '../src/inngest-client.mjs';
import { outboxCheck } from '../src/outbox-check/outbox-check.mjs';

export const functions = [outboxCheck];

const handler = serve({ client: inngest, functions });

export { handler as GET, handler as POST, handler as PUT };
