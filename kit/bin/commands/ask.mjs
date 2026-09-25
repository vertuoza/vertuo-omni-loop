// `omni ask hook <pre|post|prompt>` — the bodies of ask mode's three harness hooks, run by the
// plugin's `hooks/hooks.json`: each reads the hook's JSON on stdin and prints the hook's output, or
// nothing. A hook never fails a session: with the mode off (no `.omni-loop/local/ask.json`, or
// `ask.url` null) — or with no repository, no config, a server that is down, a sign-in refused —
// it exits 0 with empty output, and the person's terminal prompt shows as it always did.
//
// It runs before a context exists, like `init`, so that nothing about the checkout can turn a hook
// into a usage error; `main()` hands it `{ cwd, stdout, exec }`, and a test also passes `stdin` (a
// string), `tokens` (the token store) and `limits` (the pre hook's waits).
import { askClient } from '../../lib/ask/client.mjs';
import { homeTokens } from '../../lib/ask/client-tokens.mjs';
import { activeSession, postHook, preHook, promptOutput, WAIT_LIMITS } from '../../lib/ask/hook.mjs';
import { findRoot } from '../../lib/init/repo.mjs';
import { parseArgs, println, usageError } from '../args.mjs';

const KINDS = ['pre', 'post', 'prompt'];
const USAGE = 'usage: omni ask hook <pre|post|prompt>';

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

export const ask = {
  withoutContext: true,
  async run(args, { cwd, stdout, exec, stdin = process.stdin, tokens, fetch = globalThis.fetch, limits = WAIT_LIMITS }) {
    const { positional } = parseArgs('ask', args);
    const [sub, kind, ...rest] = positional;
    if (sub !== 'hook' || !KINDS.includes(kind) || rest.length > 0) throw usageError(USAGE);
    const output = await runHook(kind, { cwd, exec, stdin, tokens, fetch, limits });
    if (output) println(stdout, JSON.stringify(output));
    return 0;
  },
};
