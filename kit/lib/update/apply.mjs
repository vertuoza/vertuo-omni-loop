// `omni update --apply` (PRD 347): what the new version's own code does to a repository. In a
// worktree cut from the remote default branch, on the branch `branches.update` names, it writes this
// bundle over the bin, checks `config.yml` under this version (after the migration step) and never
// rewrites it, creates the knowledge forms the repository lacks through `omni init`'s writer, then
// commits with the signature's trailer, pushes, and opens the pull request. The labels are
// reconciled on GitHub, as `omni init` does. The person's checkout is never touched, and the
// worktree is removed once the work is pushed or given up.
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { CONFIG_FILE, ConfigError, parseConfig } from '../config.mjs';
import { createContext } from '../context.mjs';
import { reconcileLabels } from '../init/labels.mjs';
import { readRepo } from '../init/repo.mjs';
import { writeForms } from '../playbook/write-forms.mjs';
import { footerLine, trailerLine } from '../signature.mjs';
import { UpdateError } from './release.mjs';
import { reportLines, updateBody, updateBranch, updateTitle } from './report.mjs';

const LOOP_DIR = dirname(CONFIG_FILE);
export const BIN_FILE = join(LOOP_DIR, 'bin', 'omni.mjs');

/** Whether `path` is the loop's folder or lies under it, however it is spelled. */
function insideLoop(path) {
  const clean = posix.normalize(path).replace(/\/+$/, '');
  return clean === LOOP_DIR || clean.startsWith(`${LOOP_DIR}/`);
}

/** The first line a failed command wrote, or its message. */
function why(error) {
  const text = String(error?.stderr ?? '').trim() || String(error?.message ?? error);
  return text.split('\n')[0];
}

/** `config.yml` at `root`, checked under `version` after the migration step. Throws UpdateError naming the key. */
export function checkConfig(root, version) {
  const file = join(root, CONFIG_FILE);
  if (!existsSync(file)) throw new UpdateError(`omni update: ${CONFIG_FILE} is missing: this repository is not installed; run omni init.`);
  try {
    return parseConfig(readFileSync(file, 'utf8'), `${CONFIG_FILE} under v${version}`, { migrate: true });
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    throw new UpdateError(`omni update: ${error.message.split('\n')[0]}; nothing was committed.`);
  }
}

/**
 * Brings the repository at `root` to `version`, the running bundle's, from `from` (or `null` for an
 * unversioned bin). Prints what changed and the pull request's link. Throws UpdateError on anything
 * that stops it; nothing is committed before every check has passed.
 *
 * @returns {number} the exit code
 */
export function applyUpdate({ root, bundle, version, from, home, exec, println }) {
  const git = (args, cwd = root) => {
    try {
      return exec('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (error) {
      throw new UpdateError(`omni update: git ${args[0]} failed: ${why(error)}`);
    }
  };
  const gh = (args) => {
    try {
      return exec('gh', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (error) {
      throw new UpdateError(`omni update: gh ${args.slice(0, 2).join(' ')} failed: ${why(error)}`);
    }
  };

  // Everything that can refuse, before anything is written.
  const config = checkConfig(root, version);
  const { remote, defaultBranch } = config.repo;
  const slug = config.repo.slug ?? readRepo(root, { exec, remote }).slug;
  const repoFlag = slug ? ['--repo', slug] : [];
  const branch = updateBranch(config.branches.update, version);

  const open = gh(['pr', 'list', ...repoFlag, '--head', branch, '--state', 'open', '--json', 'url', '--jq', '.[0].url // ""']).trim();
  if (open) {
    println(`PR already open for v${version}: ${open}`);
    return 0;
  }

  git(['fetch', '-q', remote, defaultBranch]);
  const worktree = join(root, config.worktrees, branch.replace(/[^\w.-]+/g, '-'));
  if (existsSync(worktree)) git(['worktree', 'remove', '--force', worktree]);
  mkdirSync(dirname(worktree), { recursive: true });
  git(['worktree', 'add', '-q', '-B', branch, worktree, `${remote}/${defaultBranch}`]);
  try {
    const bin = join(worktree, BIN_FILE);
    mkdirSync(dirname(bin), { recursive: true });
    copyFileSync(bundle, bin);
    chmodSync(bin, 0o755);

    // The default branch's config.yml is the one the pull request carries: it is checked too.
    const branchConfig = checkConfig(worktree, version);
    const ctx = createContext(worktree, branchConfig);
    const outside = !insideLoop(ctx.layout.frontDoor);
    const created = outside ? [] : writeForms({ ctx }).filter((file) => file.wrote).map((file) => file.path);
    const labels = reconcileLabels(root, { exec, labels: branchConfig.labels });
    const lines = reportLines({ from, to: version, forms: { created, outside, dir: ctx.layout.frontDoor }, labels });

    git(['add', '-A', '--', LOOP_DIR], worktree);
    let changed = true;
    try {
      exec('git', ['diff', '--cached', '--quiet'], { cwd: worktree, stdio: 'ignore' });
      changed = false;
    } catch {
      changed = true;
    }
    for (const line of lines) println(line);
    if (!changed) {
      println(`nothing to commit: ${defaultBranch} already holds v${version}`);
      return 0;
    }

    const trailer = trailerLine(branchConfig.signature);
    git(['commit', '-q', '-m', trailer ? `${updateTitle(version)}\n\n${trailer}` : updateTitle(version)], worktree);
    git(['push', '-q', '-u', remote, branch], worktree);
    const body = updateBody({ lines, home, from, to: version, footer: footerLine(branchConfig.signature) });
    const url = gh(['pr', 'create', ...repoFlag, '--base', defaultBranch, '--head', branch, '--title', updateTitle(version), '--body', body]).trim();
    println(`PR: ${url}`);
    return 0;
  } finally {
    try {
      exec('git', ['worktree', 'remove', '--force', worktree], { cwd: root, stdio: 'ignore' });
    } catch {
      // Left for `git worktree prune`: the work is already pushed, or was given up.
    }
  }
}
