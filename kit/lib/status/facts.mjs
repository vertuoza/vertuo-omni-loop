// Every git call of `omni status`'s overview, and nothing else: it reads the base — the default
// branch as last fetched — and returns plain data for `overview.mjs`. It never reads the working
// tree, and it touches the network only when asked to fetch; the fetch is also the only thing it
// writes, and a failed one leaves the checkout's `FETCH_HEAD` as it found it.
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseFolderName } from '../layout.mjs';

function git(ctx, exec, args) {
  return exec('git', args, { cwd: ctx.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

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

/** The PRD folders directly under `dir` at `commit`, as `{ prd, topic }`; none when `dir` is not
 * there. */
function foldersAt(ctx, exec, commit, dir) {
  return git(ctx, exec, ['ls-tree', '-z', '-d', '--name-only', commit, '--', `${dir}/`])
    .split('\0')
    .filter(Boolean)
    .map((path) => parseFolderName(path.slice(path.lastIndexOf('/') + 1)))
    .filter(Boolean);
}

/** Where this checkout keeps its `FETCH_HEAD`, or `null` when git cannot say. */
function fetchHeadPath(ctx, exec) {
  try {
    return resolve(ctx.root, git(ctx, exec, ['rev-parse', '--git-path', 'FETCH_HEAD']).trim());
  } catch {
    return null;
  }
}

/** When this checkout last fetched: its `FETCH_HEAD`'s time, in ms, or `null` when it never did. A
 * failed fetch leaves git's `FETCH_HEAD` empty, stamped with the failure's time, so an empty one
 * tells no fetch time either. */
function fetchedAt(ctx, exec) {
  const path = fetchHeadPath(ctx, exec);
  if (path === null) return null;
  try {
    const stat = statSync(path);
    return stat.size > 0 ? stat.mtimeMs : null;
  } catch {
    return null;
  }
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

/**
 * What the overview needs, read from the base: `{ slug, base, fetchedAt, shipped, inbox }`, `base`
 * being the name it was read under. `null` when neither the remote-tracking default branch nor the
 * local one exists.
 */
export function readFacts({ ctx, exec = execFileSync }) {
  const base = readBase(ctx, exec);
  if (!base) return null;
  const { dirs } = ctx.layout;
  return {
    slug: ctx.config.repo.slug,
    base: base.name,
    fetchedAt: fetchedAt(ctx, exec),
    shipped: foldersAt(ctx, exec, base.commit, dirs.shipped),
    inbox: foldersAt(ctx, exec, base.commit, dirs.inbox),
  };
}
