// Whether the repository `omni init` runs in is already installed (PRD 893): the remote's default
// branch carries `.omni-loop/config.yml`. A config on the current branch only means the install is
// under way, so the default branch is fetched and read, never the working tree. The remote and the
// default branch come from the config on disk when it is there and valid, otherwise from the schema's
// remote and the branch `readRepo` names. Nothing here throws: no remote, a failed fetch, a missing or
// invalid config at that ref each mean "not detected", and init runs its first-install flow.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CONFIG_FILE, CONFIG_VERSION, ConfigSchema, parseConfig } from '../config.mjs';
import { readRepo } from './repo.mjs';

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
 * The install on the remote's default branch: `{ remote, defaultBranch, config }`, `config` being
 * the parsed config that branch holds — or `null` when nothing is detected.
 *
 * @param {string} root
 * @param {{ exec: Function }} o
 * @returns {{ remote: string, defaultBranch: string, config: object } | null}
 */
export function detectInstall(root, { exec }) {
  const { remote, defaultBranch } = target(root, exec);
  if (!remote || !defaultBranch) return null;
  const run = (...args) => exec('git', args, { cwd: root, ...QUIET });
  if (attempt(() => run('fetch', '--quiet', remote, defaultBranch)) === null) return null;
  const at = `refs/remotes/${remote}/${defaultBranch}:${CONFIG_FILE}`;
  const text = attempt(() => run('show', at));
  if (text === null) return null;
  const config = attempt(() => parseConfig(text, `${remote}/${defaultBranch}:${CONFIG_FILE}`));
  return config ? { remote, defaultBranch, config } : null;
}
