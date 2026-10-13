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
//
// Since PRD 1831 `OMNI_ASK` switches the mode with no file (`askMode`): `on` turns it on against
// `ask.url` in a checkout with no `ask.json`, as a cloud session's fresh clone has; `off` turns it off
// whatever the file says; unset, the file decides, as it always has.
import { loadConfig } from '../config.ts';
import type { AskSwitch } from '../env/read.ts';
import { defined, messageOf } from '../narrow.ts';
import { askClient } from './client.ts';
import type { Fetch, TokenStore } from './client.ts';
import { activeMode } from './hook.ts';
import { clearMode, listTerminals, readMode, writeMode } from './local-state.ts';
import { field } from './schema.ts';

/** `on` could not switch the mode on; `message` says why, in one line. */
export class AskModeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AskModeError';
  }
}

// The session's title lives in `./title.ts`, which the hooks read too (PRD 1180).
export { currentBranch, sessionTitle } from './title.ts';

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
    await defined(client, 'the ask client').closeSession(sessionId);
    return null;
  } catch (error) {
    if (field(error, 'status') === 404) return null;
    return messageOf(error);
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

/**
 * The mode in this checkout as `OMNI_ASK` (`askSwitch`) and `ask.json` say: the host it is on against
 * and the URL its calls go to, or `null` when it is off. `on` needs only `ask.url`; `off` wins over
 * the file; `null` reads the file alone ({@link activeMode}).
 */
export function askMode(root: string, askSwitch: AskSwitch): { host: string; baseUrl: string } | null {
  if (askSwitch === 'off') return null;
  if (askSwitch === null) return activeMode(root);
  let baseUrl: string | null;
  try {
    baseUrl = loadConfig(root).ask.url;
  } catch {
    return null;
  }
  return baseUrl ? { host: hostOf(baseUrl), baseUrl } : null;
}

/** The person's page while the mode is on as the hooks read it, or `null` when it is off. */
export function modeStatus(root: string, askSwitch: AskSwitch = null): string | null {
  const mode = askMode(root, askSwitch);
  return mode ? pageUrl(mode.baseUrl) : null;
}
