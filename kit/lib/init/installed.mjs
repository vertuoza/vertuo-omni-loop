// Whether the repository `omni init` runs in is already installed (PRD 893): the remote's default
// branch carries `.omni-loop/config.yml`. A config on the current branch only means the install is
// under way, so the default branch is fetched and read, never the working tree. The remote and the
// default branch come from the config on disk when it is there and valid, otherwise from the schema's
// remote and the branch `readRepo` names. Nothing here throws: no remote, a failed fetch, a missing or
// invalid config at that ref each mean "not detected", and init runs its first-install flow.
// An installed repository is also **invaded** when a form under the playbook its config at that ref
// names is filled (playbook/filled.mjs); its date is the latest `invaded:` among the filled forms. A
// playbook git cannot list there is no invasion, never a failed detection.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { CONFIG_FILE, CONFIG_VERSION, ConfigSchema, parseConfig } from '../config.mjs';
import { invadedOn, isFilled, playbookOf } from '../playbook/filled.mjs';
import { readRepo } from './repo.mjs';

/** The loop's own folder, where `omni init` writes everything but the status line. */
export const LOOP_DIR = dirname(CONFIG_FILE);

/** Whether `path` is the loop's folder or lies under it, however it is spelled. */
export function insideLoop(path) {
  const clean = posix.normalize(path).replace(/\/+$/, '');
  return clean === LOOP_DIR || clean.startsWith(`${LOOP_DIR}/`);
}

// No prompt for credentials: a remote that wants them is a failed fetch, never a hung init.
const QUIET = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } };

function attempt(fn) {
  try {
    return fn();
  } catch {
    return null;
  }
}

/** The remote and default branch to read the install from, each `null` when nothing can say. */
function target(root, exec) {
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
function invasion(run, ref, configText) {
  const playbook = playbookOf(configText);
  const listed = attempt(() => run('ls-tree', ref, '--', `${playbook}/`)) ?? '';
  const forms = listed
    .split('\n')
    .map((line) => /^\d+ blob \w+\t(.+)$/.exec(line)?.[1])
    .filter((path) => path?.endsWith('.md'));
  const texts = forms.map((path) => attempt(() => run('show', `${ref}:${path}`))).filter(isFilled);
  if (!texts.length) return null;
  const dates = texts.map(invadedOn).filter(Boolean).sort();
  return { date: dates.at(-1) ?? null };
}

/**
 * The install on the remote's default branch: `{ remote, defaultBranch, config, invaded }`, `config`
 * being the parsed config that branch holds and `invaded` its invasion (`{ date }`, or `null` when no
 * form is filled) — or `null` when nothing is detected.
 *
 * @param {string} root
 * @param {{ exec: Function }} o
 * @returns {{ remote: string, defaultBranch: string, config: object, invaded: { date: string|null } | null } | null}
 */
export function detectInstall(root, { exec }) {
  const { remote, defaultBranch } = target(root, exec);
  if (!remote || !defaultBranch) return null;
  const run = (...args) => exec('git', args, { cwd: root, ...QUIET });
  if (attempt(() => run('fetch', '--quiet', remote, defaultBranch)) === null) return null;
  const ref = `refs/remotes/${remote}/${defaultBranch}`;
  const text = attempt(() => run('show', `${ref}:${CONFIG_FILE}`));
  if (text === null) return null;
  const config = attempt(() => parseConfig(text, `${remote}/${defaultBranch}:${CONFIG_FILE}`));
  return config ? { remote, defaultBranch, config, invaded: invasion(run, ref, text) } : null;
}
