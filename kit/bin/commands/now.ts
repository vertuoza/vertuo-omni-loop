// `omni now [--json] [--stdin] [--session <id>]` (PRD 1208's spec, "omni now"): what this Claude
// session is on now, its stage, the slices being built and what it is doing, for the status line,
// the `omni-hud` band and any agent. With `--json`, one document,
// `{ "headline", "work", "doing" }`; without it, the same in plain lines.
//
// The session's folder is the one Claude Code's status line JSON names when `--stdin` is given
// (`workspace.current_dir`, else `cwd`), else the folder it runs in. Its id is `--session <id>`, else
// the JSON's `session_id`, else `OMNI_SESSION_ID`, else `CLAUDE_CODE_SESSION_ID`, else the id
// `omni dossier open` stored for the checkout (PRD 1739). It reads git and files on this computer
// only, save one thing (PRD 2251): while signed in, the runners' free slots come from the Omni page, cached 30
// seconds in the local folder (`../../lib/now/runner.ts`), the cache being all it writes. It never fetches,
// never calls GitHub, prints nothing on
// stderr and always exits 0, outside an installed repository too (the session on nothing). It runs
// before a context exists, like `statusline`; a test passes `stdin` (the text) and `now` (a clock in
// milliseconds). Any other argument is not read.
//
// `--status` (PRD 2906) prints the plain-language status block of the work (`../../lib/now/status/`)
// instead, read from this computer alone, without its Right now line (the skill adds it). `--fetch` with
// it first reads the work's pull request (state, changed files, checks) through `LoopReads`, with a
// 5-second limit, and keeps it beside the links; when GitHub does not answer it shows the last copy kept
// and says how old it is. `--json` carries the same status as its `status` key. A session on nothing
// prints two lines saying so, and exits 0.
import { text } from 'node:stream/consumers';
import type { Fetch, TokenStore } from '../../lib/ask/client.ts';
import { homeTokens } from '../../lib/ask/client-tokens.ts';
import { loadContext } from '../../lib/context.ts';
import type { HookStdin } from '../../lib/ask/hook-input.ts';
import { mainCheckout } from '../../lib/dossier/local.ts';
import { sessionIdOf } from '../../lib/dossier/session.ts';
import { omniLoopReads } from '../../lib/loop-reads/omni.ts';
import type { LoopReads } from '../../lib/loop-reads/port.ts';
import { fetchPullRequest } from '../../lib/now/build-links.ts';
import { writePullRequest } from '../../lib/now/links.ts';
import { NOTHING, nowLines, withRunners, withStatus } from '../../lib/now/now.ts';
import type { Now, NowWork } from '../../lib/now/now.ts';
import { keptPullRequest, readNowSession, statusFacts } from '../../lib/now/read.ts';
import type { KeptStatusPullRequest, NowSession } from '../../lib/now/read.ts';
import { readFollow, readRunners } from '../../lib/now/runner.ts';
import { statusBlock } from '../../lib/now/status/render.ts';
import { statusOf } from '../../lib/now/status/steps.ts';
import type { StatusChecked } from '../../lib/now/status/steps.ts';
import { parseInput } from '../../lib/statusline/input.ts';
import type { SessionInput } from '../../lib/statusline/input.ts';
import type { Exec, FreeCommand, FreeIo, Vars } from '../io.ts';

const JSON_FLAG = '--json';
const STDIN_FLAG = '--stdin';
const SESSION_FLAG = '--session';
const STATUS_FLAG = '--status';
const FETCH_FLAG = '--fetch';
const FETCH_LIMIT_MS = 5000;

/** What a session on nothing prints, with `--status`. */
const NOTHING_RUNNING = ['Nothing is running in this terminal.', '/omni:dashboard shows all your work.'];

/** The text on stdin: `stdin` itself when a test passes a string, else the stream read to its end;
 * a terminal, or no stdin, reads as no text. */
async function stdinText(stdin: HookStdin): Promise<string> {
  if (typeof stdin === 'string') return stdin;
  return stdin && !stdin.isTTY ? text(stdin) : '';
}

/** The value after `flag` in `args`, when there is one that is not itself a flag. */
function valueOf(args: readonly string[], flag: string): string | null {
  if (!args.includes(flag)) return null;
  const value = args[args.indexOf(flag) + 1];
  return value !== undefined && !value.startsWith('--') ? value : null;
}

/** What a test hands `omni now` beyond `main()`'s own. */
type NowOptions = { stdin?: HookStdin; now?: () => number; tokens?: TokenStore | undefined; home?: string | undefined; fetch?: Fetch; reads?: LoopReads; fetchMs?: number };

/** `answer` with the runner rows: the slots free, read from the page while signed in, and the followed job's last milestone. Never throws. */
async function withRunnerRows(answer: Now, { folder, io, at }: { folder: string; io: FreeIo & NowOptions; at: number }): Promise<Now> {
  try {
    const ctx = loadContext(folder, { exec: io.exec });
    const { slug } = ctx.config.repo;
    const askUrl = ctx.config.ask.url;
    const tokens = io.tokens ?? homeTokens({ home: io.home, omniToken: io.vars.omniToken?.token ?? null });
    const runners = slug && askUrl ? await readRunners({ root: ctx.root, repo: slug, askUrl, tokens, fetch: io.fetch ?? globalThis.fetch, now: at }) : undefined;
    return withRunners(answer, runners, readFollow(ctx.root));
  } catch {
    return answer;
  }
}

/** Claude Code's status line JSON, read from stdin only with `--stdin`; `null` without it or when it cannot be read. */
async function sessionInput(args: readonly string[], stdin: HookStdin): Promise<SessionInput | null> {
  if (!args.includes(STDIN_FLAG)) return null;
  return parseInput(await stdinText(stdin).catch(() => ''));
}

/**
 * The session's id: `--session <id>`, else the JSON's `session_id`, else the agent session the
 * variables name, else the id stored in the main checkout of `folder`, else `null`. Never throws.
 */
function sessionOf(args: readonly string[], input: SessionInput | null, { vars, folder, exec }: { vars: Vars; folder: string; exec: Exec }): string | null {
  const given = valueOf(args, SESSION_FLAG) ?? input?.sessionId ?? vars.agentSession?.id ?? null;
  if (given !== null) return given;
  try {
    return sessionIdOf(null, mainCheckout(folder, exec));
  } catch {
    return null;
  }
}

/** The answer, as one JSON document with `--json`, else as plain lines. */
const rendered = (args: readonly string[], answer: Now): string =>
  args.includes(JSON_FLAG) ? `${JSON.stringify(answer, null, 2)}\n` : `${nowLines(answer).join('\n')}\n`;

/** `promise`, or a rejection once `ms` milliseconds have passed. */
async function within<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error('GitHub did not answer'));
    }, ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** The pull request of the session's work as GitHub answers it now, kept beside the links; `null` when it has none. Throws when it cannot be read. */
async function readPullRequestNow(session: NowSession, work: NowWork, io: FreeIo & NowOptions, at: string): Promise<KeptStatusPullRequest | null> {
  const tokens = io.tokens ?? homeTokens({ home: io.home, omniToken: io.vars.omniToken?.token ?? null });
  const reads = io.reads ?? omniLoopReads({ askUrl: session.ctx.config.ask.url, tokens, home: io.home, fetch: io.fetch ?? globalThis.fetch });
  const found = await within(fetchPullRequest(session.ctx, work.kind, work.number, { reads, exec: session.reading.exec }), io.fetchMs ?? FETCH_LIMIT_MS);
  if (!found) return null;
  const read = { at, url: found.url, state: found.state, files: found.files, checks: found.checks };
  if (session.main) writePullRequest(session.main, work.kind, work.number, { ...read, number: found.number });
  return read;
}

/** The work's pull request for `--status --fetch`: what was read, or, when GitHub does not answer in time, the last copy kept. Never throws. */
async function fetchedPullRequest(session: NowSession, work: NowWork, io: FreeIo & NowOptions, at: number): Promise<{ pullRequest: KeptStatusPullRequest | null; checked: StatusChecked }> {
  try {
    const checked = { at: new Date(at).toISOString(), fetch: 'answered' } as const;
    return { pullRequest: await readPullRequestNow(session, work, io, checked.at), checked };
  } catch {
    const kept = keptPullRequest(session);
    return { pullRequest: kept, checked: { at: kept?.at ?? null, fetch: 'no-answer' } };
  }
}

/** The status block of the session's work, or the two lines of a session on nothing. */
async function statusText(session: NowSession | null, args: readonly string[], io: FreeIo & NowOptions, at: number): Promise<string> {
  const work = session?.answer.work;
  if (!session || !work) return `${NOTHING_RUNNING.join('\n')}\n`;
  const kept = keptPullRequest(session);
  const read = args.includes(FETCH_FLAG) ? await fetchedPullRequest(session, work, io, at) : { pullRequest: kept, checked: { at: kept?.at ?? null, fetch: 'not-asked' } as const };
  const facts = statusFacts(session, read.pullRequest, read.checked);
  return facts ? `${statusBlock(facts, at).join('\n')}\n` : `${NOTHING_RUNNING.join('\n')}\n`;
}

/** `answer` with the status of its work, read from this computer alone, for `--json`. */
function withStatusOf(session: NowSession, answer: Now): Now {
  const kept = keptPullRequest(session);
  const facts = statusFacts(session, kept, { at: kept?.at ?? null, fetch: 'not-asked' });
  return withStatus(answer, facts ? statusOf(facts) : null);
}

/** The answer `omni now` prints: the session's, with its status and the runner rows under `--json`. */
async function answerOf(args: readonly string[], session: NowSession | null, io: FreeIo & NowOptions, folder: string, at: number): Promise<Now> {
  const read = session?.answer ?? NOTHING;
  if (!args.includes(JSON_FLAG)) return read;
  return withRunnerRows(session ? withStatusOf(session, read) : read, { folder, io, at });
}

export const now = {
  withoutContext: true,
  async run(args: string[], io: FreeIo & NowOptions) {
    const { cwd, stdout, exec, vars, stdin = process.stdin, now: clock = Date.now } = io;
    const input = await sessionInput(args, stdin);
    const session = readNowSession({ cwd, folder: input?.currentDir ?? null, sessionId: sessionOf(args, input, { vars, folder: input?.currentDir ?? cwd, exec }), exec, now: clock() });
    const text = args.includes(STATUS_FLAG) ? await statusText(session, args, io, clock()) : rendered(args, await answerOf(args, session, io, input?.currentDir ?? cwd, clock()));
    try {
      stdout.write(text);
    } catch {
      // A closed pipe: no one is left to read the answer.
    }
    return 0;
  },
} satisfies FreeCommand;
