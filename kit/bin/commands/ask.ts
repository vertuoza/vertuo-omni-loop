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
// - `question --file <q.json> [--wait <seconds>]`, `wait <round> [--wait <seconds>]` and
//   `answer <round> --file <a.json>` (PRD 1831) ask the person on the page from any agent, with no
//   hook, stdin or TTY (`../../lib/ask/question.ts`). `question` and `wait` exit 0 with
//   `{ round, answers, shots }` once answered; 3, stdout empty and one line on stderr, when the agent
//   must ask in its own chat (the mode off, no sign-in, the page unreachable or refusing, the round
//   abandoned or closed); 4 with `round <id>` when the wait (110 s by default, 10 to 540) ran out with
//   the round open; 2 for a usage error or a file that does not read, the field named. `answer` sends
//   the chat's answer with `via: "terminal"` and exits 0 even when that fails, with one line on stderr.
// - `OMNI_ASK` (`on`, `off`) switches the mode with no file, for these verbs, the hooks and `status`
//   alike (`askMode`).
//
// It runs before a context exists, like `init`, so that nothing about the checkout can turn a hook
// into a usage error; `on`, `off` and `status` load the context themselves. `main()` hands it
// `{ cwd, stdout, stderr, exec }`, and a test also passes `stdin` (a string), `tokens` (the token
// store), `fetch` and `limits` (the pre hook's waits).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defined } from '../../lib/narrow.ts';
import { askClient } from '../../lib/ask/client.ts';
import type { Fetch, TokenStore } from '../../lib/ask/client.ts';
import type { HookStdin } from '../../lib/ask/hook-input.ts';
import { field, readQuestionFile } from '../../lib/ask/schema.ts';
import { homeTokens } from '../../lib/ask/client-tokens.ts';
import { readInput } from '../../lib/ask/hook-input.ts';
import { endHook, postHook, preHook, promptOutput, WAIT_LIMITS } from '../../lib/ask/hook.ts';
import { askMode, AskModeError, currentBranch, modeStatus, sessionTitle, turnOff, turnOn } from '../../lib/ask/mode.ts';
import type { AskOutcome } from '../../lib/ask/question.ts';
import {
  answerQuestion, askQuestion, CALL_MS, failureReason, readAnswerFile, resumeQuestion, WAIT_DEFAULT_S, WAIT_MAX_S, WAIT_MIN_S,
} from '../../lib/ask/question.ts';
import { isSafeId } from '../../lib/ask/local-state.ts';
import { mainCheckout } from '../../lib/dossier/local.ts';
import { openSessionId } from '../../lib/dossier/session.ts';
import { unattendedOf } from '../../lib/env/read.ts';
import type { AskSwitch } from '../../lib/env/read.ts';
import { loadConfig } from '../../lib/config.ts';
import { loadContext } from '../../lib/context.ts';
import { findRoot } from '../../lib/init/repo.ts';
import { parseArgs, println, usageError } from '../args.ts';
import type { Env, Exec, FreeCommand, FreeIo, Out, Vars } from '../io.ts';
import { ASK_URL_UNSET } from './signin.ts';

const KINDS: readonly string[] = ['pre', 'post', 'prompt', 'end'];
const MODES: readonly string[] = ['on', 'off', 'status'];
const VERBS: readonly string[] = ['question', 'wait', 'answer'];

/** How the CLI's verbs wait: the milliseconds a second of `--wait` lasts, and the most one call may take. */
type Pace = { secondMs: number; callMs: number };
const PACE: Pace = Object.freeze({ secondMs: 1000, callMs: CALL_MS });

/** What the hooks and the modes are handed beyond `main()`'s own: a test's stdin, token store, fetch,
 * the hook's waits and the verbs' pace. */
type AskOptions = { stdin?: HookStdin; tokens?: TokenStore | undefined; fetch?: Fetch; limits?: typeof WAIT_LIMITS; pace?: Pace };
const USAGE =
  'usage: omni ask hook <pre|post|prompt|end> | omni ask <on|off|status> | omni ask question --file <q.json> [--wait <seconds>] | ' +
  'omni ask wait <round> [--wait <seconds>] | omni ask answer <round> --file <a.json>';

/** Exit 3: the agent asks in its own chat. Exit 4: the wait ran out with the round open. */
const ASK_ELSEWHERE = 3;
const STILL_WAITING = 4;

/** The hook's output, or `null`. Never throws. */
async function runHook(
  kind: string,
  { cwd, exec, askSwitch, stdin, tokens, fetch, limits }: { cwd: string; exec: Exec; askSwitch: AskSwitch } & Required<Omit<AskOptions, 'tokens' | 'pace'>> & Pick<AskOptions, 'tokens'>,
): Promise<unknown> {
  try {
    const root = findRoot(cwd, exec);
    const mode = askMode(root, askSwitch);
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
    else await postHook({ root, client, input, host });
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
  { cwd, stdout, stderr, exec, askSwitch, tokens, fetch }: { cwd: string; stdout: Out; stderr: Out; exec: Exec; askSwitch: AskSwitch; tokens: TokenStore | undefined; fetch: Fetch },
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
    const page = modeStatus(root, askSwitch);
    println(stdout, page ?? 'off');
    if (page) await printWhere(defined(askMode(root, askSwitch), 'the active ask mode').baseUrl);
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

/** `--wait`'s seconds: 110 when not given, else a whole number from 10 to 540. */
function waitSeconds(verb: string, value: string | undefined): number {
  if (value === undefined) return WAIT_DEFAULT_S;
  const seconds = Number(value);
  if (!/^\d+$/.test(value) || seconds < WAIT_MIN_S || seconds > WAIT_MAX_S) {
    throw usageError(`omni ask ${verb}: --wait must be a whole number of seconds from ${String(WAIT_MIN_S)} to ${String(WAIT_MAX_S)}, got "${value}".`);
  }
  return seconds;
}

/** The JSON of the file at `path` (from `cwd`), or a usage error naming it. */
function readJsonFile(verb: string, cwd: string, path: string | undefined): unknown {
  if (path === undefined) throw usageError(`omni ask ${verb}: --file <file> is required.`);
  let text: string;
  try {
    text = readFileSync(resolve(cwd, path), 'utf8');
  } catch {
    throw usageError(`omni ask ${verb}: cannot read ${path}.`);
  }
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed;
  } catch {
    throw usageError(`omni ask ${verb}: ${path} does not read: (file): not JSON.`);
  }
}

/** What a file's reader answers: the value, or the field it gets wrong. */
type FileRead<T> = { ok: true; value: T } | { ok: false; field: string; message: string };

/** The file at `path` read through `read`, or a usage error naming the field it gets wrong. */
function readFile<T>(verb: string, cwd: string, path: string | undefined, read: (value: unknown) => FileRead<T>): T {
  const result = read(readJsonFile(verb, cwd, path));
  if (result.ok) return result.value;
  throw usageError(`omni ask ${verb}: ${String(path)} does not read: ${result.field}: ${result.message}.`);
}

/** What the verbs are handed. */
type VerbIo = { env: Env; cwd: string; stdout: Out; stderr: Out; exec: Exec; vars: Vars; tokens: TokenStore | undefined; fetch: Fetch; pace: Pace };

/** The page the verbs call, or why the agent asks in its own chat instead. */
function pageOf(root: string, { vars, tokens, fetch }: Pick<VerbIo, 'vars' | 'tokens' | 'fetch'>): { reason: string } | { host: string; client: ReturnType<typeof askClient> } {
  const mode = askMode(root, vars.ask);
  if (!mode) return { reason: 'ask mode is off: ask in your own chat (omni ask on, or OMNI_ASK=on, turns it on)' };
  const store = tokens ?? homeTokens({ omniToken: vars.omniToken?.token ?? null });
  if (!store.read(mode.host)) return { reason: `not signed in to ${mode.host}: run omni signin, or set OMNI_TOKEN` };
  return { host: mode.host, client: askClient({ baseUrl: mode.baseUrl, host: mode.host, tokens: store, fetch }) };
}

/** Prints what asking came to, and gives its exit code. */
function report(outcome: AskOutcome, { stdout, stderr }: Pick<VerbIo, 'stdout' | 'stderr'>): number {
  if (outcome.kind === 'answered') {
    println(stdout, JSON.stringify({ round: outcome.round, answers: outcome.answers, shots: outcome.shots }));
    return 0;
  }
  if (outcome.kind === 'open') {
    println(stdout, `round ${outcome.round}`);
    return STILL_WAITING;
  }
  const send = outcome.round === null ? '' : `; send the answer from your chat with omni ask answer ${outcome.round} --file <a.json>`;
  println(stderr, outcome.reason === 'unattended' ? 'unattended' : `omni ask: ${outcome.reason}${send}`);
  return ASK_ELSEWHERE;
}

/** The title a session opened here takes, read only when one is opened. */
const titleOf = (root: string, exec: Exec) => () => sessionTitle({ slug: loadConfig(root).repo.slug, branch: currentBranch(root, exec), root });

/** `answer <round> --file <a.json>`: exits 0 whatever the page does. */
async function runAnswer(round: string, file: string | undefined, io: VerbIo): Promise<number> {
  const { cwd, exec, stderr } = io;
  const root = findRoot(cwd, exec);
  const { answers } = readFile('answer', cwd, file, readAnswerFile);
  const page = pageOf(root, io);
  if ('reason' in page) return 0;
  try {
    await answerQuestion({ root, host: page.host, client: page.client, roundId: round, answers, title: titleOf(root, exec) });
  } catch (error) {
    println(stderr, `omni ask: this answer was not recorded on the page (${failureReason(error, page.host)})`);
  }
  return 0;
}

/** `question --file <q.json>` (`round` null) or `wait <round>`, each with its `--wait`. */
async function runAsk(round: string | null, flags: { file?: string; wait?: string }, io: VerbIo): Promise<number> {
  const { cwd, exec, vars, pace } = io;
  const verb = round === null ? 'question' : 'wait';
  // An unattended run (a runner job) has nobody to answer: no round opens, nothing waits.
  if (unattendedOf(io.env)) return report({ kind: 'elsewhere', reason: 'unattended', round: null }, io);
  const waitMs = waitSeconds(verb, flags.wait) * pace.secondMs;
  const root = findRoot(cwd, exec);
  const file = round === null ? readFile(verb, cwd, flags.file, readQuestionFile) : null;
  const page = pageOf(root, io);
  if ('reason' in page) return report({ kind: 'elsewhere', reason: page.reason, round: null }, io);
  const { host, client } = page;
  const wait = { waitMs, callMs: pace.callMs };
  if (file === null) return report(await resumeQuestion({ root, host, client, roundId: defined(round, 'the round'), ...wait }), io);
  const terminalId = openSessionId(vars.agentSession, mainCheckout(cwd, exec) ?? root);
  if (!isSafeId(terminalId)) {
    return report({ kind: 'elsewhere', reason: 'the session id cannot name a file here: set OMNI_SESSION_ID to letters, digits, _ and -', round: null }, io);
  }
  return report(await askQuestion({ root, host, client, terminalId, title: titleOf(root, exec), file, ...wait }), io);
}

/** `question`, `wait` or `answer`, each refusing what its usage does not name. */
function runVerb(verb: string, positional: readonly string[], flags: { file?: string; wait?: string }, io: VerbIo): Promise<number> {
  const [round] = positional;
  if (verb === 'question' && positional.length === 0) return runAsk(null, flags, io);
  if (round === undefined || positional.length !== 1) throw usageError(USAGE);
  if (verb === 'wait' && flags.file === undefined) return runAsk(round, flags, io);
  if (verb === 'answer' && flags.wait === undefined) return runAnswer(round, flags.file, io);
  throw usageError(USAGE);
}

export const ask = {
  withoutContext: true,
  async run(
    args: string[],
    { cwd, stdout, stderr, exec, env, vars, stdin = process.stdin, tokens, fetch = globalThis.fetch, limits = WAIT_LIMITS, pace = PACE }: FreeIo & AskOptions,
  ) {
    const { positional, flags } = parseArgs('ask', args, { values: ['file', 'wait'] });
    const [sub = '', kind = '', ...rest] = positional;
    if (VERBS.includes(sub)) return runVerb(sub, positional.slice(1), flags, { env, cwd, stdout, stderr, exec, vars, tokens, fetch, pace });
    if (Object.keys(flags).length > 0) throw usageError(USAGE);
    const askSwitch = vars.ask;
    if (MODES.includes(sub) && positional.length === 1) return runMode(sub, { cwd, stdout, stderr, exec, askSwitch, tokens, fetch });
    if (sub !== 'hook' || !KINDS.includes(kind) || rest.length > 0) throw usageError(USAGE);
    const output = await runHook(kind, { cwd, exec, askSwitch, stdin, tokens, fetch, limits });
    if (output) println(stdout, JSON.stringify(output));
    return 0;
  },
} satisfies FreeCommand;
