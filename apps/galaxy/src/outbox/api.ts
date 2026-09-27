// POST /api/outbox (PRD 251, "The page keeps the latest outbox"), as a plain function of a Request, so
// it is tested with a stubbed store and the route under app/api/outbox/ stays one line:
//
//   POST /api/outbox  <the outbox the omni-loop App evaluated>   X-Omni-Signature: sha256=<hex>
//                                                              → 200 {id, url, stale}
//
// Only the omni-loop App calls it. It checks, in order: the body's size (2 MiB at most, 413), the
// signature — an HMAC-SHA256 of the raw body keyed with OMNI_OUTBOX_SECRET, the secret the App and the
// page share, compared in constant time (401) — then the body's shape (400). It then stores the
// outbox through dossier_outbox_put(), with the service role: the dossier found or created by its key,
// and an evaluation older than the one kept changing nothing (200, `stale: true`). No workspace owns
// the repository's organisation: 404, which the App logs. `url` is the dossier's Outbox tab.
//
// Refusals are `{error}` in plain words. 503: this deployment has no database or no secret.
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { OUTBOX_MAX_BYTES, OutboxBody } from './contract';
import { outboxStore, OutboxStoreError } from './store';

/** The header the App signs the body in. */
export const SIGNATURE_HEADER = 'x-omni-signature';

export type OutboxDeps = {
  /** The secret the App signs with, or null when this deployment has none. */
  secret: string | null;
  /** A client acting as the service role, or null when no database is configured. */
  connect: (() => Pick<SupabaseClient, 'rpc'>) | null;
};

const reply = (status: number, body: unknown) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
const refuse = (status: number, error: string) => reply(status, { error });

/** Where the App reached this app, behind Vercel's proxy too: the Outbox tab's link must use it. */
function origin(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? url.host;
  const proto = request.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '');
  return `${proto}://${host}`;
}

/** The dossier's Outbox tab. */
export const outboxTab = (request: Request, id: string) => `${origin(request)}/prd/${id}?tab=outbox`;

/** Whether `signature` is `sha256=<the HMAC of raw keyed with secret>`, compared in constant time. */
export function signatureMatches(raw: Uint8Array, signature: string | null, secret: string): boolean {
  if (!signature?.startsWith('sha256=')) return false;
  const expected = createHmac('sha256', secret).update(raw).digest();
  const given = Buffer.from(signature.slice('sha256='.length), 'hex');
  return given.length === expected.length && timingSafeEqual(given, expected);
}

const tooLarge = () => refuse(413, `An outbox holds ${OUTBOX_MAX_BYTES / 1024 / 1024} MiB at most.`);

/** The raw body, or the 413 that refuses it: the declared length first, then the bytes read. */
async function rawBody(request: Request): Promise<Uint8Array | Response> {
  if (Number(request.headers.get('content-length') ?? 0) > OUTBOX_MAX_BYTES) return tooLarge();
  const raw = new Uint8Array(await request.arrayBuffer());
  return raw.byteLength > OUTBOX_MAX_BYTES ? tooLarge() : raw;
}

export async function receiveOutbox(request: Request, deps: OutboxDeps): Promise<Response> {
  if (!deps.secret || !deps.connect) return refuse(503, 'Outboxes are not taken here: this deployment has no database or no secret.');

  const raw = await rawBody(request);
  if (raw instanceof Response) return raw;
  if (!signatureMatches(raw, request.headers.get(SIGNATURE_HEADER), deps.secret)) {
    return refuse(401, 'The signature does not match this body.');
  }

  let sent: unknown;
  try {
    sent = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    return refuse(400, 'The body must be a JSON object.');
  }
  const parsed = OutboxBody.safeParse(sent);
  if (!parsed.success) {
    const [issue] = parsed.error.issues;
    return refuse(400, `The outbox is malformed: ${issue.path.join('.') || 'the body'}: ${issue.message}.`);
  }

  try {
    const { id, stale } = await outboxStore(deps.connect()).put(parsed.data);
    return reply(200, { id, url: outboxTab(request, id), stale });
  } catch (error) {
    if (!(error instanceof OutboxStoreError)) throw error;
    if (error.code === 'P0002') return refuse(404, `No workspace owns ${parsed.data.repo.split('/')[0]}.`);
    if (error.code === '22023' || error.code === '23514') return refuse(400, error.reason);
    console.error(`outbox: ${error.message}`);
    return refuse(500, 'The outbox database could not answer. Try again.');
  }
}
