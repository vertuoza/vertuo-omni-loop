// Every git call of `omni status`'s overview, and nothing else: it reads the base — the default
// branch as last fetched — and the remote feature and phase-0 branches, and returns plain data for
// `overview.mjs`. It never reads the working tree, and it touches the network only when asked to
// fetch; the fetch is also the only thing it writes, and a failed one leaves the checkout's
// `FETCH_HEAD` as it found it.
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fillBranch } from '../board.mjs';
import { parseFolderName } from '../layout.mjs';

function git(ctx, exec, args) {
  return exec('git', args, { cwd: ctx.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

/** Git's `-z` output, split into its entries. */
const entries = (output) => output.split('\0').filter(Boolean);

/** The commit `ref` names, or `null` when it names none. */
function commitOf(ctx, exec, ref) {
  try {
    return git(ctx, exec, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]).trim() || null;
  } catch {
    return null;
  }
}

/** The names the base is read under: `<repo.remote>/<repo.defaultBranch>`, else the local branch. */
export function baseNames(ctx) {
  const { remote, defaultBranch } = ctx.config.repo;
  return { remote: `${remote}/${defaultBranch}`, local: defaultBranch };
}

/** The base, `{ name, commit }`: the remote-tracking default branch as last fetched, else the local
 * default branch, else `null`. */
function readBase(ctx, exec) {
  const names = baseNames(ctx);
  const remote = commitOf(ctx, exec, `refs/remotes/${names.remote}`);
  if (remote) return { name: names.remote, commit: remote };
  const local = commitOf(ctx, exec, `refs/heads/${names.local}`);
  return local ? { name: names.local, commit: local } : null;
}

/** The PRD folders directly under `dir` at `ref`, as `{ prd, topic, name }`; none when `dir` is not
 * there. */
function foldersAt(ctx, exec, ref, dir) {
  return entries(git(ctx, exec, ['ls-tree', '-z', '-d', '--name-only', ref, '--', `${dir}/`]))
    .map((path) => {
      const name = path.slice(path.lastIndexOf('/') + 1);
      const folder = parseFolderName(name);
      return folder && { ...folder, name };
    })
    .filter(Boolean);
}

/** A path `git rev-parse <args>` prints, made absolute, or `null` when git cannot say. */
function gitPath(ctx, exec, args) {
  try {
    return resolve(ctx.root, git(ctx, exec, ['rev-parse', ...args]).trim());
  } catch {
    return null;
  }
}

/** Where this checkout keeps its `FETCH_HEAD`: a linked worktree keeps its own. */
const fetchHeadPath = (ctx, exec) => gitPath(ctx, exec, ['--git-path', 'FETCH_HEAD']);

/** When the `FETCH_HEAD` at `path` says a fetch happened, in ms, or `null`. A failed fetch leaves
 * git's `FETCH_HEAD` empty, stamped with the failure's time, so an empty one tells no fetch time. */
function fetchTime(path) {
  if (path === null) return null;
  try {
    const stat = statSync(path);
    return stat.size > 0 ? stat.mtimeMs : null;
  } catch {
    return null;
  }
}

/** When the remote branches were last fetched, in ms, or `null` when they never were: the newer of
 * this checkout's `FETCH_HEAD` and the one in the repository's common git folder. Git keeps a
 * `FETCH_HEAD` per worktree but shares the remote branches between them all, so a linked worktree
 * also reads a fetch run in the main checkout. */
function fetchedAt(ctx, exec) {
  const common = gitPath(ctx, exec, ['--git-common-dir']);
  const times = [fetchHeadPath(ctx, exec), common && resolve(common, 'FETCH_HEAD')]
    .map(fetchTime)
    .filter((time) => time !== null);
  return times.length ? Math.max(...times) : null;
}

/** `FETCH_HEAD` as it is now, to put back after a failed fetch: its bytes and times, or absent. */
function snapshot(path) {
  if (path === null) return null;
  try {
    const stat = statSync(path);
    return { path, bytes: readFileSync(path), atime: stat.atime, mtime: stat.mtime };
  } catch {
    return { path, bytes: null };
  }
}

function putBack(saved) {
  if (saved === null) return;
  try {
    if (saved.bytes === null) {
      rmSync(saved.path, { force: true });
    } else {
      writeFileSync(saved.path, saved.bytes);
      utimesSync(saved.path, saved.atime, saved.mtime);
    }
  } catch {
    // The header then reads the failed fetch's empty FETCH_HEAD, which tells no fetch time.
  }
}

/**
 * `git fetch --prune <repo.remote>`. Returns `null` when it worked, else the first line git gave
 * for its failure. A failed fetch puts `FETCH_HEAD` back as it found it, so the header still says
 * when the last fetch that worked happened.
 */
export function fetchRemote({ ctx, exec = execFileSync }) {
  const saved = snapshot(fetchHeadPath(ctx, exec));
  try {
    git(ctx, exec, ['fetch', '--prune', ctx.config.repo.remote]);
    return null;
  } catch (error) {
    putBack(saved);
    const said = `${error?.stderr ?? ''}`.split('\n').map((line) => line.trim()).find(Boolean);
    return said ?? `${error?.message ?? error}`.split('\n')[0];
  }
}

/** The remote branches, each name under `<repo.remote>/` mapped to its full ref. */
function remoteBranches(ctx, exec) {
  const prefix = `refs/remotes/${ctx.config.repo.remote}/`;
  const refs = git(ctx, exec, ['for-each-ref', '--format=%(refname)', prefix]).split('\n').filter(Boolean);
  return new Map(refs.map((ref) => [ref.slice(prefix.length), ref]));
}

/** The `{topic}` that `template` was filled with to name `branch`, or `null` when it does not
 * match. */
function topicOf(branch, template) {
  if (!template.includes('{topic}')) return null;
  const [head, tail] = template.split('{topic}');
  if (branch.length <= head.length + tail.length || !branch.startsWith(head) || !branch.endsWith(tail)) return null;
  return branch.slice(head.length, branch.length - tail.length);
}

/** The paths outside the delivery folder that `git diff --name-only <range>` lists. */
function changedOutside(ctx, exec, range) {
  const delivery = `${ctx.config.paths.delivery}/`;
  return entries(git(ctx, exec, ['diff', '--name-only', '-z', '--no-renames', '--no-ext-diff', ...range, '--']))
    .filter((path) => !path.startsWith(delivery));
}

/** Every file under `dir` at `ref`, named relative to `dir`. */
function filesUnder(ctx, exec, ref, dir) {
  return entries(git(ctx, exec, ['ls-tree', '-r', '-z', '--name-only', ref, '--', `${dir}/`]))
    .map((path) => path.slice(dir.length + 1));
}

/** What `read` returns, or `null` when it throws: a branch that cannot be read is skipped, and the
 * overview never fails because of one. */
function unlessUnreadable(read) {
  try {
    return read();
  } catch {
    return null;
  }
}

/**
 * The feature branch (`branches.feature` with the folder's topic) of each PRD in the base's inbox
 * that has one on the remote, as `{ branch, topic, forked, differs, outbox }`: `forked` holds the
 * paths outside the delivery folder it changed since it forked from the base, `differs` those that
 * differ from the base now, and `outbox` every file under the PRD's outbox folder on it.
 */
function featuresOf(ctx, exec, base, inbox, remote) {
  const out = [];
  for (const { topic, name } of inbox) {
    const branch = fillBranch(ctx.config.branches.feature, { topic });
    const ref = remote.get(branch);
    if (!ref) continue;
    const feature = unlessUnreadable(() => ({
      branch,
      topic,
      forked: changedOutside(ctx, exec, [`${base}...${ref}`]),
      differs: changedOutside(ctx, exec, [base, ref]),
      outbox: filesUnder(ctx, exec, ref, `${ctx.layout.dirs.outbox}/${name}`),
    }));
    if (feature) out.push(feature);
  }
  return out;
}

/** Every remote branch shaped like `branches.phase0`, with its topic and the PRD folders in its
 * inbox, as `{ branch, topic, inbox }`. */
function phase0Of(ctx, exec, remote) {
  const out = [];
  for (const [branch, ref] of remote) {
    const topic = topicOf(branch, ctx.config.branches.phase0);
    if (!topic) continue;
    const inbox = unlessUnreadable(() => foldersAt(ctx, exec, ref, ctx.layout.dirs.inbox));
    if (inbox) out.push({ branch, topic, inbox });
  }
  return out;
}

/**
 * What the overview needs: `{ slug, base, fetchedAt, shipped, inbox, features, phase0 }` — `base`
 * the name the base was read under, `shipped` and `inbox` its PRD folders, `features` the feature
 * branches of its inbox's PRDs and `phase0` the phase-0 branches, both read on `<repo.remote>`.
 * `null` when neither the remote-tracking default branch nor the local one exists.
 */
export function readFacts({ ctx, exec = execFileSync }) {
  const base = readBase(ctx, exec);
  if (!base) return null;
  const { dirs } = ctx.layout;
  const inbox = foldersAt(ctx, exec, base.commit, dirs.inbox);
  const remote = remoteBranches(ctx, exec);
  return {
    slug: ctx.config.repo.slug,
    base: base.name,
    fetchedAt: fetchedAt(ctx, exec),
    shipped: foldersAt(ctx, exec, base.commit, dirs.shipped),
    inbox,
    features: featuresOf(ctx, exec, base.commit, inbox, remote),
    phase0: phase0Of(ctx, exec, remote),
  };
}
