// @ts-nocheck
// Where `omni init` is running: the repository root, and the slug and default branch it records.
// `gh` answers first; git's `origin` remote and `origin/HEAD` are the fallback when it cannot.
import { realpathSync } from 'node:fs';
import { ConfigError } from '../config.ts';
import { slugFromRemote } from '../context.ts';

const QUIET = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] };

function attempt(fn) {
  try {
    return fn();
  } catch {
    return null;
  }
}

/** The repository root `cwd` sits in, or a ConfigError — the same line every other command prints. */
export function findRoot(cwd, exec) {
  const root = attempt(() => exec('git', ['rev-parse', '--show-toplevel'], { cwd, ...QUIET }).trim());
  if (!root) throw new ConfigError(`${cwd} is not inside a git repository.`);
  return realpathSync(root);
}

/**
 * `{ slug, defaultBranch }`, each `null` when neither `gh` nor git can say. `remote` is the git
 * remote the fallback reads (the schema's default).
 */
export function readRepo(root, { exec, remote }) {
  const gh = attempt(() => JSON.parse(exec('gh', ['repo', 'view', '--json', 'nameWithOwner,defaultBranchRef'], { cwd: root, ...QUIET })));
  const slug = gh?.nameWithOwner
    || attempt(() => slugFromRemote(exec('git', ['remote', 'get-url', remote], { cwd: root, ...QUIET })));
  const head = attempt(() => exec('git', ['symbolic-ref', `refs/remotes/${remote}/HEAD`], { cwd: root, ...QUIET }).trim());
  const prefix = `refs/remotes/${remote}/`;
  const defaultBranch = gh?.defaultBranchRef?.name
    || (head?.startsWith(prefix) ? head.slice(prefix.length) : null);
  return { slug: slug || null, defaultBranch: defaultBranch || null };
}
