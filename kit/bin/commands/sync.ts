// `omni sync [--json | --quiet | --background | --fix] [--strict]` (PRD 1990) — whether this
// checkout is in sync before anyone plans on it: `main` pulled, the kit and the plugins current, the
// knowledge fresh, the Omni page synced, and, for a newcomer, the four setup steps.
//
// It gathers each check's facts, judges them (`../../lib/sync/status.ts`), keeps the record in the
// main checkout's `.omni-loop/local/sync.json` (`../../lib/sync/cache.ts`), and prints the block
// (`../../lib/sync/render.ts`): a status line, one line per check in weight order, and a fix line.
//
// - `--json` prints the record the cache now holds, in place of the block.
// - `--quiet` prints nothing and only refreshes the cache; while another run holds the lock beside
//   the cache, it does nothing at all.
// - `--background` starts `omni sync --quiet` detached and returns at once (none while a run holds
//   the lock): the session's hook and the status line start it, and never wait for it.
// - `--fix` runs the safe fixes (`../../lib/sync/fix.ts`): a switch to the default branch and a
//   fast-forward of it on a clean tree, the plugins, the kit's update and the page's copy, each only
//   when its finding is open; it prints what it did and why it left the rest, then runs the checks
//   again and prints the new status. It never merges, rebases, resets or pushes.
// - `--strict` exits 1 when the status is red (after `--fix`, the new one), for a script or a CI
//   job; anything else exits 0.
//
// Outside a checkout where the loop is installed it prints `sync: the loop is not installed here`
// and exits 0. Exit 2 is a usage error only.
//
// It runs before a context exists, like `constituents`; `main()` hands it `script` (the file that
// runs this `omni`: what `--background` starts, and what `--fix` runs `update` and `constituents`
// with), and a test also hands it `now`, `spawn`, `fixes` (the plugin, kit and page steps) and `kit`
// (the running kit, which tells the kit's own repository).
import { spawn as spawnProcess } from 'node:child_process';
import { ConfigError } from '../../lib/config.ts';
import { loadContext } from '../../lib/context.ts';
import type { Context } from '../../lib/context.ts';
import { mainCheckout } from '../../lib/dossier/local.ts';
import { runningKit } from '../../lib/init/bundle.ts';
import type { RunningKit } from '../../lib/init/bundle.ts';
import { HUD_PLUGIN } from '../../lib/init/settings.ts';
import { propertyOf } from '../../lib/narrow.ts';
import type { Spawn } from '../../lib/statusline/board-cache.ts';
import { releaseSyncLock, syncLockHeld, takeSyncLock } from '../../lib/sync/cache.ts';
import { fixMain, fixOthers } from '../../lib/sync/fix.ts';
import type { FixActions, FixOutcome } from '../../lib/sync/fix.ts';
import { syncLines } from '../../lib/sync/render.ts';
import { runSync } from '../../lib/sync/run.ts';
import type { SyncRecord } from '../../lib/sync/schema.ts';
import { updatePlugin } from '../../lib/update/plugin.ts';
import { parseArgs, println, usageError } from '../args.ts';
import type { Env, Exec, FreeCommand, FreeIo, Out } from '../io.ts';

const USAGE = 'usage: omni sync [--json | --quiet | --background | --fix] [--strict]';
export const NOT_INSTALLED = 'sync: the loop is not installed here';

/** What a test hands `omni sync` beyond `main()`'s own. */
type SyncOptions = { now?: () => number; spawn?: Spawn; fixes?: FixActions; kit?: RunningKit };

/** How long `omni update` and `omni constituents` may take under `--fix`: the update downloads a bundle and opens a pull request. */
const OMNI_BUDGET_MS = 300_000;
/** How long a plugin's update may take, as `omni update` allows it. */
const PLUGIN_BUDGET_MS = 120_000;

/** The checkout's context, or the line to print when the loop is not installed here (or its config does not read). */
function contextOf(cwd: string, exec: Exec): Context | string {
  try {
    return loadContext(cwd, { exec });
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    return error.invalid ? `sync: ${error.message.split('\n')[0] ?? ''}` : NOT_INSTALLED;
  }
}

/** Starts `omni sync --quiet` in `cwd`, detached, its output ignored, unless a run holds the lock. Never throws. */
function startBackground({ cwd, exec, env, script, spawn, now }: { cwd: string; exec: Exec; env: Env; script: string | undefined; spawn: Spawn; now: number }): void {
  try {
    const root = mainCheckout(cwd, exec);
    if (!script || !root || syncLockHeld(root, now)) return;
    const child = spawn(process.execPath, [script, 'sync', '--quiet'], { cwd, detached: true, stdio: 'ignore', windowsHide: true, env });
    child?.on?.('error', () => {});
    child?.unref?.();
  } catch {
    // Nothing started: the next session or render starts another.
  }
}

/** The lock beside the cache, or `null` when a run holds it or it cannot be taken. */
function lockFor(root: string, now: number): string | null {
  try {
    return takeSyncLock(root, now);
  } catch {
    return null;
  }
}

/** What the flags ask for: the block, the record as JSON, nothing (`quiet`), a refresh started in the background, or the fixes then the block. */
type Mode = 'block' | 'json' | 'quiet' | 'background' | 'fix';

/** The mode and `--strict` from `args`; a usage error for an argument or two modes at once. */
function modeOf(args: readonly string[]): { mode: Mode; strict: boolean } {
  const { positional, flags } = parseArgs('sync', args, { booleans: ['json', 'quiet', 'background', 'fix', 'strict'] });
  const modes = (['json', 'quiet', 'background', 'fix'] as const).filter((mode) => flags[mode]);
  if (positional.length > 0 || modes.length > 1) throw usageError(USAGE);
  return { mode: modes[0] ?? 'block', strict: flags.strict === true };
}

/** What `mode` prints of `record`: the block, the record as JSON, or nothing. */
function printed(record: SyncRecord, mode: Mode): string[] {
  if (mode === 'json') return [JSON.stringify(record)];
  return mode === 'block' || mode === 'fix' ? syncLines(record) : [];
}

/** The non-empty lines of `text`, trimmed. */
const linesOf = (text: unknown): string[] =>
  (typeof text === 'string' || text instanceof Buffer ? text.toString() : '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

/** Where `--fix` runs another `omni`. */
type OmniIo = { cwd: string; exec: Exec; env: Env; script: string | undefined };

/** `omni <args>` in `cwd`, as `script` runs it: whether it exited 0, the lines it printed, and its output. */
function runOmni({ cwd, exec, env, script }: OmniIo, args: readonly string[]): FixOutcome & { out: string } {
  if (!script) return { done: false, lines: [`run omni ${args.join(' ')} yourself`], out: '' };
  try {
    const out = exec(process.execPath, [script, ...args], { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: OMNI_BUDGET_MS });
    return { done: true, lines: linesOf(out), out };
  } catch (error) {
    return { done: false, lines: [...linesOf(propertyOf(error, 'stdout')), ...linesOf(propertyOf(error, 'stderr'))], out: '' };
  }
}

/** The page's copy, refreshed by `omni constituents --json`: done when the page answered. */
function refreshPage(io: OmniIo): FixOutcome {
  const run = runOmni(io, ['constituents', '--json']);
  let state: unknown = null;
  try {
    state = propertyOf(JSON.parse(run.out), 'state');
  } catch {
    state = null;
  }
  if (state === 'ok' || state === 'none') return { done: true, lines: [] };
  return { done: false, lines: [`omni constituents: ${typeof state === 'string' ? state : 'no answer'}`] };
}

/** The plugins: the marketplace and the Omni plugin as `omni update` updates them, then the HUD plugin when it is installed. */
function updatePlugins(exec: Exec): FixOutcome {
  const lines: string[] = [];
  const done = updatePlugin({ exec, println: (line) => lines.push(line.trim()) });
  if (!done) return { done, lines };
  try {
    exec('claude', ['plugin', 'update', HUD_PLUGIN], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: PLUGIN_BUDGET_MS });
  } catch {
    // No HUD plugin installed here, or one that would not update: the checks that follow say which.
  }
  return { done, lines: [] };
}

/** The plugin, kit and page steps as they run for a person: `omni update`'s plugin step, `omni update`, `omni constituents`. */
export function actionsFor(io: OmniIo): FixActions {
  return {
    plugins: () => updatePlugins(io.exec),
    kit: () => runOmni(io, ['update']),
    page: () => refreshPage(io),
  };
}

/** Whether this is the kit's own repository, where the kit is built, not installed: `omni` runs from the kit source, or the repository is the kit's home. */
export function inKitRepo(slug: string | null | undefined, running: RunningKit): boolean {
  if (running.source) return true;
  return running.home !== null && running.home.toLowerCase() === slug?.toLowerCase();
}

/** What one run needs beyond the context. */
type RunIo = OmniIo & { stdout: Out; now: () => number; fixes: FixActions | undefined; kit: RunningKit | undefined };

/** `--fix`: a run, the fixes it leaves open, then a run again; the lines the fixes printed, and the last record. */
async function fixed(ctx: Context, root: string, io: RunIo): Promise<{ lines: string[]; record: SyncRecord }> {
  const { cwd, exec } = io;
  const { repo, sync } = ctx.config;
  const before = await runSync({ cwd, root, config: ctx.config, exec, now: io.now() });
  const kitRepo = inKitRepo(repo.slug, io.kit ?? runningKit({ exec }));
  const lines = [
    ...fixMain({ cwd, exec, remote: repo.remote, defaultBranch: repo.defaultBranch, level: sync.levels.main }),
    ...fixOthers({ record: before, kitRepo, actions: io.fixes ?? actionsFor(io) }),
  ];
  const record = await runSync({ cwd, root, config: ctx.config, exec, now: io.now() });
  return { lines: [...(lines.length > 0 ? lines : ['fix: nothing to do']), ''], record };
}

/** One run in `cwd`, under the lock when it can be had (`--quiet` runs only with it): its exit code. */
async function runOnce(ctx: Context, io: RunIo, { mode, strict }: { mode: Mode; strict: boolean }): Promise<number> {
  const { cwd, stdout, exec, now } = io;
  const root = mainCheckout(cwd, exec) ?? ctx.root;
  const owner = lockFor(root, now());
  if (owner === null && mode === 'quiet') return 0;
  try {
    const { lines, record } = mode === 'fix' ? await fixed(ctx, root, io) : { lines: [], record: await runSync({ cwd, root, config: ctx.config, exec, now: now() }) };
    for (const line of [...lines, ...printed(record, mode)]) println(stdout, line);
    return strict && record.status === 'red' ? 1 : 0;
  } finally {
    if (owner !== null) releaseSyncLock(root, owner);
  }
}

export const sync = {
  withoutContext: true,
  async run(args: string[], { cwd, stdout, exec, env, script, now = Date.now, spawn = spawnProcess, fixes, kit }: FreeIo & SyncOptions) {
    const asked = modeOf(args);
    const ctx = contextOf(cwd, exec);
    if (typeof ctx === 'string') {
      if (asked.mode !== 'quiet' && asked.mode !== 'background') println(stdout, ctx);
      return 0;
    }
    if (asked.mode === 'background') {
      startBackground({ cwd, exec, env, script, spawn, now: now() });
      return 0;
    }
    return runOnce(ctx, { cwd, stdout, exec, env, script, now, fixes, kit }, asked);
  },
} satisfies FreeCommand;
