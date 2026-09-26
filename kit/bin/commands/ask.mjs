// `omni ask on | off | status` — ask mode switched on and off in this checkout — and
// `omni ask hook <pre|post|prompt|end>`, the bodies of its harness hooks. The mode is per checkout;
// the session is per terminal (PRD 142's spec).
//
// - `on` needs `ask.url` and a sign-in (`omni signin`). It writes `.omni-loop/local/ask.json` and
//   prints the person's page, `<ask.url>/ask`, where every terminal asking has a tab. It opens no
//   session: each terminal's first question does. Run again, it changes nothing. It exits 1 with
//   one line when it cannot.
// - `off` closes every terminal's session of this checkout, deletes `ask.json` and the terminals'
//   files, then prints `off`. `status` prints the page, or `off`.
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
import { activeMode, endHook, postHook, preHook, promptOutput, WAIT_LIMITS } from '../../lib/ask/hook.mjs';
import { AskModeError, currentBranch, modeStatus, sessionTitle, turnOff, turnOn } from '../../lib/ask/mode.mjs';
import { loadConfig } from '../../lib/config.mjs';
import { loadContext } from '../../lib/context.mjs';
import { findRoot } from '../../lib/init/repo.mjs';
import { parseArgs, println, usageError } from '../args.mjs';
import { ASK_URL_UNSET } from './signin.mjs';

const KINDS = ['pre', 'post', 'prompt', 'end'];
const MODES = ['on', 'off', 'status'];
const USAGE = 'usage: omni ask hook <pre|post|prompt|end> | omni ask <on|off|status>';

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
    const mode = activeMode(root);
    if (!mode) return null;
    if (kind === 'prompt') return promptOutput();
    const input = await readInput(stdin);
    if (!input) return null;
    const { host, baseUrl } = mode;
    const client = askClient({ baseUrl, host, tokens: tokens ?? homeTokens(), fetch });
    if (kind === 'pre') {
      const title = () => sessionTitle({ slug: loadConfig(root).repo.slug, branch: currentBranch(root, exec), root });
      return await preHook({ root, host, client, input, title, limits });
    }
    if (kind === 'end') await endHook({ root, host, client, input });
    else await postHook({ root, client, input });
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
    const { leftOpen } = await turnOff({ root, askUrl, tokens: store, fetch });
    for (const { host, reason } of leftOpen) {
      println(stderr, `omni ask off: could not close a session on ${host} (${reason}); it closes by itself after 12 hours without a call.`);
    }
    println(stdout, 'off');
    return 0;
  }

  if (!askUrl) {
    println(stderr, ASK_URL_UNSET);
    return 1;
  }
  try {
    println(stdout, turnOn({ root, askUrl, tokens: store }).url);
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
