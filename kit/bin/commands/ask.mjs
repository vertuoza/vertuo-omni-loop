// `omni ask on | off | status` — ask mode switched on and off in this checkout — and
// `omni ask hook <pre|post|prompt>`, the bodies of its three harness hooks.
//
// - `on` needs `ask.url` and a sign-in (`omni signin`). It opens a session titled
//   `<repo slug> · <branch>`, writes `.omni-loop/local/ask.json` and prints the session's link; a
//   second `on` replaces the first session and closes it. It exits 1 with one line when it cannot.
// - `off` closes the session and deletes `ask.json`, then prints `off`. `status` prints the link,
//   or `off`.
// - `hook <kind>` is run by the plugin's `hooks/hooks.json`: each reads the hook's JSON on stdin and
//   prints the hook's output, or nothing. A hook never fails a session: with the mode off (no
//   `.omni-loop/local/ask.json`, or `ask.url` null) — or with no repository, no config, a server
//   that is down, a sign-in refused — it exits 0 with empty output, and the person's terminal prompt
//   shows as it always did.
//
// It runs before a context exists, like `init`, so that nothing about the checkout can turn a hook
// into a usage error; `on`, `off` and `status` load the context themselves. `main()` hands it
// `{ cwd, stdout, stderr, exec }`, and a test also passes `stdin` (a string), `tokens` (the token
// store), `fetch` and `limits` (the pre hook's waits).
import { askClient } from '../../lib/ask/client.mjs';
import { homeTokens } from '../../lib/ask/client-tokens.mjs';
import { activeSession, postHook, preHook, promptOutput, WAIT_LIMITS } from '../../lib/ask/hook.mjs';
import { AskModeError, currentBranch, modeStatus, sessionTitle, turnOff, turnOn } from '../../lib/ask/mode.mjs';
import { loadContext } from '../../lib/context.mjs';
import { findRoot } from '../../lib/init/repo.mjs';
import { parseArgs, println, usageError } from '../args.mjs';
import { ASK_URL_UNSET } from './signin.mjs';

const KINDS = ['pre', 'post', 'prompt'];
const MODES = ['on', 'off', 'status'];
const USAGE = 'usage: omni ask hook <pre|post|prompt> | omni ask <on|off|status>';

/** The hook's input: stdin parsed as a JSON object, or `null`. A terminal is never read. */
async function readInput(stdin) {
  let text = '';
  if (typeof stdin === 'string') {
    text = stdin;
  } else {
    if (!stdin || stdin.isTTY) return null;
    stdin.setEncoding?.('utf8');
    for await (const chunk of stdin) text += chunk;
  }
  try {
    const value = JSON.parse(text);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

/** The hook's output, or `null`. Never throws. */
async function runHook(kind, { cwd, exec, stdin, tokens, fetch, limits }) {
  try {
    const root = findRoot(cwd, exec);
    const active = activeSession(root);
    if (!active) return null;
    if (kind === 'prompt') return promptOutput();
    const input = await readInput(stdin);
    if (!input) return null;
    const { session, baseUrl } = active;
    const client = askClient({ baseUrl, host: session.host, tokens: tokens ?? homeTokens(), fetch });
    if (kind === 'pre') return await preHook({ root, session, client, input, limits });
    await postHook({ root, client, input });
    return null;
  } catch {
    return null;
  }
}

/** `on`, `off` or `status`, with the repository's context. A config error surfaces as exit 2. */
async function runMode(mode, { cwd, stdout, stderr, exec, tokens, fetch }) {
  const ctx = loadContext(cwd, { exec });
  const { root } = ctx;
  const askUrl = ctx.config.ask.url;
  const store = tokens ?? homeTokens();

  if (mode === 'status') {
    println(stdout, modeStatus(root) ?? 'off');
    return 0;
  }

  if (mode === 'off') {
    const { session, leftOpen } = await turnOff({ root, askUrl, tokens: store, fetch });
    if (session && leftOpen) {
      println(stderr, `omni ask off: could not close the session on ${session.host} (${leftOpen}); it closes by itself after 12 hours without a call.`);
    }
    println(stdout, 'off');
    return 0;
  }

  if (!askUrl) {
    println(stderr, ASK_URL_UNSET);
    return 1;
  }
  const title = sessionTitle({ slug: ctx.config.repo.slug, branch: currentBranch(root, exec), root });
  try {
    const { url, replaced, leftOpen } = await turnOn({ root, askUrl, title, tokens: store, fetch });
    if (replaced && leftOpen) {
      println(stderr, `omni ask on: the session this one replaces could not be closed (${leftOpen}); it closes by itself after 12 hours without a call.`);
    }
    println(stdout, url);
    return 0;
  } catch (error) {
    if (!(error instanceof AskModeError)) throw error;
    println(stderr, `omni ask on: ${error.message}`);
    return 1;
  }
}

export const ask = {
  withoutContext: true,
  async run(args, { cwd, stdout, stderr, exec, stdin = process.stdin, tokens, fetch = globalThis.fetch, limits = WAIT_LIMITS }) {
    const { positional } = parseArgs('ask', args);
    const [sub, kind, ...rest] = positional;
    if (MODES.includes(sub) && positional.length === 1) return runMode(sub, { cwd, stdout, stderr, exec, tokens, fetch });
    if (sub !== 'hook' || !KINDS.includes(kind) || rest.length > 0) throw usageError(USAGE);
    const output = await runHook(kind, { cwd, exec, stdin, tokens, fetch, limits });
    if (output) println(stdout, JSON.stringify(output));
    return 0;
  },
};
