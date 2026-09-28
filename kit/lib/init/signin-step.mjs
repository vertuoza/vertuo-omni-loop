// The sign-in step of `omni init` (PRD 420): signs this computer in to the Omni page `ask.url` names.
// Already signed in, it says "already". On a terminal, it runs the `omni signin` flow, which opens
// the browser; with no terminal, or a sign-in refused or timed out, it leaves `omni signin` as a
// later step. Nothing here throws: a sign-in that did not happen never makes init fail. A sign-in done
// here ends on `omni signin`'s own line, which names where this repository goes (PRD 459).
import { credentials, credentialsHost } from '../ask/credentials.mjs';

/**
 * @param {object} o
 * @param {string|null} o.askUrl           the config's `ask.url`
 * @param {string} [o.home]                the folder the credentials live under (the person's home)
 * @param {boolean} o.interactive          whether a terminal is attached
 * @param {() => Promise<number | { code: number, line?: string }>} o.signIn the `omni signin` flow,
 *   resolving to its exit code, or to that code and the line it ended on
 * @returns {Promise<{ outcome: 'signed-in' | 'already' | 'later' | 'unset', host?: string, email?: string, line?: string, why?: string }>}
 */
export async function signInStep({ askUrl, home, interactive, signIn }) {
  if (!askUrl) return { outcome: 'unset' };
  const host = credentialsHost(askUrl);
  const store = credentials({ home });
  const held = store.read(host);
  if (held) return { outcome: 'already', host, email: who(held) };
  if (!interactive) return { outcome: 'later', host, why: 'no terminal' };
  let code;
  let line;
  try {
    const done = await signIn();
    ({ code, line } = typeof done === 'number' ? { code: done } : { code: done?.code, line: done?.line });
  } catch {
    code = 1;
  }
  const entry = code === 0 ? store.read(host) : null;
  if (!entry) return { outcome: 'later', host, why: 'did not finish' };
  return { outcome: 'signed-in', host, email: who(entry), ...(line ? { line } : {}) };
}

/** Who a kept sign-in is: its email, or its GitHub login when the account keeps its email private. */
const who = (entry) => entry.email ?? entry.login;

/**
 * The sign-in's status line, and `omni signin` as the line to type later when it was not done.
 *
 * @returns {{ status: string[], todo: string[] }}
 */
export function signInLines({ outcome, host, email, line, why }) {
  if (outcome === 'signed-in' && line) return { status: [`  signin  ${line}`], todo: [] };
  if (outcome === 'signed-in') return { status: [`  signin  signed in to ${host} as ${email}`], todo: [] };
  if (outcome === 'already') return { status: [`  signin  signed in to ${host} already, as ${email}`], todo: [] };
  if (outcome === 'later') return { status: [`  signin  not signed in to ${host}: ${why}`], todo: ['omni signin'] };
  return { status: ['  signin  skipped: ask.url is not set'], todo: [] };
}
