// `omni session start | end` (PRD 1831) — the session's two ends, for any coding agent, with no hook.
//
// - `start` resolves the session id in PRD 1739's order: `OMNI_SESSION_ID`, then
//   `CLAUDE_CODE_SESSION_ID`, then the id stored in the main checkout's `.omni-loop/local/session.json`;
//   when none gives one, it generates one and stores it there (`../../lib/dossier/session.ts`, which
//   `omni dossier open` shares). It then prints the constituents (`omni constituents`, its 3-second
//   budget and its cache unchanged), the briefing (`omni kb show briefing`) and a last line
//   `session: <id>`.
//   Between the constituents and the briefing it prints the sync block (PRD 1990, `omni sync`): from the
//   cache when under 15 minutes old, else after one `omni sync --quiet` run within `syncBudgetMs`
//   (15 s), else the cache with its age (`checked 2 h ago`), or `sync: not checked yet` with none.
// - `end` closes this session's ask session (the terminal file keyed by the resolved id, as
//   `omni ask hook end` closes it), then sends the heartbeat's end (`omni heartbeat --end`). It
//   generates no id: with none resolved there is nothing to close.
//
// Both print what they can and exit 0, whatever fails; exit 2 is a usage error only. Each network call
// keeps its own budget: the constituents 3 s, the close 2 s, the heartbeat 2 s.
//
// It runs before a context exists, like `constituents`; a test hands it `tokens` (the token store),
// `home`, `fetch`, `now` and `budgetMs`.
import { askClient } from '../../lib/ask/client.ts';
import type { Fetch, TokenStore } from '../../lib/ask/client.ts';
import { homeTokens } from '../../lib/ask/client-tokens.ts';
import { readTerminal } from '../../lib/ask/local-state.ts';
import { closeTerminal } from '../../lib/ask/round.ts';
import { loadConfig } from '../../lib/config.ts';
import { loadContext } from '../../lib/context.ts';
import { mainCheckout } from '../../lib/dossier/local.ts';
import { openSessionId, sessionIdOf } from '../../lib/dossier/session.ts';
import { findRoot } from '../../lib/init/repo.ts';
import { messageOf } from '../../lib/narrow.ts';
import { readSyncCache } from '../../lib/sync/cache.ts';
import { syncLines } from '../../lib/sync/render.ts';
import type { SyncRecord } from '../../lib/sync/schema.ts';
import { durationText } from '../../lib/sync/status.ts';
import { println, usageError } from '../args.ts';
import type { Exec, FreeCommand, FreeIo } from '../io.ts';
import { CONSTITUENTS_BUDGET_MS, constituents } from './constituents.ts';
import { heartbeat } from './heartbeat.ts';
import { kb } from './kb.ts';

const USAGE = 'usage: omni session start | omni session end';

/** The most closing the ask session may take. */
const CLOSE_LIMIT_MS = 2000;

/** The most the sync block may wait for a refresh. */
const SYNC_BUDGET_MS = 15_000;
/** A cache younger than this is printed as it is. */
const SYNC_FRESH_MS = 15 * 60_000;

/** What a test hands `omni session` beyond `main()`'s own. */
type SessionOptions = {
  tokens?: TokenStore | undefined;
  home?: string | undefined;
  fetch?: Fetch;
  now?: () => number;
  budgetMs?: number;
  syncBudgetMs?: number;
};

/** `fetch` held to one deadline shared by every request of the call, the renewal included. */
function withDeadline(fetch: Fetch, ms: number): Fetch {
  const deadline = AbortSignal.timeout(ms);
  return (url, init) => fetch(url, { ...init, signal: init.signal ? AbortSignal.any([init.signal, deadline]) : deadline });
}

/** The briefing, as `omni kb show briefing` prints it, or one line saying why there is none. Never throws. */
async function printBriefing(io: FreeIo): Promise<void> {
  try {
    const ctx = loadContext(io.cwd, { exec: io.exec });
    await kb.run(['show', 'briefing'], { ctx, stdout: io.stdout, stderr: io.stderr, exec: io.exec, env: io.env, vars: io.vars });
  } catch (error) {
    println(io.stdout, `no briefing: ${messageOf(error).split('\n')[0] ?? ''} — agents carry on`);
  }
}

/** The cache's age at `now`, in milliseconds, never below 0. */
function ageOf(checkedAt: string, now: number): number {
  return Math.max(0, now - Date.parse(checkedAt));
}

/** The cache's record at `root` when it is under 15 minutes old at `now`, else `null`. */
function freshRecord(root: string, now: number): SyncRecord | null {
  const record = readSyncCache(root);
  return record && ageOf(record.checkedAt, now) < SYNC_FRESH_MS ? record : null;
}

/** Runs `omni sync --quiet` once, for at most `budgetMs`. A run that fails or runs out costs nothing: the cache stands. */
function refresh(io: FreeIo, budgetMs: number): void {
  if (!io.script) return;
  try {
    io.exec(process.execPath, [io.script, 'sync', '--quiet'], { cwd: io.cwd, encoding: 'utf8', timeout: budgetMs, stdio: 'ignore', env: io.env });
  } catch {
    // The budget ran out, or the run failed.
  }
}

/** The lines of the sync block for the cache at `root`: fresh, else after one refresh, else as it stands with its age. */
function syncBlock(io: FreeIo, root: string, { now, budgetMs }: { now: () => number; budgetMs: number }): string[] {
  const fresh = freshRecord(root, now());
  if (fresh) return syncLines(fresh);
  refresh(io, budgetMs);
  const renewed = freshRecord(root, now());
  if (renewed) return syncLines(renewed);
  const last = readSyncCache(root);
  if (!last) return ['sync: not checked yet'];
  return [`sync: checked ${durationText(ageOf(last.checkedAt, now()))} ago`, ...syncLines(last)];
}

/**
 * The sync block (PRD 1990): the cache while under 15 minutes old, else one `omni sync --quiet` run
 * within `budgetMs`, else the cache with its age, or `sync: not checked yet`. Prints nothing outside
 * a checkout where the loop is installed. Never throws.
 */
function printSync(io: FreeIo, budget: { now: () => number; budgetMs: number }): void {
  try {
    const root = mainCheckout(io.cwd, io.exec);
    if (!root) return;
    loadConfig(root);
    for (const line of syncBlock(io, root, budget)) println(io.stdout, line);
  } catch {
    // Not installed here, or the config does not read: the briefing says what it can.
  }
}

async function start(io: FreeIo, { tokens, home, fetch, now, budgetMs, syncBudgetMs }: Required<Omit<SessionOptions, 'tokens' | 'home'>> & Pick<SessionOptions, 'tokens' | 'home'>): Promise<number> {
  const id = openSessionId(io.vars.agentSession, mainCheckout(io.cwd, io.exec));
  await constituents.run([], { ...io, tokens, home, fetch, now, budgetMs });
  printSync(io, { now, budgetMs: syncBudgetMs });
  await printBriefing(io);
  println(io.stdout, `session: ${id}`);
  return 0;
}

/** Closes the ask session the terminal file of `sessionId` names, within its budget. Never throws. */
async function closeAsk({ cwd, exec, sessionId, tokens, fetch }: { cwd: string; exec: Exec; sessionId: string; tokens: TokenStore; fetch: Fetch }): Promise<void> {
  try {
    const root = findRoot(cwd, exec);
    if (!readTerminal(root, sessionId)) return;
    const askUrl = loadConfig(root).ask.url;
    if (!askUrl) return;
    const host = new URL(askUrl).host;
    const client = askClient({ baseUrl: askUrl, host, tokens, fetch: withDeadline(fetch, CLOSE_LIMIT_MS), callMs: CLOSE_LIMIT_MS });
    await closeTerminal({ root, host, client, terminalId: sessionId });
  } catch {
    // The page closes a session on its own after 12 hours without a call.
  }
}

async function end(io: FreeIo, { tokens, home, fetch, now }: Pick<SessionOptions, 'tokens' | 'home'> & { fetch: Fetch; now: () => number }): Promise<number> {
  const sessionId = sessionIdOf(io.vars.agentSession, mainCheckout(io.cwd, io.exec));
  if (sessionId === null) return 0;
  const store = tokens ?? homeTokens(home === undefined ? undefined : { home });
  await closeAsk({ cwd: io.cwd, exec: io.exec, sessionId, tokens: store, fetch });
  // The heartbeat reads no stdin here: its session id is the resolver's, as this command's.
  await heartbeat.run(['--end'], { ...io, stdin: '', tokens: store, fetch, now });
  return 0;
}

export const session = {
  withoutContext: true,
  async run(
    args: string[],
    { tokens, home, fetch = globalThis.fetch, now = Date.now, budgetMs = CONSTITUENTS_BUDGET_MS, syncBudgetMs = SYNC_BUDGET_MS, ...io }: FreeIo & SessionOptions,
  ) {
    const [verb, ...rest] = args;
    if (rest.length > 0) throw usageError(USAGE);
    if (verb === 'start') return start(io, { tokens, home, fetch, now, budgetMs, syncBudgetMs });
    if (verb === 'end') return end(io, { tokens, home, fetch, now });
    throw usageError(USAGE);
  },
} satisfies FreeCommand;
