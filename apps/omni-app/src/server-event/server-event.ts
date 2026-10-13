// `/api/server-event` (PRD 1548 s4): galaxy tells the App that the server changed a product PRD, so the
// App re-posts its checks, `omni/approved`, the outbox check and `omni / budgets` (PRD 1679), on that
// PRD's open target pull requests without waiting for a webhook.
//
// Galaxy POSTs `{ event, dossier, at }` here, signed with an HMAC-SHA256 over the exact body under
// `STAGE_EVENT_SECRET`, the secret both apps already share for the stage events, in the same
// `x-omni-signature-256: sha256=<hex>` header (../stage-forward/stage-forward.ts):
//
//   - `event`    `approved` (a member approved the PRD on its page), `voided` (a push changed a file
//                the approval in force pinned), `item-opened` (an outbox item was raised or rewritten
//                while open) or `item-settled` (an item was answered, or adopted as it was raised;
//                PRD 1548 s8);
//   - `dossier`  the product PRD's dossier, its id;
//   - `at`       when it happened, ISO 8601.
//
// Answers:
//   - a missing secret, or a bad or missing signature → 401, nothing sent;
//   - a signed body that is not a server event → 400;
//   - a server event → 202, one Inngest event sent (SERVER_EVENT), which ./recheck.ts runs, debounced
//     per PRD; an Inngest send that fails → 500, said in the log.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { AppEnv } from '../env.ts';
import { inngest } from '../inngest-client.ts';
import { STAGE_SIGNATURE_HEADER } from '../stage-forward/stage-forward.ts';

/** The Inngest event the route sends for a server event; ./recheck.ts listens to it. */
export const SERVER_EVENT = 'omni-loop/server.event.received';

/** The header galaxy signs with, the stage events' own. */
export const SERVER_SIGNATURE_HEADER = STAGE_SIGNATURE_HEADER;

/** What the server says changed a product PRD. */
const SERVER_EVENT_KINDS = ['approved', 'voided', 'item-opened', 'item-settled'] as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A server event, as galaxy posts it and as the Inngest event carries it. */
export const ServerEventSchema = z.object({
  event: z.enum(SERVER_EVENT_KINDS),
  dossier: z.string().regex(UUID),
  at: z.string().refine((at) => !Number.isNaN(Date.parse(at))),
});
export type ServerEvent = z.infer<typeof ServerEventSchema>;

/** The Inngest event a server event becomes. */
export type ServerEventRequest = { name: typeof SERVER_EVENT; data: ServerEvent };

/** True only for `sha256=<hex>` of the exact body under the secret, compared in constant time. */
export function verifyServerEvent(secret: string, body: string, signature: string | null): boolean {
  const given = /^sha256=([0-9a-f]{64})$/.exec(signature ?? '')?.[1];
  return given !== undefined && timingSafeEqual(Buffer.from(given, 'hex'), createHmac('sha256', secret).update(body).digest());
}

export type Reply = { status: number; body: string };

/** One server event in: verified, parsed and sent on as an Inngest event. Never throws. */
export async function receiveServerEvent(
  request: { body: string; headers: Headers },
  { secret, send, log = console.error }: { secret: string | undefined; send: (events: ServerEventRequest[]) => Promise<unknown>; log?: (line: string) => void },
): Promise<Reply> {
  if (!secret) {
    log('server event: STAGE_EVENT_SECRET is not set on this deployment, every server event is refused');
    return { status: 401, body: 'server events are not accepted here' };
  }
  if (!verifyServerEvent(secret, request.body, request.headers.get(SERVER_SIGNATURE_HEADER))) return { status: 401, body: 'bad signature' };
  let value: unknown;
  try {
    value = JSON.parse(request.body);
  } catch {
    return { status: 400, body: 'the body is not JSON' };
  }
  const parsed = ServerEventSchema.safeParse(value);
  if (!parsed.success) return { status: 400, body: 'the body is not a server event' };
  try {
    await send([{ name: SERVER_EVENT, data: parsed.data }]);
  } catch (error) {
    log(`server event: the ${parsed.data.event} of dossier ${parsed.data.dossier} was not sent on — ${error instanceof Error ? error.message : String(error)}`);
    return { status: 500, body: 'the server event could not be sent on' };
  }
  return { status: 202, body: 'accepted' };
}

/** The groups the route reads. */
export type ServerEventRouteEnv = Pick<AppEnv, 'stageEvents'>;

/** `POST` and `GET` of `/api/server-event`, bound to `env`; `send` is the app's Inngest client's unless given. */
export function serverEventRoute(
  env: ServerEventRouteEnv,
  { send = (events: ServerEventRequest[]) => inngest.send(events) }: { send?: (events: ServerEventRequest[]) => Promise<unknown> } = {},
) {
  return {
    POST: async (request: Request): Promise<Response> => {
      const { status, body } = await receiveServerEvent({ body: await request.text(), headers: request.headers }, { secret: env.stageEvents?.secret, send });
      return new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    },
    GET: (): Response => new Response('method not allowed', { status: 405, headers: { allow: 'POST' } }),
  };
}
