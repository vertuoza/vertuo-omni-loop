// What the Outbox tab says of a send once GitHub has sent the person back (PRD 251, "Send posts the reply
// as you", steps 5 to 7): posted — Sent as @login, the comment's link, and the next step,
// `/omni:yolo-fix <n>` — with a warning when GitHub lists the person as someone whose reply the kit does
// not count; failed, with why; or waiting, when no outcome was recorded (the person came back some other
// way). Pure and safe in the browser: the tab's client code receives it as it is.

/** A row of outbox_sends, as its owner reads it. */
export type SendRow = {
  id: string;
  dossier_id: string;
  pr_number: number;
  reply: string;
  nonce_hash: string;
  created_at: string;
  posted_at: string | null;
  comment_url: string | null;
  login: string | null;
  counted: boolean | null;
  error: string | null;
};

export type SentView =
  | { state: 'posted'; login: string; url: string; counted: boolean; next: string; reply: string; at: string }
  | { state: 'failed'; error: string }
  | { state: 'waiting' };

/** Why the callback sent the person back without touching the send (`?send_error=`). */
export const SEND_ERRORS = {
  state: 'The way back from GitHub did not match this send, so nothing was posted.',
  signin: 'Sign in again, then send: nothing was posted.',
} as const;

export type SendErrorCode = keyof typeof SEND_ERRORS;

export const isSendError = (value: unknown): value is SendErrorCode => typeof value === 'string' && Object.hasOwn(SEND_ERRORS, value);

/** The next step once the reply is on the pull request. */
export const nextStep = (prd: number | null) => (prd === null ? '/omni:yolo-fix' : `/omni:yolo-fix ${prd}`);

export function sentView(row: SendRow | null, prd: number | null, error: SendErrorCode | null): SentView | null {
  if (error) return { state: 'failed', error: SEND_ERRORS[error] };
  if (!row) return null;
  if (row.error !== null) return { state: 'failed', error: row.error };
  if (row.posted_at === null || row.comment_url === null) return { state: 'waiting' };
  return {
    state: 'posted', login: row.login ?? 'you', url: row.comment_url, counted: row.counted !== false, next: nextStep(prd),
    reply: row.reply, at: row.posted_at,
  };
}
