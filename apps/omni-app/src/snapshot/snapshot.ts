// `snapshot`: an installation's Octokit, a repository, a ref and a LIST OF PATHS in, a local folder
// holding exactly those paths at that ref out. It reads through GitHub's Git Data API (trees and
// blobs) only — it never clones, and never runs anything it fetched (PRD 28, decision 5).
//
// Only the listed paths are fetched: the tree is walked down each path one segment at a time, and a
// listed folder is expanded recursively from its own subtree, so nothing outside the list is read —
// not even the rest of the repository's tree. A listed path the ref does not hold is left out (the
// base branch of an inactive repository has no `.omni-loop/config.yml`; that absence is the answer).
//
// The snapshot is bounded (decision 11): at most MAX_FILES files and MAX_BYTES bytes across every
// listed path together, counted from the tree's sizes BEFORE any blob is fetched. Past either, it
// throws SnapshotBoundError naming the bound, which the outbox check reports as its failure reason.
//
// The Octokit seam is `octokit.request(route, params)` alone, which every Octokit — the installation
// client `@octokit/app` hands out included — carries, so a test stubs one function.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { BlobSchema, TreeSchema, type GitHubClient, type TreeEntry } from '../outbox-check/github-schema.ts';

export const MAX_FILES = 2000;
export const MAX_BYTES = 20 * 1024 * 1024;

const TREE = 'GET /repos/{owner}/{repo}/git/trees/{tree_sha}';
const BLOB = 'GET /repos/{owner}/{repo}/git/blobs/{file_sha}';

export class SnapshotBoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotBoundError';
  }
}

/** A regular file to fetch: its path in the repository, its blob, its size. */
type FileAt = { path: string; sha: string; size: number | null | undefined };

/** One tree's entries, by its sha, listed recursively or not. */
type TreeReader = (treeSha: string, recursive?: boolean) => Promise<TreeEntry[]>;

/**
 * @returns the folder the paths were written under
 */
export async function snapshot(
  octokit: GitHubClient,
  { owner, repo, ref, paths, dest }: { owner: string; repo: string; ref: string; paths: string[]; dest?: string | undefined },
): Promise<string> {
  const segmentsOf = paths.map(repositoryPath);
  const trees = new Map<string, TreeEntry[]>();
  const tree: TreeReader = async (treeSha, recursive = false) => {
    const key = `${treeSha}${recursive ? ':r' : ''}`;
    const known = trees.get(key);
    if (known) return known;
    const params = { owner, repo, tree_sha: treeSha, ...(recursive ? { recursive: '1' } : {}) };
    const { data: answer } = await octokit.request(TREE, params);
    const data = TreeSchema.parse(answer);
    if (data.truncated) {
      throw new SnapshotBoundError(`The tree under ${treeSha} is too large for GitHub to list whole.`);
    }
    trees.set(key, data.tree);
    return data.tree;
  };

  const files = new Map<string, FileAt>();
  for (const segments of segmentsOf) {
    for (const file of await filesUnder(tree, ref, segments)) files.set(file.path, file);
  }

  const list = [...files.values()];
  if (list.length > MAX_FILES) {
    throw new SnapshotBoundError(
      `The snapshot holds ${list.length.toLocaleString('en-US')} files, over the bound of ${MAX_FILES.toLocaleString('en-US')} files.`,
    );
  }
  const bytes = list.reduce((sum, file) => sum + (file.size ?? 0), 0);
  if (bytes > MAX_BYTES) {
    throw new SnapshotBoundError(
      `The snapshot holds ${bytes.toLocaleString('en-US')} bytes, over the bound of 20 MB.`,
    );
  }

  const folder = dest ?? mkdtempSync(join(tmpdir(), 'omni-snapshot-'));
  for (const file of list) {
    const { data: answer } = await octokit.request(BLOB, { owner, repo, file_sha: file.sha });
    const data = BlobSchema.parse(answer);
    const target = join(folder, ...repositoryPath(file.path));
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, Buffer.from(data.content, data.encoding === 'base64' ? 'base64' : 'utf8'));
  }
  return folder;
}

/** A listed path's segments, refusing anything that could land outside the snapshot folder. */
function repositoryPath(path: string): string[] {
  const segments = path.split('/').filter((segment) => segment !== '');
  if (segments.length === 0 || segments.some((segment) => segment === '.' || segment === '..')) {
    throw new Error(`snapshot: "${path}" is not a repository path.`);
  }
  return segments;
}

/**
 * The regular files at or under one listed path, walking the tree one segment at a time from the
 * ref's root. Symlinks and submodules are never followed or written.
 */
async function filesUnder(tree: TreeReader, ref: string, segments: string[]): Promise<FileAt[]> {
  let entries = await tree(ref);
  for (const [index, name] of segments.entries()) {
    const entry = entries.find((candidate) => candidate.path === name);
    if (!entry) return [];
    const path = segments.slice(0, index + 1).join('/');
    const last = index === segments.length - 1;
    if (entry.type === 'blob') {
      return last && isRegular(entry) ? [{ path, sha: entry.sha, size: entry.size }] : [];
    }
    if (entry.type !== 'tree') return [];
    if (last) {
      return (await tree(entry.sha, true))
        .filter((child) => child.type === 'blob' && isRegular(child))
        .map((child) => ({ path: `${path}/${child.path}`, sha: child.sha, size: child.size }));
    }
    entries = await tree(entry.sha);
  }
  return [];
}

const isRegular = (entry: TreeEntry): boolean => entry.mode === '100644' || entry.mode === '100755';
