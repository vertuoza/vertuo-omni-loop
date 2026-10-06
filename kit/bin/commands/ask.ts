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
// - While the mode is on, `on` and `status` then ask the page where this checkout's questions land
//   (PRD 459): one call for `repo.slug`, and a second line, `questions go to <workspace>'s page` or the
//   page's reason why they go nowhere. That line is all it changes: a page that cannot be reached, is
//   older than the call or cannot say leaves the page's line alone, and a refusal still leaves the
//   mode on (the hooks fall back to the terminal, as whenever a call fails).
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
import { defined } from '../../lib/narrow.ts';
import { askClient } from '../../lib/ask/client.ts';
import type { Fetch, TokenStore } from '../../lib/ask/client.ts';
import type { HookStdin } from '../../lib/ask/hook-input.ts';
import { field } from '../../lib/ask/schema.ts';
import { homeTokens } from '../../lib/ask/client-tokens.ts';
import { readInput } from '../../lib/ask/hook-input.ts';
import { activeMode, endHook, postHook, preHook, promptOutput, WAIT_LIMITS } from '../../lib/ask/hook.ts';
import { AskModeError, currentBranch, modeStatus, sessionTitle, turnOff, turnOn } from '../../lib/ask/mode.ts';
import { loadConfig } from '../../lib/config.ts';
import { loadContext } from '../../lib/context.ts';
import { findRoot } from '../../lib/init/repo.ts';
import { parseArgs, println, usageError } from '../args.ts';
import type { Exec, FreeCommand, FreeIo, Out } from '../io.ts';
import { ASK_URL_UNSET } from './signin.ts';

const KINDS: readonly string[] = ['pre', 'post', 'prompt', 'end'];
const MODES: readonly string[] = ['on', 'off', 'status'];

/** What the hooks and the modes are handed beyond `main()`'s own: a test's stdin, token store, fetch and waits. */
type AskOptions = { stdin?: HookStdin; tokens?: TokenStore | undefined; fetch?: Fetch; limits?: typeof WAIT_LIMITS };
const USAGE = 'usage: omni ask hook <pre|post|prompt|end> | omni ask <on|off|status>';

/** The hook's output, or `null`. Never throws. */
async function runHook(
  kind: string,
  { cwd, exec, stdin, tokens, fetch, limits }: { cwd: string; exec: Exec } & Required<Omit<AskOptions, 'tokens'>> & Pick<AskOptions, 'tokens'>,
): Promise<unknown> {
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

/** The line saying where `slug`'s questions land, or `null` when the page cannot say. Never throws. */
async function whereLine({
  baseUrl,
  host,
  slug,
  tokens,
  fetch,
}: {
  baseUrl: string;
  host: string;
  slug: string | null;
  tokens: TokenStore;
  fetch: Fetch;
}): Promise<string | null> {
  if (!slug) return null;
  try {
    const reply = await askClient({ baseUrl, host, tokens, fetch }).whereQuestionsGo(slug);
    const name = field(field(reply, 'workspace'), 'name');
    const reason = field(reply, 'reason');
    if (typeof name === 'string' && name) return `questions go to ${name}'s page`;
    return typeof reason === 'string' && reason.trim() ? reason.replace(/\s+/g, ' ').trim() : null;
  } catch {
    return null;
  }
}

/** `on`, `off` or `status`, with the repository's context. A config error surfaces as exit 2. */
async function runMode(
  mode: string,
  { cwd, stdout, stderr, exec, tokens, fetch }: { cwd: string; stdout: Out; stderr: Out; exec: Exec; tokens: TokenStore | undefined; fetch: Fetch },
): Promise<number> {
  const ctx = loadContext(cwd, { exec });
  const { root } = ctx;
  const askUrl = ctx.config.ask.url;
  const store = tokens ?? homeTokens();

  const slug = ctx.config.repo.slug ?? null;
  const printWhere = async (baseUrl: string) => {
    const line = await whereLine({ baseUrl, host: new URL(baseUrl).host, slug, tokens: store, fetch });
    if (line) println(stdout, line);
  };

  if (mode === 'status') {
    const page = modeStatus(root);
    println(stdout, page ?? 'off');
    if (page) await printWhere(defined(activeMode(root), 'the active ask mode').baseUrl);
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
  } catch (error) {
    if (!(error instanceof AskModeError)) throw error;
    println(stderr, `omni ask on: ${error.message}`);
    return 1;
  }
  await printWhere(askUrl);
  return 0;
}

export const ask = {
  withoutContext: true,
  async run(
    args: string[],
    { cwd, stdout, stderr, exec, stdin = process.stdin, tokens, fetch = globalThis.fetch, limits = WAIT_LIMITS }: FreeIo & AskOptions,
  ) {
    const { positional } = parseArgs('ask', args);
    const [sub = '', kind = '', ...rest] = positional;
    if (MODES.includes(sub) && positional.length === 1) return runMode(sub, { cwd, stdout, stderr, exec, tokens, fetch });
    if (sub !== 'hook' || !KINDS.includes(kind) || rest.length > 0) throw usageError(USAGE);
    const output = await runHook(kind, { cwd, exec, stdin, tokens, fetch, limits });
    if (output) println(stdout, JSON.stringify(output));
    return 0;
  },
} satisfies FreeCommand;
