// `/api/github`: where GitHub delivers the app's webhooks. A Vercel function in the web-standard
// shape (a `Request` in, a `Response` out). It reads the raw body — the signature is over the exact
// bytes — lets `webhook` verify and filter it, and sends the resulting events on the app's Inngest
// client. The secret is `GITHUB_WEBHOOK_SECRET`; unset, every delivery is refused (fail closed).
import { inngest } from '../src/inngest-client.mjs';
import { receiveWebhook } from '../src/webhook/webhook.mjs';

/** @param {Request} request */
export async function POST(request) {
  const { status, body } = await receiveWebhook({
    body: await request.text(),
    headers: request.headers,
    secret: process.env.GITHUB_WEBHOOK_SECRET,
    send: (events) => inngest.send(events),
  });
  return new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });
}

export function GET() {
  return new Response('method not allowed', { status: 405, headers: { allow: 'POST' } });
}
