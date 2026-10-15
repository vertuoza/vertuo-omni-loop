// `omni statusline` — the command Claude Code runs as its status line (PRD 324's spec): it reads the
// session's JSON on stdin and prints line 1 (the model, the context bar, the 5-hour usage, `ask on`)
// and, where the loop is installed, line 2, drawn from `omni now`'s reading (PRD 1208, s5) for every
// kind: a PRD (`PRD 315 help-and-status · building · wave 2/4 · now s3 tabs, s4 board`, its wave and
// open items from the PRD the status line's own facts name), a fix (`bug #1180 login-redirect · fix PR
// open`), a loop or roadmap above the work (`roadmap 7 · 3/7 merged · now PRD 315 · s3`), or
// `no PRD · /omni:brainstorm to start` (`../../lib/statusline/render.ts`). Both readings run git
// through one remembering `exec`, so that the second costs no process the first already ran. Besides
// the board's refresh (told `--kind prd`), it starts the refresh of the links of the work `omni now`
// names when they are missing or a minute old, as the board's is started, unless one was just started
// for it, and never for a shipped PRD or a merged fix.
//
// Line 2 starts with the sync badge (PRD 1990) when `omni sync` has kept a record: read from its cache
// alone, and when that is absent or 15 minutes old it starts one `omni sync --background`, detached,
// never a second while a run holds the lock beside the cache (`../../lib/statusline/sync-badge.ts`).
//
// It never breaks Claude Code: it always exits 0 and prints at least one line, never writes to
// stderr, never fetches, never reads the loop and writes no file; what it cannot read leaves its part out.
// JSON that cannot be read prints `omni`; a reader that fails prints line 1 from the JSON alone. Under
// `OMNI_TOKEN` (PRD 1628), line 1 ends on `token ··<last four>`, read from the variable alone. The
// board comes from a file in the main checkout (`board-cache.mjs`): when it is missing or a minute
// old, the status line starts its refresh, detached, and never waits for it. It runs before a
// context exists, like `init` and `ask`, so that no checkout, config or folder can turn it into an
// error; `main()` hands it `{ cwd, stdout, stderr, exec, env, vars, script }` (`script`, the file that
// runs this `omni`, is what the refresh runs), and a test also passes `stdin` (the text), `now` (a
// clock in milliseconds), `readFacts` (the reader) and `spawn` (what starts the refresh). Any argument but `--refresh` is not read.
//
// `omni statusline --refresh <n>` is that refresh, the background half: it takes PRD `<n>`'s lock
// (another refresh holds it: exit 0, nothing written), builds the board exactly as `omni board <n>`
// does, through the same `LoopReads` (PRD 1665: the Omni page, with this computer's sign-in), in its own
// folder (the session's), writes it to the main checkout's board file, and removes the lock. Any
// failure (no sign-in, the page unreachable or refusing, no plan) is written as the error entry, the
// read's own line: the status line then draws what it draws without a board, never an error, and tries
// again a minute later. It prints nothing and always exits 0: no one reads its output. Each process it
// runs is cut off after a minute, and each read after 15 seconds, so that nothing hung outlives the lock
// by much.
//
// `omni statusline --refresh <n> --kind prd|bug|visual` (PRD 1208, s4) also keeps the links of what the
// session is on (`../../lib/now/links.ts`), under the same lock rules and timings: for `prd`, the board
// as above, then PRD n's links (its page, its feature PR, its phase-0 PR while open); for `bug` or
// `visual`, issue n's fix links alone (its page, its pull request while open), and no board. The pages
// are asked of the Omni page with this computer's sign-in (none without one, or with the dossier off),
// the pull requests of the same `LoopReads`; a link that cannot be had is left out. Without `--kind`,
// the board alone, as PRD 324 runs it. A test also hands it `tokens`, `home`, `fetch` and `callMs`, or
// `reads`, a `LoopReads` of its own.
import { spawn as spawnProcess } from 'node:child_process';
import { loadContext } from '../../lib/context.ts';
import { mainCheckout } from '../../lib/dossier/local.ts';
import { AskCallError, type askClient } from '../../lib/ask/client.ts';
import type { Fetch, TokenStore } from '../../lib/ask/client.ts';
import { omniTokenTail } from '../../lib/ask/client-tokens.ts';
import { signedInClient } from '../../lib/ask/credentials.ts';
import { field } from '../../lib/ask/schema.ts';
import { dossierSwitch } from '../../lib/config.ts';
import type { Context } from '../../lib/context.ts';
import { buildLinks } from '../../lib/now/build-links.ts';
import type { PageOf } from '../../lib/now/build-links.ts';
import { refreshLinks } from '../../lib/now/links.ts';
import type { FixKind, NowWork } from '../../lib/now/now.ts';
import { readNow } from '../../lib/now/read.ts';
import { lockHeld, refreshBoard } from '../../lib/statusline/board-cache.ts';
import type { Spawn } from '../../lib/statusline/board-cache.ts';
import { readFacts as readCheckoutFacts, startLinksRefresh } from '../../lib/statusline/facts.ts';
import { SHIPPED } from '../../lib/statusline/stage.ts';
import type { ExecText } from '../../lib/context.ts';
import { parseInput } from '../../lib/statusline/input.ts';
import { renderLines, UNREADABLE_LINE } from '../../lib/statusline/render.ts';
import { readSyncBadge } from '../../lib/statusline/sync-badge.ts';
import type { ExecFileSyncOptions, ExecFileSyncOptionsWithStringEncoding } from 'node:child_process';
import type { HookStdin } from '../../lib/ask/hook-input.ts';
import type { IssueNumber, PrdNumber } from '../../lib/ids.ts';
import { issueArg, prdArg } from '../args.ts';
import type { Env, Exec, FreeCommand, FreeIo, Vars } from '../io.ts';
import { buildBoard } from './board.ts';
import { omniLoopReads } from '../../lib/loop-reads/omni.ts';
import { boardReads } from '../../lib/loop-reads/port.ts';
import type { LoopReads } from '../../lib/loop-reads/port.ts';

const REFRESH_FLAG = '--refresh';
const KIND_FLAG = '--kind';
const LINK_KINDS = ['prd', 'bug', 'visual'] as const;
/** How long one call of the refresh may run. */
const CALL_TIMEOUT_MS = 60 * 1000;

/** The text on stdin: `stdin` itself when a test passes a string, else the stream read to its end; a terminal is never read. */
async function readText(stdin: HookStdin): Promise<string> {
  if (typeof stdin === 'string') return stdin;
  if (!stdin || stdin.isTTY) return '';
  stdin.setEncoding?.('utf8');
  let text = '';
  for await (const chunk of stdin) text += String(chunk);
  return text;
}

/** `exec` for one render: a call made before answers as it did, so that `omni now`'s reading, which
 * asks git what the status line's facts asked, costs no second process. A call that threw throws again. */
function rememberedExec(exec: ExecText): ExecText {
  const answers = new Map<string, { out: string } | { error: unknown }>();
  return (file, args, options) => {
    const key = JSON.stringify([file, args, options.cwd ?? null]);
    let answer = answers.get(key);
    if (!answer) {
      try {
        answer = { out: exec(file, args, options) };
      } catch (error) {
        answer = { error };
      }
      answers.set(key, answer);
    }
    if ('error' in answer) throw answer.error;
    return answer.out;
  };
}

/** What a test hands `omni statusline` beyond `main()`'s own. */
type StatuslineOptions = {
  stdin?: HookStdin;
  now?: () => number;
  readFacts?: typeof readCheckoutFacts;
  spawn?: typeof spawnProcess;
};

/** What a test hands the refresh beyond `main()`'s own: the sign-in and the fetch the page is asked with,
 * or the loop's reads themselves. */
type RefreshOptions = {
  reads?: LoopReads | undefined;
  tokens?: TokenStore | undefined;
  home?: string | undefined;
  fetch?: Fetch;
  callMs?: number | undefined;
};

/** What line 2 reads beyond the checkout's facts: `omni now`'s answer (its links' refresh started when due,
 * unless the board's refresh just started it), the board of the PRD the facts name, and the sync badge's record. */
function secondLineFacts({ input, facts, cwd, exec, now, spawn, seen, script, env, started }: {
  input: NonNullable<ReturnType<typeof parseInput>>;
  facts: ReturnType<typeof readCheckoutFacts>;
  cwd: string;
  exec: ExecText;
  now: number;
  spawn: Spawn;
  seen: Spawn;
  script: string | undefined;
  env: Env;
  started: ReadonlySet<string>;
}) {
  const folder = input.currentDir ?? cwd;
  const answer = readNow({ cwd, folder: input.currentDir, sessionId: input.sessionId, exec, now });
  if (answer.work && !started.has(String(answer.work.number))) refreshLinksOf(answer.work, { folder, now, spawn: seen, script, env }, exec);
  const board = facts.prd ? { number: facts.prd.number, slices: facts.prd.slices, openItems: facts.prd.openItems } : null;
  return { now: answer, board, sync: readSyncBadge({ folder, exec, now, spawn, script, env }) };
}

async function statusLines({
  cwd,
  exec,
  env,
  terminal,
  script,
  stdin,
  now,
  readFacts,
  spawn,
}: { cwd: string; exec: Exec; env: Env; terminal: Vars['terminal']; script: string | undefined } & Required<StatuslineOptions>): Promise<string[]> {
  try {
    const input = parseInput(await readText(stdin).catch(() => ''));
    const instant = now();
    if (!input) return renderLines({ input, facts: null, terminal, now: instant });
    const remembered = rememberedExec(exec);
    const { seen, started } = trackedSpawn(spawn);
    const facts = attempt(() => readFacts(input, { cwd, exec: remembered, now: instant, spawn: seen, script, env }));
    if (!facts?.installed) return renderLines({ input, facts, terminal, now: instant });
    const second = secondLineFacts({ input, facts, cwd, exec: remembered, now: instant, spawn, seen, script, env, started });
    return renderLines({ input, facts: { ...facts, ...second }, terminal, now: instant });
  } catch {
    return [UNREADABLE_LINE];
  }
}

/** `fn()`, or `null` when it throws. */
function attempt<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}

/** `spawn`, noting the number of each refresh it starts in `started`. */
function trackedSpawn(spawn: Spawn): { seen: Spawn; started: Set<string> } {
  const started = new Set<string>();
  const seen: Spawn = (command, args, options) => {
    started.add(String(args[args.indexOf(REFRESH_FLAG) + 1]));
    return spawn(command, args, options);
  };
  return { seen, started };
}

/** Starts the refresh of `work`'s links when they are due, never for a shipped PRD or a merged fix. */
function refreshLinksOf(work: NowWork, refresh: Omit<Parameters<typeof startLinksRefresh>[0], 'kind' | 'n'>, exec: ExecText): void {
  if (work.stage === SHIPPED || work.stage === 'merged') return;
  startLinksRefresh({ ...refresh, kind: work.kind, n: work.number }, exec);
}

/** `value` as a PRD number, or `null`. */
function prdNumber(value: string | undefined): PrdNumber | null {
  try {
    return prdArg('statusline', '<n>', value);
  } catch {
    return null;
  }
}

/** `exec` with every call given the refresh's timeout: the same exec, text in and text out. */
function withTimeout(exec: Exec): Exec {
  function timed(file: string, args: readonly string[], options: ExecFileSyncOptionsWithStringEncoding): string;
  function timed(file: string, args: readonly string[], options: ExecFileSyncOptions): string | Buffer;
  function timed(file: string, args: readonly string[], options: ExecFileSyncOptions): string | Buffer {
    return exec(file, args, { ...options, timeout: CALL_TIMEOUT_MS });
  }
  return timed;
}

/** What a refresh is handed. */
type RefreshIo = { cwd: string; exec: Exec; env: Env; now: () => number } & RefreshOptions;

/** The kind `--kind` names in `args`: `null` without one, `undefined` for one it does not know. */
function kindOf(args: readonly string[]): (typeof LINK_KINDS)[number] | null | undefined {
  if (!args.includes(KIND_FLAG)) return null;
  const value = args[args.indexOf(KIND_FLAG) + 1];
  return LINK_KINDS.find((kind) => kind === value);
}

/** The Omni page's link of a PRD or a fix, asked with this computer's sign-in: `null` without one,
 * with the dossier off, or when the page has none. */
function pageOf(ctx: Context, { tokens, home, fetch = globalThis.fetch, callMs }: RefreshIo): PageOf {
  const toggle = dossierSwitch(ctx.config);
  const repo = ctx.config.repo.slug;
  const client: ReturnType<typeof askClient> | null = toggle.on && repo ? signedInClient({ askUrl: toggle.askUrl, tokens, home, fetch, callMs }) : null;
  return async (kind, n) => {
    if (!client || !repo) return null;
    try {
      const url = field(await client.findDossier({ repo, prd: n, kind }), 'url');
      return typeof url === 'string' && url !== '' ? url : null;
    } catch (error) {
      if (error instanceof AskCallError) return null;
      throw error;
    }
  };
}

/** The loop's reads the refresh goes through: the test's own, else the Omni page's with this computer's sign-in. */
function loopReadsOf(ctx: Context, { reads, tokens, home, fetch, callMs }: RefreshIo): LoopReads {
  return reads ?? omniLoopReads({ askUrl: ctx.config.ask.url, tokens, home, fetch, callMs });
}

/** The refresh of the `kind` work numbered `n`'s links in the main checkout at `root`. */
async function refreshWorkLinks(root: string, kind: 'prd' | FixKind, n: PrdNumber | IssueNumber, io: RefreshIo, timed: Exec, instant: number): Promise<void> {
  const ctx = loadContext(io.cwd, { exec: timed });
  const reads = loopReadsOf(ctx, io);
  await refreshLinks({ root, kind, n, now: instant, build: () => buildLinks(ctx, kind, n, { reads, page: pageOf(ctx, io), exec: timed }) });
}

/** The refresh of PRD `prd`'s board in the main checkout at `root`. */
async function refreshPrdBoard(root: string, prd: PrdNumber, io: RefreshIo, timed: Exec, instant: number): Promise<void> {
  // The board is read before the lock is taken (`refreshBoard` builds synchronously), so a refresh while
  // another one holds it reads nothing; what the read threw, a `LoopReadError`'s line included, is
  // written as the error entry.
  if (lockHeld(root, prd, instant)) return;
  const read = async () => {
    const ctx = loadContext(io.cwd, { exec: timed });
    return (await buildBoard(prd, { ctx, reads: boardReads(loopReadsOf(ctx, io)), now: instant, exec: timed })).result.slices;
  };
  const built = await read().then((slices) => ({ slices }), (error: unknown) => ({ error }));
  refreshBoard({
    root,
    prd,
    now: instant,
    build: () => {
      if ('error' in built) throw built.error;
      return built.slices;
    },
  });
}

/** The refresh of PRD `value`'s board, and with `--kind` of the links of the work it names: never throws, never prints. */
async function refresh(args: readonly string[], io: RefreshIo): Promise<void> {
  const [, value] = args;
  const kind = kindOf(args);
  if (kind === undefined) return;
  try {
    const root = mainCheckout(io.cwd, io.exec);
    if (!root) return;
    const timed = withTimeout(io.exec);
    const instant = io.now();
    if (kind === null || kind === 'prd') {
      const prd = prdNumber(value);
      if (prd === null) return;
      await refreshPrdBoard(root, prd, io, timed, instant);
      if (kind === 'prd') await refreshWorkLinks(root, kind, prd, io, timed, instant);
      return;
    }
    const issue = issueNumber(value);
    if (issue !== null) await refreshWorkLinks(root, kind, issue, io, timed, instant);
  } catch {
    // Nowhere to write, or the disk refused: the next render starts another.
  }
}

/** `value` as an issue number, or `null`. */
function issueNumber(value: string | undefined): IssueNumber | null {
  try {
    return issueArg('statusline', '<n>', value);
  } catch {
    return null;
  }
}

/** `lines` with line 1 ending on the kit token's last four when `OMNI_TOKEN` signs the kit in. */
function withToken(lines: string[], token: string | undefined): string[] {
  if (!token) return lines;
  const [first = '', ...rest] = lines;
  return [`${first} · token ··${omniTokenTail(token)}`, ...rest];
}

export const statusline = {
  withoutContext: true,
  async run(
    args: string[],
    { cwd, stdout, exec, env, vars, script, stdin = process.stdin, now = Date.now, readFacts = readCheckoutFacts, spawn = spawnProcess, reads, tokens, home, fetch, callMs }: FreeIo & StatuslineOptions & RefreshOptions,
  ) {
    if (args[0] === REFRESH_FLAG) {
      await refresh(args, { cwd, exec, env, now, reads, tokens, home, ...(fetch ? { fetch } : {}), callMs });
      return 0;
    }
    const lines = withToken(await statusLines({ cwd, exec, env, terminal: vars.terminal, script, stdin, now, readFacts, spawn }), vars.omniToken?.token);
    try {
      stdout.write(`${lines.join('\n')}\n`);
    } catch {
      // A closed pipe: Claude Code stopped listening, and there is no one left to tell.
    }
    return 0;
  },
} satisfies FreeCommand;
