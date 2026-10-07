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
// - `signout` forgets that host's sign-in on this computer.
// - `whoami` prints the email kept for that host (the GitHub login when there is none), or `signed out`. Past its expiry, it renews the
//   sign-in first: refused, it says the sign-in is no longer valid and exits 1.
//
// Each reads `ask.url` from the repository's config; with none, each exits 1 with one line. They run
// before a context exists, like `init` and `ask`, so a test can hand them `home` (the folder the
// credentials live under), `openBrowser`, `fetch` and `waitMs`.
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { askClient } from '../../lib/ask/client.ts';
import type { Fetch } from '../../lib/ask/client.ts';
import type { Tokens } from '../../lib/ask/schema.ts';
import { askEndpoint, credentials, credentialsHost, exchangeCode, signedInLine, SignInError } from '../../lib/ask/credentials.ts';
import { LOOPBACK_WAIT_MS, LoopbackError, startLoopback } from '../../lib/ask/loopback.ts';
import { loadContext } from '../../lib/context.ts';
import { parseArgs, println, usageError } from '../args.ts';
import type { Exec, FreeCommand, FreeIo } from '../io.ts';
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
};

export const signin = {
  withoutContext: true,
  /** `onSignedIn`, when given (by `omni init`), takes the closing line instead of stdout. */
  async run(
    args: string[],
    { cwd, stdout, stderr, exec, home, openBrowser = openInBrowser, fetch = globalThis.fetch, waitMs = LOOPBACK_WAIT_MS, onSignedIn }: FreeIo & SigninOptions,
  ) {
    noArguments('signin', args);
    const { askUrl, repo } = signInConfig(cwd, exec);
    if (!askUrl) {
      println(stderr, ASK_URL_UNSET);
      return 1;
    }
    const state = randomBytes(32).toString('base64url');
    const listener = await startLoopback({ state, timeoutMs: waitMs });
    try {
      const page = new URL(askEndpoint(askUrl, '/ask/signin'));
      page.searchParams.set('port', String(listener.port));
      page.searchParams.set('state', state);
      println(stdout, `Sign in in your browser: ${page}`);
      try {
        await openBrowser(page.toString());
      } catch {
        // No browser here: the link above opens by hand, and the listener waits all the same.
      }
      const code = await listener.code;
      const { entry, ...where } = await exchangeCode({ askUrl, code, repo, fetch });
      credentials({ home }).write(credentialsHost(askUrl), entry);
      const line = signedInLine({ ...where, repo });
      if (onSignedIn) onSignedIn(line);
      else println(stdout, line);
      return 0;
    } catch (error) {
      if (!(error instanceof LoopbackError) && !(error instanceof SignInError)) throw error;
      println(stderr, `omni signin: ${error.message}`);
      return 1;
    } finally {
      await listener.close();
    }
  },
} satisfies FreeCommand;

export const signout = {
  withoutContext: true,
  run: synchronous((args: string[], { cwd, stdout, stderr, exec, home }: FreeIo & { home?: string | undefined }): number => {
    noArguments('signout', args);
    const askUrl = askUrlOf(cwd, exec);
    if (!askUrl) {
      println(stderr, ASK_URL_UNSET);
      return 1;
    }
    const host = credentialsHost(askUrl);
    println(stdout, credentials({ home }).remove(host) ? `signed out of ${host}` : 'signed out');
    return 0;
  }),
} satisfies FreeCommand;

export const whoami = {
  withoutContext: true,
  async run(args: string[], { cwd, stdout, stderr, exec, home, fetch = globalThis.fetch }: FreeIo & { home?: string | undefined; fetch?: Fetch }) {
    noArguments('whoami', args);
    const askUrl = askUrlOf(cwd, exec);
    if (!askUrl) {
      println(stderr, ASK_URL_UNSET);
      return 1;
    }
    const host = credentialsHost(askUrl);
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
