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
import type { StdioOptions } from 'node:child_process';
import { basename } from 'node:path';
import type { ExecText } from '../context.ts';
import { askClient } from './client.ts';
import type { Fetch, TokenStore } from './client.ts';
import { activeMode } from './hook.ts';
import { clearMode, listTerminals, readMode, writeMode } from './local-state.ts';
import { field } from './schema.ts';

/** The longest title the contract takes for a session. */
export const TITLE_MAX = 200;

/** `on` could not switch the mode on; `message` says why, in one line. */
export class AskModeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AskModeError';
  }
}

const QUIET: { encoding: 'utf8'; stdio: StdioOptions } = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] };

function attempt<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}

/** The branch the checkout is on, or the short commit when it is on none. */
export function currentBranch(root: string, exec: ExecText): string {
  return (
    attempt(() => exec('git', ['branch', '--show-current'], { cwd: root, ...QUIET }).trim())
    || attempt(() => exec('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, ...QUIET }).trim())
    || 'HEAD'
  );
}

/** `<repo slug> · <branch>`, the folder's name standing in for a slug the checkout cannot give. */
export function sessionTitle({ slug, branch, root }: { slug: string | null | undefined; branch: string; root: string }): string {
  return `${slug || basename(root)} · ${branch}`.slice(0, TITLE_MAX);
}

/** The server that `ask.url` names: the host its sign-in is kept under and ask.json records. */
const hostOf = (askUrl: string): string => new URL(askUrl).host;

/** The person's page on `askUrl`'s server: every terminal's session, a tab each. */
export const pageUrl = (askUrl: string): string => `${askUrl.replace(/\/+$/, '')}/ask`;

/**
 * Switches the mode on in this checkout against `askUrl`, and gives the person's page. Calls
 * nothing. Already on against that host, it changes nothing. Throws an `AskModeError` when this
 * computer has no sign-in for that host; nothing is changed then.
 */
export function turnOn({ root, askUrl, tokens }: { root: string; askUrl: string; tokens: Pick<TokenStore, 'read'> }): { url: string } {
  const host = hostOf(askUrl);
  if (!tokens.read(host)) throw new AskModeError(`not signed in to ${host} — run \`omni signin\` first`);
  if (readMode(root)?.host !== host) writeMode(root, { host });
  return { url: pageUrl(askUrl) };
}

/** Closes `sessionId` through `client`: `null` once it is closed or gone, else why it was left open. */
async function closeSession(client: ReturnType<typeof askClient> | null, sessionId: string): Promise<string | null> {
  try {
    // No client throws here, as it always has: the session is then named as left open.
    await client!.closeSession(sessionId);
    return null;
  } catch (error) {
    if (field(error, 'status') === 404) return null;
    const message = field(error, 'message');
    return message === undefined || message === null ? String(error) : String(message);
  }
}

/**
 * Turns the mode off in this checkout: closes every terminal's session on the server when it can,
 * and PRD 71's session when `ask.json` names one, then deletes `ask.json` and every terminal's and
 * round's file whatever happens. Answers the sessions that could not be closed, and why.
 */
export async function turnOff({ root, askUrl, tokens, fetch }: {
  root: string;
  askUrl: string | null | undefined;
  tokens: TokenStore;
  fetch?: Fetch;
}): Promise<{ leftOpen: { sessionId: string; host: string; reason: string }[] }> {
  const legacy = readMode(root);
  const sessions = listTerminals(root).map(({ sessionId, host }) => ({ sessionId, host }));
  if (legacy?.sessionId) sessions.push({ sessionId: legacy.sessionId, host: legacy.host });
  const host = askUrl ? hostOf(askUrl) : null;
  const client = askUrl && host && sessions.some((session) => session.host === host) ? askClient({ baseUrl: askUrl, host, tokens, fetch }) : null;
  const leftOpen: { sessionId: string; host: string; reason: string }[] = [];
  const seen = new Set<string>();
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
export function modeStatus(root: string): string | null {
  const mode = activeMode(root);
  return mode ? pageUrl(mode.baseUrl) : null;
}
