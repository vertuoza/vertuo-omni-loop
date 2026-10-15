// `omni sync [--json | --quiet | --background] [--strict]` (PRD 1990) — whether this checkout is in
// sync before anyone plans on it: `main` pulled, the kit and the plugins current, the knowledge
// fresh, the Omni page synced, and, for a newcomer, the four setup steps.
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
// - `--strict` exits 1 when the status is red, for a script or a CI job; anything else exits 0.
//
// Outside a checkout where the loop is installed it prints `sync: the loop is not installed here`
// and exits 0. Exit 2 is a usage error only.
//
// It runs before a context exists, like `constituents`; `main()` hands it `script` (the file that
// runs this `omni`, what `--background` starts), and a test also hands it `now` and `spawn`.
import { spawn as spawnProcess } from 'node:child_process';
import { ConfigError } from '../../lib/config.ts';
import { loadContext } from '../../lib/context.ts';
import type { Context } from '../../lib/context.ts';
import { mainCheckout } from '../../lib/dossier/local.ts';
import type { Spawn } from '../../lib/statusline/board-cache.ts';
import { releaseSyncLock, syncLockHeld, takeSyncLock } from '../../lib/sync/cache.ts';
import { syncLines } from '../../lib/sync/render.ts';
import { runSync } from '../../lib/sync/run.ts';
import type { SyncRecord } from '../../lib/sync/schema.ts';
import { parseArgs, println, usageError } from '../args.ts';
import type { Env, Exec, FreeCommand, FreeIo, Out } from '../io.ts';

const USAGE = 'usage: omni sync [--json | --quiet | --background] [--strict]';
export const NOT_INSTALLED = 'sync: the loop is not installed here';

/** What a test hands `omni sync` beyond `main()`'s own. */
type SyncOptions = { now?: () => number; spawn?: Spawn };

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

/** What the flags ask for: the block, the record as JSON, nothing (`quiet`), or a refresh started in the background. */
type Mode = 'block' | 'json' | 'quiet' | 'background';

/** The mode and `--strict` from `args`; a usage error for an argument or two modes at once. */
function modeOf(args: readonly string[]): { mode: Mode; strict: boolean } {
  const { positional, flags } = parseArgs('sync', args, { booleans: ['json', 'quiet', 'background', 'strict'] });
  const modes = (['json', 'quiet', 'background'] as const).filter((mode) => flags[mode]);
  if (positional.length > 0 || modes.length > 1) throw usageError(USAGE);
  return { mode: modes[0] ?? 'block', strict: flags.strict === true };
}

/** What `mode` prints of `record`: the block, the record as JSON, or nothing. */
function printed(record: SyncRecord, mode: Mode): string[] {
  if (mode === 'json') return [JSON.stringify(record)];
  return mode === 'block' ? syncLines(record) : [];
}

/** One run in `cwd`, under the lock when it can be had (`--quiet` runs only with it): its exit code. */
async function runOnce(ctx: Context, { cwd, stdout, exec, now }: { cwd: string; stdout: Out; exec: Exec; now: () => number }, { mode, strict }: { mode: Mode; strict: boolean }): Promise<number> {
  const root = mainCheckout(cwd, exec) ?? ctx.root;
  const owner = lockFor(root, now());
  if (owner === null && mode === 'quiet') return 0;
  try {
    const record = await runSync({ cwd, root, config: ctx.config, exec, now: now() });
    for (const line of printed(record, mode)) println(stdout, line);
    return strict && record.status === 'red' ? 1 : 0;
  } finally {
    if (owner !== null) releaseSyncLock(root, owner);
  }
}

export const sync = {
  withoutContext: true,
  async run(args: string[], { cwd, stdout, exec, env, script, now = Date.now, spawn = spawnProcess }: FreeIo & SyncOptions) {
    const asked = modeOf(args);
    const ctx = contextOf(cwd, exec);
    if (typeof ctx === 'string') {
      if (asked.mode === 'block' || asked.mode === 'json') println(stdout, ctx);
      return 0;
    }
    if (asked.mode === 'background') {
      startBackground({ cwd, exec, env, script, spawn, now: now() });
      return 0;
    }
    return runOnce(ctx, { cwd, stdout, exec, now }, asked);
  },
} satisfies FreeCommand;
