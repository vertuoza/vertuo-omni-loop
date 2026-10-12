// `omni signin`, `omni signout`, `omni whoami` — the person's sign-in to the server `ask.url` names,
// once per computer and per host (PRD 71's spec, "The kit side").
//
// - `signin` starts a one-shot listener on 127.0.0.1, opens `<ask.url>/ask/signin?port=<p>&state=<s>`
//   in the browser, catches the one-time code the page sends back, trades it for tokens
//   (`POST <ask.url>/api/ask/token {code}`) and keeps them in `~/.config/omni/credentials.json` at
//   mode 0600, keyed by the host of `ask.url`. It sends the checkout's `repo.slug` with the code, and
//   prints one line (PRD 459), exiting 0 on each: `signed in as <login> — <owner/repo> goes to
//   <workspace>`, `… — no workspace owns <owner/repo> yet — install the Omni App: <link>`, or `… —
//   you are not a member of <workspace>, which owns <owner/repo>`; just `signed in as <login>` when
//   the page says nothing of the repository (an older page, or no repo.slug).
//   In a remote session (`CLAUDE_CODE_REMOTE`, `SSH_CONNECTION`, `SSH_TTY` or `CODESPACES` set), on
//   Linux with no display, or with `--device`, it takes the device flow instead (PRD 1660,
//   `../../lib/ask/device.ts`): it prints `Sign in at <ask.url>/ask/device?user_code=<c>` and
//   `Check that the page shows <c>. Waiting (10 min)…`, opens no browser, polls the page until the
//   person approves the request in any browser, then trades the code as above. Refused, expired or
//   unreachable ends with one line, exit 1. A page with no device sign-in (404, or 503 without its
//   database key) says so on stderr and runs the loopback.
// - `signout` forgets that host's sign-in on this computer.
// - `whoami` prints the email kept for that host (the GitHub login when there is none), or `signed out`. Past its expiry, it renews the
//   sign-in first: refused, it says the sign-in is no longer valid and exits 1.
//
// Under `OMNI_TOKEN` (PRD 1628), which wins over the kept sign-in and leaves the file alone: `signin`
// trades the token with the checkout's `repo.slug` and opens no browser (`signed in by OMNI_TOKEN as
// <login> — <owner/repo> goes to <workspace>`); `whoami` trades it and prints `<login> (OMNI_TOKEN
// ··<last four>)`; `signout` deletes nothing and says to revoke the token on the profile page, exit 1.
// A token that does not work prints its one line (`../../lib/ask/client.ts`) and exits 1.
//
// Each reads `ask.url` from the repository's config; with none, each exits 1 with one line. They run
// before a context exists, like `init` and `ask`, so a test can hand them `home` (the folder the
// credentials live under), `openBrowser`, `fetch`, `waitMs` and `platform`.
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { AskCallError, askClient } from '../../lib/ask/client.ts';
import { homeTokens, omniTokenTail } from '../../lib/ask/client-tokens.ts';
import type { Fetch } from '../../lib/ask/client.ts';
import type { Tokens } from '../../lib/ask/schema.ts';
import { askEndpoint, credentials, credentialsHost, exchangeCode, signedInLine, SignInError } from '../../lib/ask/credentials.ts';
import { chooseFlow, DeviceError, startDevice } from '../../lib/ask/device.ts';
import type { DeviceReason } from '../../lib/ask/device.ts';
import { LOOPBACK_WAIT_MS, LoopbackError, startLoopback } from '../../lib/ask/loopback.ts';
import { loadContext } from '../../lib/context.ts';
import { parseArgs, println, usageError } from '../args.ts';
import type { Exec, FreeCommand, FreeIo, Vars } from '../io.ts';
import { synchronous } from '../synchronous.ts';

export const ASK_URL_UNSET = 'ask mode is not set up for this repository (ask.url)';

/** Opens a link in the person's browser, without waiting for it and without a shell. */
export function openInBrowser(url: string, { platform = process.platform }: { platform?: NodeJS.Platform } = {}): void {
  const [command, args]: [string, string[]] =
    platform === 'darwin' ? ['open', [url]]
      : platform === 'win32' ? ['rundll32', ['url.dll,FileProtocolHandler', url]]
        : ['xdg-open', [url]];
  const child = spawn(command, args, { detached: true, stdio: 'ignore' });
  child.on('error', () => {});
  child.unref();
}

/** `ask.url` from the repository's config, or `null`. A config error surfaces as exit 2. */
function askUrlOf(cwd: string, exec: Exec): string | null {
  return loadContext(cwd, { exec }).config.ask.url;
}

/** `ask.url` and `repo.slug` from the repository's config, each or `null`. */
function signInConfig(cwd: string, exec: Exec): { askUrl: string | null; repo: string | null } {
  const { config } = loadContext(cwd, { exec });
  return { askUrl: config.ask.url, repo: config.repo.slug ?? null };
}

/** The ask client that signs in with `OMNI_TOKEN`, or `null` when it is unset. */
function tokenClient(askUrl: string, vars: Vars, fetch: Fetch): { token: string; client: ReturnType<typeof askClient> } | null {
  const token = vars.omniToken?.token;
  if (!token) return null;
  return { token, client: askClient({ baseUrl: askUrl, host: credentialsHost(askUrl), tokens: homeTokens({ omniToken: token }), fetch }) };
}

/** `fn()`'s exit code, or 1 with the token's one line on stderr when the token does not work. */
async function orTokenLine(stderr: FreeIo['stderr'], fn: () => Promise<number>): Promise<number> {
  try {
    return await fn();
  } catch (error) {
    if (!(error instanceof AskCallError)) throw error;
    println(stderr, error.message);
    return 1;
  }
}

/** The command's arguments: none. */
function noArguments(name: string, args: string[]): void {
  const { positional } = parseArgs(name, args);
  if (positional.length > 0) throw usageError(`usage: omni ${name}`);
}

/** What a test (or `omni init`) hands `omni signin` beyond `main()`'s own. */
type SigninOptions = {
  home?: string | undefined;
  openBrowser?: (url: string) => unknown;
  fetch?: Fetch;
  waitMs?: number;
  onSignedIn?: ((line: string) => void) | undefined;
  platform?: NodeJS.Platform;
};

/** What the device flow says when the page has no device sign-in, before it runs the loopback. */
const NO_DEVICE_SIGN_IN = 'this Omni page has no device sign-in yet: using the browser on this machine';

/** The line after `omni signin: ` each way a device sign-in ends. */
const DEVICE_ENDINGS: Readonly<Record<Exclude<DeviceReason, 'unavailable'>, string>> = {
  denied: 'the sign-in was refused in the browser',
  expired: 'the sign-in link expired: run omni signin again',
  unreachable: 'unreachable',
  closed: 'the sign-in was stopped before it came back',
};

/** What signing in needs, whichever flow brings the code back. */
type SignInRun = Required<Pick<SigninOptions, 'openBrowser' | 'fetch' | 'waitMs'>> & Pick<SigninOptions, 'home' | 'onSignedIn'> & {
  askUrl: string;
  repo: string | null;
  stdout: FreeIo['stdout'];
  stderr: FreeIo['stderr'];
};

/** Trades the one-time code, keeps the sign-in for the host of `ask.url`, and prints its line. */
async function finishSignIn({ askUrl, repo, fetch, home, stdout, onSignedIn }: SignInRun, code: string): Promise<number> {
  const { entry, ...where } = await exchangeCode({ askUrl, code, repo, fetch });
  credentials({ home }).write(credentialsHost(askUrl), entry);
  const line = signedInLine({ ...where, repo });
  if (onSignedIn) onSignedIn(line);
  else println(stdout, line);
  return 0;
}

/** Opens `url` in the browser; with no browser here, the link printed opens by hand, and the listener
 * waits all the same. */
async function openQuietly(openBrowser: SignInRun['openBrowser'], url: string): Promise<void> {
  try {
    await openBrowser(url);
  } catch {
    // Nothing to do: the link is on the terminal.
  }
}

/** Signs in by the browser coming back to a listener on 127.0.0.1. */
async function signInByLoopback(run: SignInRun): Promise<number> {
  const { askUrl, stdout, stderr, openBrowser, waitMs } = run;
  const state = randomBytes(32).toString('base64url');
  const listener = await startLoopback({ state, timeoutMs: waitMs });
  try {
    const page = new URL(askEndpoint(askUrl, '/ask/signin'));
    page.search = new URLSearchParams({ port: String(listener.port), state }).toString();
    println(stdout, `Sign in in your browser: ${page}`);
    await openQuietly(openBrowser, page.toString());
    return await finishSignIn(run, await listener.code);
  } catch (error) {
    if (!(error instanceof LoopbackError) && !(error instanceof SignInError)) throw error;
    println(stderr, `omni signin: ${error.message}`);
    return 1;
  } finally {
    await listener.close();
  }
}

/** Signs in by a device request the person approves in any browser; `null` when the page has none. */
async function signInByDevice(run: SignInRun): Promise<number | null> {
  const { askUrl, stdout, stderr, fetch } = run;
  try {
    const device = await startDevice({ askUrl, purpose: 'signin', fetch });
    try {
      println(stdout, `Sign in at ${device.url}`);
      println(stdout, `Check that the page shows ${device.userCode}. Waiting (${Math.max(1, Math.round(device.waitMs / 60_000))} min)…`);
      const approval = await device.poll();
      if (!('code' in approval)) throw new DeviceError('unreachable');
      return await finishSignIn(run, approval.code);
    } finally {
      await device.close();
    }
  } catch (error) {
    if (error instanceof DeviceError) {
      if (error.reason === 'unavailable') return null;
      println(stderr, `omni signin: ${DEVICE_ENDINGS[error.reason]}`);
      return 1;
    }
    if (!(error instanceof SignInError)) throw error;
    println(stderr, `omni signin: ${error.message}`);
    return 1;
  }
}

export const signin = {
  withoutContext: true,
  /** `onSignedIn`, when given (by `omni init`), takes the closing line instead of stdout. */
  async run(
    args: string[],
    {
      cwd, stdout, stderr, exec, vars, home, openBrowser = openInBrowser, fetch = globalThis.fetch, waitMs = LOOPBACK_WAIT_MS, onSignedIn, platform = process.platform,
    }: FreeIo & SigninOptions,
  ) {
    const { positional, flags } = parseArgs('signin', args, { booleans: ['device'] });
    if (positional.length > 0) throw usageError('usage: omni signin [--device]');
    const { askUrl, repo } = signInConfig(cwd, exec);
    if (!askUrl) {
      println(stderr, ASK_URL_UNSET);
      return 1;
    }
    const byToken = tokenClient(askUrl, vars, fetch);
    if (byToken) {
      return orTokenLine(stderr, async () => {
        const line = signedInLine({ ...(await byToken.client.tradeToken({ repo })), repo, by: 'OMNI_TOKEN' });
        if (onSignedIn) onSignedIn(line);
        else println(stdout, line);
        return 0;
      });
    }
    const run: SignInRun = { askUrl, repo, stdout, stderr, home, openBrowser, fetch, waitMs, onSignedIn };
    if (chooseFlow(vars.session, platform, flags.device ? 'device' : null) === 'device') {
      const ended = await signInByDevice(run);
      if (ended !== null) return ended;
      println(stderr, NO_DEVICE_SIGN_IN);
    }
    return signInByLoopback(run);
  },
} satisfies FreeCommand;

export const signout = {
  withoutContext: true,
  run: synchronous((args: string[], { cwd, stdout, stderr, exec, vars, home }: FreeIo & { home?: string | undefined }): number => {
    noArguments('signout', args);
    const askUrl = askUrlOf(cwd, exec);
    if (!askUrl) {
      println(stderr, ASK_URL_UNSET);
      return 1;
    }
    if (vars.omniToken) {
      println(stderr, 'OMNI_TOKEN is set in this environment: revoke it on your profile page');
      return 1;
    }
    const host = credentialsHost(askUrl);
    println(stdout, credentials({ home }).remove(host) ? `signed out of ${host}` : 'signed out');
    return 0;
  }),
} satisfies FreeCommand;

export const whoami = {
  withoutContext: true,
  async run(args: string[], { cwd, stdout, stderr, exec, vars, home, fetch = globalThis.fetch }: FreeIo & { home?: string | undefined; fetch?: Fetch }) {
    noArguments('whoami', args);
    const askUrl = askUrlOf(cwd, exec);
    if (!askUrl) {
      println(stderr, ASK_URL_UNSET);
      return 1;
    }
    const host = credentialsHost(askUrl);
    const byToken = tokenClient(askUrl, vars, fetch);
    if (byToken) {
      return orTokenLine(stderr, async () => {
        const { login, email } = await byToken.client.tradeToken();
        println(stdout, `${login ?? email ?? `signed in to ${host}`} (OMNI_TOKEN ··${omniTokenTail(byToken.token)})`);
        return 0;
      });
    }
    const store = credentials({ home });
    const entry = store.read(host);
    if (!entry) {
      println(stdout, 'signed out');
      return 0;
    }
    const who = accountOf(entry, `signed in to ${host}`);
    if (!expired(entry)) {
      println(stdout, who);
      return 0;
    }
    const outcome = await askClient({ baseUrl: askUrl, host, tokens: store, fetch }).renew();
    if (outcome === 'refused') {
      println(stderr, `the sign-in of ${accountOf(entry, 'this computer')} to ${host} is no longer valid: run \`omni signin\` again`);
      return 1;
    }
    println(stdout, outcome === 'renewed' ? who : `${who} (not checked: ${host} is unreachable)`);
    return 0;
  },
} satisfies FreeCommand;

/** The account a sign-in names, as the store kept it: its email, else its login, else `fallback`. */
function accountOf(entry: Tokens, fallback: string): string {
  const named: unknown = entry.email ?? entry.login;
  return typeof named === 'string' ? named : fallback;
}

/** Past its `expires_at`, in seconds as the sign-in server gives it (or milliseconds, read as such). */
function expired({ expires_at: at }: Tokens, now: number = Date.now()): boolean {
  if (typeof at !== 'number') return false;
  return (at < 1e12 ? at * 1000 : at) <= now;
}
