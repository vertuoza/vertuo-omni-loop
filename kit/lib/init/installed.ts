// Whether the repository `omni init` runs in is already installed (PRD 893): the remote's default
// branch carries `.omni-loop/config.yml`. A config on the current branch only means the install is
// under way, so the default branch is fetched and read, never the working tree. The remote and the
// default branch come from the config on disk when it is there and valid, otherwise from the schema's
// remote and the branch `readRepo` names. Nothing here throws: no remote, a failed fetch, a missing or
// invalid config at that ref each mean "not detected", and init runs its first-install flow.
// An installed repository is also **invaded** when a form under the playbook its config at that ref
// names is filled (playbook/filled.ts); its date is the latest `invaded:` among the filled forms. A
// playbook git cannot list there is no invasion, never a failed detection.
import type { ExecFileSyncOptionsWithStringEncoding } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { CONFIG_FILE, CONFIG_VERSION, ConfigSchema, parseConfig } from '../config.ts';
import type { ExecText } from '../context.ts';
import { gitWithoutPrompt } from '../env/read.ts';
import type { Config } from '../types.ts';
import { invadedOn, isFilled, playbookOf } from '../playbook/filled.ts';
import { readRepo } from './repo.ts';

/** A repository's invasion: the latest `invaded:` date among its filled forms, `null` when none carries one. */
export type Invasion = { date: string | null };

/** The install `detectInstall` found on the remote's default branch. */
export type Install = { remote: string; defaultBranch: string; config: Config; invaded: Invasion | null };

/** The loop's own folder, where `omni init` writes everything but the status line. */
export const LOOP_DIR = dirname(CONFIG_FILE);

/** Whether `path` is the loop's folder or lies under it, however it is spelled. */
export function insideLoop(path: string): boolean {
  const clean = posix.normalize(path).replace(/\/+$/, '');
  return clean === LOOP_DIR || clean.startsWith(`${LOOP_DIR}/`);
}

// No prompt for credentials: a remote that wants them is a failed fetch, never a hung init.
const QUIET: ExecFileSyncOptionsWithStringEncoding = {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'ignore'],
  env: gitWithoutPrompt(),
};

function attempt<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}

/** The remote and default branch to read the install from, each `null` when nothing can say. */
function target(root: string, exec: ExecText): { remote: string | null; defaultBranch: string | null } {
  const path = join(root, CONFIG_FILE);
  const onDisk = existsSync(path) ? attempt(() => parseConfig(readFileSync(path, 'utf8'), CONFIG_FILE)) : null;
  if (onDisk) return { remote: onDisk.repo.remote, defaultBranch: onDisk.repo.defaultBranch };
  const { remote } = ConfigSchema.parse({ kit: CONFIG_VERSION }).repo;
  return { remote, defaultBranch: readRepo(root, { exec, remote }).defaultBranch };
}

/**
 * Whether the playbook at `ref` holds a filled form: `{ date }`, the latest `invaded:` date among the
 * filled forms (`null` when none carries one), or `null` when no form there is filled.
 */
function invasion(run: (...args: string[]) => string, ref: string, configText: string): Invasion | null {
  const playbook = playbookOf(configText);
  const listed = attempt(() => run('ls-tree', ref, '--', `${playbook}/`)) ?? '';
  const forms = listed
    .split('\n')
    .map((line) => /^\d+ blob \w+\t(.+)$/.exec(line)?.[1])
    .filter((path): path is string => path?.endsWith('.md') === true);
  const texts = forms.map((path) => attempt(() => run('show', `${ref}:${path}`))).filter(isFilled);
  if (!texts.length) return null;
  const dates = texts.map(invadedOn).filter((date): date is string => Boolean(date)).sort();
  return { date: dates.at(-1) ?? null };
}

/**
 * The install on the remote's default branch: `config` being the parsed config that branch holds and
 * `invaded` its invasion (`null` when no form is filled) — or `null` when nothing is detected.
 */
export function detectInstall(root: string, { exec }: { exec: ExecText }): Install | null {
  const { remote, defaultBranch } = target(root, exec);
  if (!remote || !defaultBranch) return null;
  const run = (...args: string[]): string => exec('git', args, { cwd: root, ...QUIET });
  if (attempt(() => run('fetch', '--quiet', remote, defaultBranch)) === null) return null;
  const ref = `refs/remotes/${remote}/${defaultBranch}`;
  const text = attempt(() => run('show', `${ref}:${CONFIG_FILE}`));
  if (text === null) return null;
  const config = attempt(() => parseConfig(text, `${remote}/${defaultBranch}:${CONFIG_FILE}`));
  return config ? { remote, defaultBranch, config, invaded: invasion(run, ref, text) } : null;
}
