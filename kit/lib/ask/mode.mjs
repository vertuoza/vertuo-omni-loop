// Ask mode switched on and off in one checkout: `omni ask on | off | status` (PRD 142's spec, "The
// kit side"). The mode is the file `.omni-loop/local/ask.json`, which the hooks read. The mode is
// per checkout; the session is per terminal, opened by that terminal's first question.
//
// - `on` writes the flag and gives the person's page, `<ask.url>/ask`. It opens no session and
//   closes none, so switching it on in one terminal never touches another.
// - `off` closes every terminal's session of this checkout (and PRD 71's one, when `ask.json` still
//   names it), then deletes the flag and every terminal's file, even when the server cannot be told;
//   a session left open reads as closed on its own after 12 hours without a call.
// - `status` reads the checkout alone, as the hooks do, and calls nothing.
import { basename } from 'node:path';
import { askClient } from './client.mjs';
import { activeMode } from './hook.mjs';
import { clearMode, listTerminals, readMode, writeMode } from './local-state.mjs';

/** The longest title the contract takes for a session. */
export const TITLE_MAX = 200;

/** `on` could not switch the mode on; `message` says why, in one line. */
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

/** The person's page on `askUrl`'s server: every terminal's session, a tab each. */
export const pageUrl = (askUrl) => `${askUrl.replace(/\/+$/, '')}/ask`;

/**
 * Switches the mode on in this checkout against `askUrl`, and gives the person's page. Calls
 * nothing. Already on against that host, it changes nothing. Throws an `AskModeError` when this
 * computer has no sign-in for that host; nothing is changed then.
 *
 * @returns {{ url: string }}
 */
export function turnOn({ root, askUrl, tokens }) {
  const host = hostOf(askUrl);
  if (!tokens.read(host)) throw new AskModeError(`not signed in to ${host} — run \`omni signin\` first`);
  if (readMode(root)?.host !== host) writeMode(root, { host });
  return { url: pageUrl(askUrl) };
}

/** Closes `sessionId` through `client`: `null` once it is closed or gone, else why it was left open. */
async function closeSession(client, sessionId) {
  try {
    await client.closeSession(sessionId);
    return null;
  } catch (error) {
    return error?.status === 404 ? null : (error?.message ?? String(error));
  }
}

/**
 * Turns the mode off in this checkout: closes every terminal's session on the server when it can,
 * and PRD 71's session when `ask.json` names one, then deletes `ask.json` and every terminal's and
 * round's file whatever happens.
 *
 * @returns {Promise<{ leftOpen: { sessionId: string, host: string, reason: string }[] }>} the
 *   sessions that could not be closed, and why.
 */
export async function turnOff({ root, askUrl, tokens, fetch }) {
  const legacy = readMode(root);
  const sessions = listTerminals(root).map(({ sessionId, host }) => ({ sessionId, host }));
  if (legacy?.sessionId) sessions.push({ sessionId: legacy.sessionId, host: legacy.host });
  const host = askUrl ? hostOf(askUrl) : null;
  const client = host && sessions.some((session) => session.host === host) ? askClient({ baseUrl: askUrl, host, tokens, fetch }) : null;
  const leftOpen = [];
  const seen = new Set();
  for (const session of sessions) {
    if (seen.has(session.sessionId)) continue;
    seen.add(session.sessionId);
    const reason = session.host === host ? await closeSession(client, session.sessionId) : `ask.url no longer names ${session.host}`;
    if (reason) leftOpen.push({ ...session, reason });
  }
  clearMode(root);
  return { leftOpen };
}

/** The person's page while the mode is on as the hooks read it, or `null` when it is off. */
export function modeStatus(root) {
  const mode = activeMode(root);
  return mode ? pageUrl(mode.baseUrl) : null;
}
