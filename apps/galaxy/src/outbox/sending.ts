// The browser's side of a send (PRD 251, s11), pure and safe in the browser: what the Outbox tab keeps
// while the person is away at GitHub's authorisation, and what it reads when GitHub sends them back.
//
// Before leaving for GitHub, the tab keeps which questions the send answers, under the send's id, in the
// browser's session storage (a convenience only: without it, the picks simply stay after a posted send).
// Back on the tab with `?send=<id>`, a posted send drops those picks, since its answers now show as
// pending; a failed one keeps every pick. `?send_error=<code>` says why the callback touched nothing.
import { isSendError, type SendErrorCode } from './sent';

/** Where the tab keeps the send it is waiting on. */
export const sendingKey = (dossierId: string) => `omni-outbox-sending:${dossierId}`;

export type Sending = { send: string; numbers: number[] };

/** The kept send, as written by {@link sendingKey}'s writer; null when it is not `send`, or malformed. */
export function readSending(stored: string | null, send: string): Sending | null {
  let data: unknown;
  try {
    data = JSON.parse(stored ?? '');
  } catch {
    return null;
  }
  const value = data as Partial<Sending> | null;
  if (!value || typeof value !== 'object' || value.send !== send || !Array.isArray(value.numbers)) return null;
  const numbers = value.numbers.filter((n): n is number => Number.isInteger(n) && n > 0);
  return { send, numbers };
}

/** What GitHub's way back says, from the page's query: the send to read, or why nothing was touched. */
export type Returned = { send: string } | { error: SendErrorCode } | null;

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function returned(search: string): Returned {
  const query = new URLSearchParams(search);
  const error = query.get('send_error');
  if (isSendError(error)) return { error };
  const send = query.get('send');
  return send && ID.test(send) ? { send } : null;
}

/** `Question 4 was settled meanwhile, so it is left out.` */
export function droppedWords(numbers: number[]): string {
  return numbers.length === 1
    ? `Question ${numbers[0]} was settled meanwhile, so it is left out.`
    : `Questions ${numbers.join(', ')} were settled meanwhile, so they are left out.`;
}

/** Said after every failure: nothing was lost. */
export const KEPT = 'Your answers are kept: send them again.';
