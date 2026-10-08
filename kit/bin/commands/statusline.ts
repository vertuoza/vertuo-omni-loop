// `omni statusline` — the command Claude Code runs as its status line (PRD 324's spec): it reads the
// session's JSON on stdin and prints line 1 (the model, the context bar, the 5-hour usage, `ask on`)
// and, where the loop is installed, line 2: the PRD the session's branch names, else the one the
// session last worked on (the record its `session_id` names, written by the commands that name a
// PRD), with its slice, its stage, the wave and the slices of its board in the outbox, and its open
// items (`PRD 7 bravo · s2 · outbox · wave 2 of 4 · 3/5 slices merged, 1 stuck · 2 open items`), or
// `no PRD · /omni:brainstorm to start`.
//
// It never breaks Claude Code: it always exits 0 and prints at least one line, never writes to
// stderr, never fetches, never runs `gh` and writes no file; what it cannot read leaves its part out.
// JSON that cannot be read prints `omni`; a reader that fails prints line 1 from the JSON alone. The
// board comes from a file in the main checkout (`board-cache.mjs`): when it is missing or a minute
// old, the status line starts its refresh, detached, and never waits for it. It runs before a
// context exists, like `init` and `ask`, so that no checkout, config or folder can turn it into an
// error; `main()` hands it `{ cwd, stdout, stderr, exec, env, vars, script }` (`script`, the file that
// runs this `omni`, is what the refresh runs), and a test also passes `stdin` (the text), `now` (a
// clock in milliseconds), `readFacts` (the reader) and `spawn` (what starts the refresh). Any argument but `--refresh` is not read.
//
// `omni statusline --refresh <n>` is that refresh, the background half: it takes PRD `<n>`'s lock
// (another refresh holds it: exit 0, nothing written), builds the board exactly as `omni board <n>`
// does, in its own folder (the session's), writes it to the main checkout's board file, and removes
// the lock. Any failure (no `gh`, offline, no plan) is written as the error entry. It prints nothing
// and always exits 0: no one reads its output. Each call it runs is cut off after a minute, so that a
// hung `gh` never outlives the lock by much.
//
// `omni statusline --refresh <n> --kind prd|bug|visual` (PRD 1208, s4) also keeps the links of what the
// session is on (`../../lib/now/links.ts`), under the same lock rules and timings: for `prd`, the board
// as above, then PRD n's links (its page, its feature PR, its phase-0 PR while open); for `bug` or
// `visual`, issue n's fix links alone (its page, its pull request while open), and no board. The pages
// are asked of the Omni page with this computer's sign-in (none without one, or with the dossier off),
// the pull requests of `gh`; a link that cannot be had is left out. Without `--kind`, the board alone,
// as PRD 324 runs it. A test also hands it `tokens`, `home`, `fetch` and `callMs`.
import { spawn as spawnProcess } from 'node:child_process';
import { loadContext } from '../../lib/context.ts';
import { mainCheckout } from '../../lib/dossier/local.ts';
import { AskCallError, type askClient } from '../../lib/ask/client.ts';
import type { Fetch, TokenStore } from '../../lib/ask/client.ts';
import { signedInClient } from '../../lib/ask/credentials.ts';
import { field } from '../../lib/ask/schema.ts';
import { dossierSwitch } from '../../lib/config.ts';
import type { Context } from '../../lib/context.ts';
import { buildLinks } from '../../lib/now/build-links.ts';
import type { PageOf } from '../../lib/now/build-links.ts';
import { refreshLinks } from '../../lib/now/links.ts';
import type { FixKind } from '../../lib/now/now.ts';
import { refreshBoard } from '../../lib/statusline/board-cache.ts';
import { readFacts as readCheckoutFacts } from '../../lib/statusline/facts.ts';
import { parseInput } from '../../lib/statusline/input.ts';
import { renderLines, UNREADABLE_LINE } from '../../lib/statusline/render.ts';
import type { ExecFileSyncOptions, ExecFileSyncOptionsWithStringEncoding } from 'node:child_process';
import type { HookStdin } from '../../lib/ask/hook-input.ts';
import type { IssueNumber, PrdNumber } from '../../lib/ids.ts';
import { issueArg, prdArg } from '../args.ts';
import { githubEnv } from '../github.ts';
import type { Env, Exec, FreeCommand, FreeIo, Vars } from '../io.ts';
import { buildBoard } from './board.ts';

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

/** The lines to print, never throwing: line 1 from the JSON alone when the reader fails, `omni` when anything else does. */
/** What a test hands `omni statusline` beyond `main()`'s own. */
type StatuslineOptions = {
  stdin?: HookStdin;
  now?: () => number;
  readFacts?: typeof readCheckoutFacts;
  spawn?: typeof spawnProcess;
};

/** What a test hands the refresh beyond `main()`'s own: the sign-in and the fetch the page is asked with. */
type RefreshOptions = {
  tokens?: TokenStore | undefined;
  home?: string | undefined;
  fetch?: Fetch;
  callMs?: number | undefined;
};

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
    let facts = null;
    if (input) {
      try {
        facts = readFacts(input, { cwd, exec, now: instant, spawn, script, env });
      } catch {
        facts = null;
      }
    }
    return renderLines({ input, facts, terminal, now: instant });
  } catch {
    return [UNREADABLE_LINE];
  }
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

/** The refresh of the `kind` work numbered `n`'s links in the main checkout at `root`. */
async function refreshWorkLinks(root: string, kind: 'prd' | FixKind, n: PrdNumber | IssueNumber, io: RefreshIo, timed: Exec, instant: number): Promise<void> {
  const ctx = loadContext(io.cwd, { exec: timed });
  let ghEnv: Env | undefined;
  try {
    ghEnv = githubEnv(ctx, { exec: timed, env: io.env });
  } catch {
    ghEnv = undefined;
  }
  const gh = (args: readonly string[]) => timed('gh', args, { cwd: ctx.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...(ghEnv ? { env: ghEnv } : {}) });
  await refreshLinks({ root, kind, n, now: instant, build: () => buildLinks(ctx, kind, n, { gh, page: pageOf(ctx, io), exec: timed }) });
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
      const build = () => buildBoard(prd, { ctx: loadContext(io.cwd, { exec: timed }), exec: timed, env: io.env, now: instant }).result.slices;
      refreshBoard({ root, prd, now: instant, build });
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

export const statusline = {
  withoutContext: true,
  async run(
    args: string[],
    { cwd, stdout, exec, env, vars, script, stdin = process.stdin, now = Date.now, readFacts = readCheckoutFacts, spawn = spawnProcess, tokens, home, fetch, callMs }: FreeIo & StatuslineOptions & RefreshOptions,
  ) {
    if (args[0] === REFRESH_FLAG) {
      await refresh(args, { cwd, exec, env, now, tokens, home, ...(fetch ? { fetch } : {}), callMs });
      return 0;
    }
    const lines = await statusLines({ cwd, exec, env, terminal: vars.terminal, script, stdin, now, readFacts, spawn });
    try {
      stdout.write(`${lines.join('\n')}\n`);
    } catch {
      // A closed pipe: Claude Code stopped listening, and there is no one left to tell.
    }
    return 0;
  },
} satisfies FreeCommand;
