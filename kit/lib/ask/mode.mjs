// Ask mode switched on and off in one checkout: `omni ask on | off | status` (PRD 71's spec, "The kit
// side"). The mode is the file `.omni-loop/local/ask.json`, which the hooks read: `on` opens a
// session on the server `ask.url` names and writes it, `off` closes the session and deletes it.
//
// - One session per checkout: a second `on` opens a new session, writes it, then closes the first.
//   When the new one cannot be opened, the first stays exactly as it was.
// - `off` always turns the mode off in this checkout, even when the server cannot be told; the
//   session left open then reads as closed on its own after 12 hours without a call.
// - `status` reads the checkout alone, as the hooks do, and calls nothing.
import { basename } from 'node:path';
import { askClient } from './client.mjs';
import { sessionContext } from './context.mjs';
import { activeSession } from './hook.mjs';
import { clearRound, clearSession, readSession, writeSession } from './local-state.mjs';

/** The longest title the contract takes for a session. */
export const TITLE_MAX = 200;

/** `on` could not open a session; `message` says why, in one line. */
export class AskModeError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AskModeError';
  }
}

const QUIET = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] };

function attempt(fn) {
  try {
    return fn();
  } catch {
    return null;
  }
}

/** The branch the checkout is on, or the short commit when it is on none. */
export function currentBranch(root, exec) {
  return (
    attempt(() => exec('git', ['branch', '--show-current'], { cwd: root, ...QUIET }).trim())
    || attempt(() => exec('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, ...QUIET }).trim())
    || 'HEAD'
  );
}

/** `<repo slug> · <branch>`, the folder's name standing in for a slug the checkout cannot give. */
export function sessionTitle({ slug, branch, root }) {
  return `${slug || basename(root)} · ${branch}`.slice(0, TITLE_MAX);
}

/** The server that `ask.url` names: the host its sign-in is kept under and ask.json records. */
const hostOf = (askUrl) => new URL(askUrl).host;

function refusal(host, error) {
  if (error?.status === 401) return `the sign-in to ${host} was refused — run \`omni signin\` again`;
  if (error?.status === 403) return `${host} does not let this account open a session`;
  return `could not open a session on ${host} (${error?.message ?? error})`;
}

/**
 * Opens a session titled `title` on `askUrl`'s server and makes it this checkout's, closing the one
 * it replaces. Throws an `AskModeError` when no session could be opened; nothing is changed then.
 *
 * @returns {Promise<{ url: string, replaced: { sessionId: string } | null, leftOpen: string | null }>}
 *   `leftOpen` says why the replaced session could not be closed, or is `null`.
 */
export async function turnOn({ root, askUrl, title, tokens, fetch }) {
  const host = hostOf(askUrl);
  if (!tokens.read(host)) throw new AskModeError(`not signed in to ${host} — run \`omni signin\` first`);
  const client = askClient({ baseUrl: askUrl, host, tokens, fetch });
  let opened;
  try {
    opened = await client.openSession(title, sessionContext(root));
  } catch (error) {
    throw new AskModeError(refusal(host, error));
  }
  const sessionId = typeof opened?.id === 'string' ? opened.id : '';
  const url = typeof opened?.url === 'string' ? attempt(() => new URL(opened.url, askUrl).href) : null;
  if (!sessionId || !url) throw new AskModeError(`could not open a session on ${host} (it answered with no session link)`);

  const replaced = readSession(root);
  writeSession(root, { sessionId, url, host });
  clearRound(root);
  const leftOpen = replaced && replaced.sessionId !== sessionId ? await closeSession(client, replaced, host) : null;
  return { url, replaced: replaced && { sessionId: replaced.sessionId }, leftOpen };
}

/** Closes `session` through `client`: `null` once it is closed or gone, else why it was left open. */
async function closeSession(client, session, host) {
  if (!client || session.host !== host) return `ask.url no longer names ${session.host}`;
  try {
    await client.closeSession(session.sessionId);
    return null;
  } catch (error) {
    return error?.status === 404 ? null : (error?.message ?? String(error));
  }
}

/**
 * Turns the mode off in this checkout: closes its session on the server when it can, and deletes
 * `ask.json` and the round file whatever happens.
 *
 * @returns {Promise<{ session: { sessionId: string, host: string } | null, leftOpen: string | null }>}
 *   `session` is the one that was on, or `null` when the mode was off already; `leftOpen` says why
 *   it could not be closed, or is `null`.
 */
export async function turnOff({ root, askUrl, tokens, fetch }) {
  const session = readSession(root);
  let leftOpen = null;
  if (session) {
    const host = askUrl ? hostOf(askUrl) : null;
    const client = host === session.host ? askClient({ baseUrl: askUrl, host, tokens, fetch }) : null;
    leftOpen = await closeSession(client, session, host);
  }
  clearSession(root);
  clearRound(root);
  return { session: session && { sessionId: session.sessionId, host: session.host }, leftOpen };
}

/** The link of the session the hooks would ask through, or `null` when the mode is off. */
export function modeStatus(root) {
  return activeSession(root)?.session.url ?? null;
}
