// The global `omni` (PRD 420): the bundle a person installs once per computer with npm is a launcher.
// Before any command runs, it looks at where it runs:
// - inside a git checkout whose `.omni-loop/bin/omni.mjs` exists and is a different file from the
//   running one, it hands over to that file — every argument, stdin, stdout and stderr pass through,
//   and its exit code is the launcher's — so a repository always runs its own pinned copy, except for
//   `update --apply`: that is a release bundle `omni update` downloaded to install its own version,
//   and handing it back to the older pinned bin would install the old version again (#643);
// - otherwise it runs itself. Outside a repository that has the kit (neither its bin nor its config),
//   only the commands that need no kit run (`init`, `help`, `version` and their flags, and the ask
//   hooks, which must stay silent wherever Claude Code fires them); any other command is refused with
//   one line, exit 2.
// Only the running bundle (or `node kit/bin/omni.ts`) launches: `main()` itself never does, so a
// repository's own bin, and every test that calls `main()`, runs exactly as before.
import { execFileSync, spawnSync } from 'node:child_process';
import type { SpawnSyncOptions } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { CONFIG_FILE } from '../config.ts';
import type { ExecText } from '../context.ts';
import { BIN_FILE } from '../update/apply.ts';

export const NO_KIT = 'omni: no Omni Loop kit here — run omni init in your repository';

/** What the launcher does: hand over to the checkout's bin, run itself, or refuse with one line. */
export type LaunchDecision = { kind: 'handover'; bin: string } | { kind: 'self' } | { kind: 'refuse'; message: string };

/** What runs the bin: shaped like `spawnSync`, of whose result only these three fields are read. */
export type SpawnRun = (command: string, args: readonly string[], options: SpawnSyncOptions) => {
  error?: Error | undefined;
  status?: number | null;
  signal?: string | null;
};

// What runs with no kit: no command at all (the usage line), and the commands that need none.
const WITHOUT_KIT = new Set<string | undefined>([undefined, 'init', 'help', '--help', '-h', 'version', '--version']);

/** Whether `argv` may run in a place with no kit. */
export function runsWithoutKit(argv: readonly string[]): boolean {
  const [name, sub] = argv;
  return WITHOUT_KIT.has(name) || (name === 'ask' && sub === 'hook');
}

/** Whether `argv` is the hop where `omni update` runs a downloaded bundle to install itself. */
function appliesUpdate(argv: readonly string[]): boolean {
  return argv[0] === 'update' && argv.includes('--apply');
}

/**
 * What the launcher does, decided from facts alone:
 * `{ kind: 'handover', bin }`, `{ kind: 'self' }` or `{ kind: 'refuse', message }`.
 * `self` the running file and `bin` the checkout's bin, both real paths; `bin` is `null` outside
 * a git checkout or when the checkout has none. `hasConfig`: the checkout has the kit's config.
 */
export function launchDecision({ argv, self, bin, hasConfig }: { argv: readonly string[]; self: string; bin: string | null; hasConfig: boolean }): LaunchDecision {
  if (bin !== null && bin !== self && !appliesUpdate(argv)) return { kind: 'handover', bin };
  if (bin !== null || hasConfig || runsWithoutKit(argv)) return { kind: 'self' };
  return { kind: 'refuse', message: NO_KIT };
}

/** The real path of `path`, or `null` when it does not exist. */
function real(path: string): string | null {
  try {
    return existsSync(path) ? realpathSync(path) : null;
  } catch {
    return null;
  }
}

/** The top of the git checkout `cwd` is in, or `null` outside one (or with no git). */
function checkoutRoot(cwd: string, exec: ExecText): string | null {
  try {
    return exec('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null;
  } catch {
    return null;
  }
}

/** The launcher's decision for `argv` run from `cwd` by the file `self`. */
export function planLaunch(argv: readonly string[], { cwd = process.cwd(), self, exec = execFileSync }: { cwd?: string; self: string; exec?: ExecText }): LaunchDecision {
  const root = checkoutRoot(cwd, exec);
  const bin = root === null ? null : real(join(root, BIN_FILE));
  const hasConfig = root !== null && existsSync(join(root, CONFIG_FILE));
  return launchDecision({ argv, self: real(self) ?? self, bin, hasConfig });
}

/**
 * Runs `bin` with node and `argv`, stdin, stdout and stderr passed through, and returns its exit
 * code: 1 when it was stopped by a signal.
 */
export function handOver(bin: string, argv: readonly string[], { spawn = spawnSync }: { spawn?: SpawnRun } = {}): number {
  const run = spawn(process.execPath, [bin, ...argv], { stdio: 'inherit' });
  if (run.error) throw run.error;
  return run.status ?? 1;
}
