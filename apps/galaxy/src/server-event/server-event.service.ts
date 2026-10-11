import 'server-only';
import { createHmac } from 'node:crypto';

// Telling the GitHub App that the server changed a product PRD (PRD 1548 s4): one signed POST to
// omni-app's `/api/server-event` (apps/omni-app/src/server-event/server-event.ts), which re-posts
// `omni/approved` on the PRD's open target pull requests. Two moments send one:
//
//   - `approved`  a member approved the PRD (src/approval/approval-api.ts);
//   - `voided`    a push changed a file the approval in force pinned (the push route's `tellVoids`).
//
// The body is `{ event, dossier, at }`, signed with an HMAC-SHA256 over its exact bytes under
// STAGE_EVENT_SECRET, which both apps already share for the stage events, in `x-omni-signature-256:
// sha256=<hex>`. Telling never fails what told it: a missing secret, a refusal or a network failure is one
// line in the log, and the next webhook of each pull request posts the check anyway.

/** Where the App is served: app.yml's `url`, omni-app's production domain. */
export const OMNI_APP_URL = 'https://omni-loop.vercel.app';

/** The App's route for server events. */
export const SERVER_EVENT_PATH = '/api/server-event';

/** The header the App reads the signature from, the stage events' own. */
export const SERVER_SIGNATURE_HEADER = 'x-omni-signature-256';

/** What changed a product PRD on the server. */
export type ServerEventKind = 'approved' | 'voided';

/** One server event, as the App reads it. */
export type ServerEvent = { event: ServerEventKind; dossier: string; at: string };

/** Where and how an event is sent: the App's route, the shared secret (null: not set here), the platform's fetch and log. */
export type SendDeps = {
  url: string;
  secret: string | null;
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  log: (line: string) => void;
};

/** Sends `event` to the App, signed. @returns whether the App accepted it; never throws. */
export async function sendServerEvent(event: ServerEvent, { url, secret, fetch, log }: SendDeps): Promise<boolean> {
  const what = `the ${event.event} of dossier ${event.dossier}`;
  if (!secret) {
    log(`server event: STAGE_EVENT_SECRET is not set, ${what} is not sent to the App`);
    return false;
  }
  const body = JSON.stringify(event);
  try {
    const response = await fetch(url, {
      method: 'POST',
      body,
      headers: { 'content-type': 'application/json', [SERVER_SIGNATURE_HEADER]: `sha256=${createHmac('sha256', secret).update(body).digest('hex')}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (response.ok) return true;
    log(`server event: the App answered ${response.status} to ${what}`);
  } catch (error) {
    log(`server event: ${what} could not be sent — ${error instanceof Error ? error.message : String(error)}`);
  }
  return false;
}

/** Whether the caller's last push of a dossier voided the approval of a product PRD; `unread` when the voids could not be read. */
export type VoidedByPush = (dossier: string) => Promise<boolean | 'unread'>;

/**
 * After a push of `dossier`: when it voided a product PRD's approval, tells the App, once. A push that voided
 * nothing, or the approval of a repository's PRD, which no target pull request checks, sends nothing.
 * Never throws.
 */
export async function tellAppOfVoid(
  { voided, send, now = () => new Date(), log }: { voided: VoidedByPush; send: (event: ServerEvent) => Promise<boolean>; now?: () => Date; log: (line: string) => void },
  dossier: string,
): Promise<void> {
  try {
    const read = await voided(dossier);
    if (read === 'unread') {
      log(`server event: the voids of a push of dossier ${dossier} could not be read, the App is not told`);
      return;
    }
    if (read) await send({ event: 'voided', dossier, at: now().toISOString() });
  } catch (error) {
    log(`server event: telling the App of dossier ${dossier}'s void failed — ${error instanceof Error ? error.message : String(error)}`);
  }
}
