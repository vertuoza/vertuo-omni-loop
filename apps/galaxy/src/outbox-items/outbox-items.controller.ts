import { authenticate, type TokenCheck } from '../ask/auth';
import { refuse, reply } from '../business-api/reply';
import {
  ItemsQuerySchema, ItemsReplySchema, OUTBOX_REFUSALS, PutReplySchema, PutRequestSchema, SettleReplySchema, SettleRequestSchema, type OutboxRefusal,
} from './outbox-items.contract';
import type { OutboxItemsService } from './outbox-items.service';

// A product PRD's outbox, at its HTTP edge for the kit (PRD 1548 s7; ADR-0095), as plain functions of a
// Request, so they are tested with a fake service and the routes stay one line each:
//
//   GET  /api/outbox/items?product=<key>&prd=<n>[&repo=<owner/name>]   every item, with its settlement
//   POST /api/outbox/items {product, prd, repo?, body, adopt?}           raises an item, or adopts one
//   POST /api/outbox/items/settle {product, prd, repo?, item, verdict, basis, answer}   settles one
//
// The kit's `server` outbox store (kit/lib/outbox/server-store.ts) calls them with the terminal's sign-in
// (a bearer token). The sign-in is checked first: signed out, 401, and no service runs. The service then
// reads and writes as the caller's access token, never a service key, so row-level security and the
// outbox RPCs decide. Each answer is checked against the contract before it leaves; each refusal is
// `{error}` in plain words (src/outbox-items/outbox-items.contract.ts). A failure is 500, logged.

/** A client acting as one access token: the Auth server's check and the outbox as that person. */
type CallerClient = TokenCheck & { service: OutboxItemsService };

export type OutboxItemsDeps = {
  /** A client acting as the given access token, or null when no database is configured. */
  connect: ((token: string) => CallerClient) | null;
  log: (line: string) => void;
};

const MAX_BODY_BYTES = 128 * 1024;
const NO_DATABASE = 'Outboxes are not available here: this deployment has no database.';
const BAD_QUERY = 'Name the PRD as `product=<key>&prd=<n>`, and the repository, when given, as `repo=owner/name`.';
const BAD_PUT = 'The body must be {"product": "<key>", "prd": <n>, "repo"?: "owner/name", "body": "<the item>", "adopt"?: true}.';
const BAD_SETTLE = 'The body must be {"product": "<key>", "prd": <n>, "repo"?: "owner/name", "item": "<id>", "verdict": "agreed" | "drifted", "basis": "<why>", "answer": "<as given>"}.';

/** The request's body read by `schema`: its value, or null when it is too large, no JSON, or out of shape. */
async function bodyAs<T>(request: Request, schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false } }): Promise<T | null> {
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return null;
  let value: unknown = null;
  try {
    value = JSON.parse(text);
  } catch {
    // Not JSON: refused as out of shape below.
  }
  const read = schema.safeParse(value);
  return read.success ? read.data : null;
}

/** The service as the caller, or the Response that refuses them. */
async function signedIn(request: Request, deps: OutboxItemsDeps): Promise<OutboxItemsService | Response> {
  if (!deps.connect) return refuse(OUTBOX_REFUSALS.unavailable, NO_DATABASE);
  const auth = await authenticate(request.headers.get('authorization'), deps.connect);
  if (!auth.ok) return refuse(auth.status, auth.error);
  return deps.connect(auth.caller.token).service;
}

/** Runs `serve` as the caller and answers its result in `shape`; a refusal in its words, a failure 500. */
async function answer(
  request: Request, deps: OutboxItemsDeps, shape: { parse: (value: unknown) => unknown },
  serve: (service: OutboxItemsService) => Promise<{ ok: true; value: unknown } | { ok: false; kind: OutboxRefusal; error: string } | Response>,
): Promise<Response> {
  const service = await signedIn(request, deps);
  if (service instanceof Response) return service;
  try {
    const served = await serve(service);
    if (served instanceof Response) return served;
    if (!served.ok) {
      if (served.kind === 'database') deps.log(`outbox-items: ${served.error}`);
      return refuse(OUTBOX_REFUSALS[served.kind], served.error);
    }
    return reply(200, shape.parse(served.value));
  } catch (error) {
    deps.log(`outbox-items: ${error instanceof Error ? error.message : String(error)}`);
    return refuse(OUTBOX_REFUSALS.database, 'The PRD\'s outbox could not answer. Try again.');
  }
}

/** GET /api/outbox/items: every item of the product PRD the query names. */
export function readOutboxItems(request: Request, deps: OutboxItemsDeps): Promise<Response> {
  return answer(request, deps, ItemsReplySchema, (service) => {
    const query = ItemsQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    return query.success ? service.items(query.data) : Promise.resolve(refuse(OUTBOX_REFUSALS.malformed, BAD_QUERY));
  });
}

/** POST /api/outbox/items: raises the item the body carries, or adopts it. */
export function putOutboxItem(request: Request, deps: OutboxItemsDeps): Promise<Response> {
  return answer(request, deps, PutReplySchema, async (service) => {
    const put = await bodyAs(request, PutRequestSchema);
    return put === null ? refuse(OUTBOX_REFUSALS.malformed, BAD_PUT) : service.put(put);
  });
}

/** POST /api/outbox/items/settle: settles the item the body names. */
export function settleOutboxItem(request: Request, deps: OutboxItemsDeps): Promise<Response> {
  return answer(request, deps, SettleReplySchema, async (service) => {
    const settle = await bodyAs(request, SettleRequestSchema);
    return settle === null ? refuse(OUTBOX_REFUSALS.malformed, BAD_SETTLE) : service.settle(settle);
  });
}
