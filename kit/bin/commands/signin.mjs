// `omni signin`, `omni signout`, `omni whoami` — the person's sign-in to the server `ask.url` names,
// once per computer and per host (PRD 71's spec, "The kit side").
//
// - `signin` starts a one-shot listener on 127.0.0.1, opens `<ask.url>/ask/signin?port=<p>&state=<s>`
//   in the browser, catches the one-time code the page sends back, trades it for tokens
//   (`POST <ask.url>/api/ask/token {code}`) and keeps them in `~/.config/omni/credentials.json` at
//   mode 0600, keyed by the host of `ask.url`. It prints `signed in as <email>`.
// - `signout` forgets that host's sign-in on this computer.
// - `whoami` prints the email kept for that host, or `signed out`.
//
// Each reads `ask.url` from the repository's config; with none, each exits 1 with one line. They run
// before a context exists, like `init` and `ask`, so a test can hand them `home` (the folder the
// credentials live under), `openBrowser`, `fetch` and `waitMs`.
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { askEndpoint, credentials, credentialsHost, exchangeCode, SignInError } from '../../lib/ask/credentials.mjs';
import { LOOPBACK_WAIT_MS, LoopbackError, startLoopback } from '../../lib/ask/loopback.mjs';
import { loadContext } from '../../lib/context.mjs';
import { parseArgs, println, usageError } from '../args.mjs';

export const ASK_URL_UNSET = 'ask mode is not set up for this repository (ask.url)';

/** Opens a link in the person's browser, without waiting for it and without a shell. */
export function openInBrowser(url, { platform = process.platform } = {}) {
  const [command, args] =
    platform === 'darwin' ? ['open', [url]]
      : platform === 'win32' ? ['rundll32', ['url.dll,FileProtocolHandler', url]]
        : ['xdg-open', [url]];
  const child = spawn(command, args, { detached: true, stdio: 'ignore' });
  child.on('error', () => {});
  child.unref();
}

/** `ask.url` from the repository's config, or `null`. A config error surfaces as exit 2. */
function askUrlOf(cwd, exec) {
  return loadContext(cwd, { exec }).config.ask.url;
}

/** The command's arguments: none. */
function noArguments(name, args) {
  const { positional } = parseArgs(name, args);
  if (positional.length > 0) throw usageError(`usage: omni ${name}`);
}

export const signin = {
  withoutContext: true,
  async run(args, { cwd, stdout, stderr, exec, home, openBrowser = openInBrowser, fetch = globalThis.fetch, waitMs = LOOPBACK_WAIT_MS }) {
    noArguments('signin', args);
    const askUrl = askUrlOf(cwd, exec);
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
      const entry = await exchangeCode({ askUrl, code, fetch });
      credentials({ home }).write(credentialsHost(askUrl), entry);
      println(stdout, `signed in as ${entry.email}`);
      return 0;
    } catch (error) {
      if (!(error instanceof LoopbackError) && !(error instanceof SignInError)) throw error;
      println(stderr, `omni signin: ${error.message}`);
      return 1;
    } finally {
      await listener.close();
    }
  },
};

export const signout = {
  withoutContext: true,
  async run(args, { cwd, stdout, stderr, exec, home }) {
    noArguments('signout', args);
    const askUrl = askUrlOf(cwd, exec);
    if (!askUrl) {
      println(stderr, ASK_URL_UNSET);
      return 1;
    }
    const host = credentialsHost(askUrl);
    println(stdout, credentials({ home }).remove(host) ? `signed out of ${host}` : 'signed out');
    return 0;
  },
};

export const whoami = {
  withoutContext: true,
  async run(args, { cwd, stdout, stderr, exec, home }) {
    noArguments('whoami', args);
    const askUrl = askUrlOf(cwd, exec);
    if (!askUrl) {
      println(stderr, ASK_URL_UNSET);
      return 1;
    }
    const entry = credentials({ home }).read(credentialsHost(askUrl));
    println(stdout, entry ? (entry.email ?? `signed in to ${credentialsHost(askUrl)}`) : 'signed out');
    return 0;
  },
};
