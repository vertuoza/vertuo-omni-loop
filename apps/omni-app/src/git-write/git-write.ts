// `git-write`: file edits and moves in, a branch, one commit and a pull request out (PRD 82; moved
// here from PRD 72's retro `publish`, which now uses it). Shared by every function of the app that
// proposes files: the retro and the knowledge harvest.
//
// Through GitHub's Git Data API only: it never clones, never force-pushes, never merges, and never
// writes to the repository's default branch — `refuseDefault` throws before any request is made.
//
// - `branchHead`: the branch's head, the branch cut from `from` when it does not exist yet.
// - `addCommit`: one commit on top of `parent`, holding
//     `files`   [{ path, content }]  written as they are given
//     `moves`   [{ from, to }]      a file, or every file under a folder, moved by reusing its blob:
//                                    its content is never downloaded nor uploaded again
//     `deletes` [path]              files removed
//   then the branch moved to it, a fast-forward.
// - `pullsFrom` and `upsertPull`: the pull request from the branch, found again by its branch, its
//   title and body rewritten in place, opened only when none is open.
//
// Every call goes through the one Octokit seam the app's units use, `octokit.request(route, params)`.

import {
  GitCommitSchema,
  PullsSchema,
  PullWrittenSchema,
  RefSchema,
  ShaSchema,
  statusOf,
  TreeSchema,
  type GitHubClient,
  type PullListed,
} from '../outbox-check/github-schema.ts';
import type { Move } from 'vertuo-omni-plan/kit/lib/knowledge/pipeline.ts';

const FILE_MODE = '100644';

/** One entry of the tree a commit writes: a file's content, a blob reused by its sha, or a path removed. */
type TreeWrite = { path: string; mode: string; type: 'blob'; content?: string; sha?: string | null };

/** A file written as it is given. */
export type FileWrite = { path: string; content: string };

type Where = { owner: string; repo: string };

/** Thrown when a write would land on the default branch. */
export class DefaultBranchError extends Error {
  branch: string | undefined;

  constructor(branch: string | undefined) {
    super(`The branch \`${branch}\` is the default branch; refusing to write to it.`);
    this.name = 'DefaultBranchError';
    this.branch = branch;
  }
}

/** Throws `DefaultBranchError` when `branch` is the default branch. */
export function refuseDefault(branch: string | undefined, defaultBranch: string): void {
  if (!branch || branch === defaultBranch) throw new DefaultBranchError(branch);
}

/** The branch's head, cutting the branch from `from` when it does not exist. */
export async function branchHead(
  octokit: GitHubClient,
  { owner, repo, branch, from, defaultBranch }: Where & { branch: string; from: string; defaultBranch: string },
): Promise<string> {
  refuseDefault(branch, defaultBranch);
  const read = async () => {
    const { data } = await octokit.request('GET /repos/{owner}/{repo}/git/ref/{ref}', { owner, repo, ref: `heads/${branch}` });
    return RefSchema.parse(data).object.sha;
  };
  try {
    return await read();
  } catch (error) {
    if (statusOf(error) !== 404) throw error;
  }
  try {
    await octokit.request('POST /repos/{owner}/{repo}/git/refs', { owner, repo, ref: `refs/heads/${branch}`, sha: from });
    return from;
  } catch (error) {
    // Cut by an earlier attempt between the read and the write: read it again.
    if (statusOf(error) === 422) return read();
    throw error;
  }
}

/**
 * One commit on top of `parent` holding the files, the moves and the deletions, and the branch moved
 * to it without force.
 * @returns the new commit's sha
 */
export async function addCommit(
  octokit: GitHubClient,
  { owner, repo, branch, parent, message, defaultBranch, files = [], moves = [], deletes = [] }: Where & {
    branch: string;
    parent: string;
    message: string;
    defaultBranch: string;
    files?: FileWrite[];
    moves?: Move[];
    deletes?: string[];
  },
): Promise<string> {
  refuseDefault(branch, defaultBranch);
  const { data: parentAnswer } = await octokit.request('GET /repos/{owner}/{repo}/git/commits/{commit_sha}', {
    owner,
    repo,
    commit_sha: parent,
  });
  const baseTree = GitCommitSchema.parse(parentAnswer).tree.sha;
  const moved = moves.length > 0 ? await movedEntries(octokit, { owner, repo, tree: baseTree, moves }) : { added: [], removed: [] };

  const tree: TreeWrite[] = [
    ...files.map(({ path, content }): TreeWrite => ({ path, mode: FILE_MODE, type: 'blob', content })),
    ...moved.added,
    ...moved.removed,
    ...deletes.map((path): TreeWrite => ({ path, mode: FILE_MODE, type: 'blob', sha: null })),
  ];
  const { data: writtenAnswer } = await octokit.request('POST /repos/{owner}/{repo}/git/trees', { owner, repo, base_tree: baseTree, tree });
  const written = ShaSchema.parse(writtenAnswer);
  const { data: commitAnswer } = await octokit.request('POST /repos/{owner}/{repo}/git/commits', {
    owner,
    repo,
    message,
    tree: written.sha,
    parents: [parent],
  });
  const commit = ShaSchema.parse(commitAnswer);
  await octokit.request('PATCH /repos/{owner}/{repo}/git/refs/{ref}', {
    owner,
    repo,
    ref: `heads/${branch}`,
    sha: commit.sha,
    force: false,
  });
  return commit.sha;
}

/** The tree entries of the moves: each blob at its new path under its own sha, and its old path removed. */
async function movedEntries(
  octokit: GitHubClient,
  { owner, repo, tree, moves }: Where & { tree: string; moves: Move[] },
): Promise<{ added: TreeWrite[]; removed: TreeWrite[] }> {
  const { data: answer } = await octokit.request('GET /repos/{owner}/{repo}/git/trees/{tree_sha}', {
    owner,
    repo,
    tree_sha: tree,
    recursive: '1',
  });
  const data = TreeSchema.parse(answer);
  if (data.truncated) throw new Error('The tree is too large to read whole; refusing to move files in it.');
  const blobs = data.tree.filter((entry) => entry.type === 'blob');
  const added: TreeWrite[] = [];
  const removed: TreeWrite[] = [];
  for (const { from, to } of moves) {
    const exact = blobs.filter((entry) => entry.path === from);
    const under = exact.length > 0 ? exact : blobs.filter((entry) => entry.path.startsWith(`${from}/`));
    if (under.length === 0) throw new Error(`Nothing to move at \`${from}\`.`);
    for (const entry of under) {
      const path = entry.path === from ? to : `${to}${entry.path.slice(from.length)}`;
      added.push({ path, mode: entry.mode, type: 'blob', sha: entry.sha });
      removed.push({ path: entry.path, mode: entry.mode, type: 'blob', sha: null });
    }
  }
  return { added, removed };
}

/** Every PR from the branch into `base`, open or closed, newest first. */
export async function pullsFrom(
  octokit: GitHubClient,
  { owner, repo, branch, base }: Where & { branch: string; base: string },
): Promise<PullListed[]> {
  const { data } = await octokit.request('GET /repos/{owner}/{repo}/pulls', {
    owner,
    repo,
    head: `${owner}:${branch}`,
    base,
    state: 'all',
    per_page: 10,
    page: 1,
  });
  return [...PullsSchema.parse(data)].sort((a, b) => b.number - a.number);
}

/**
 * The open PR from the branch, its title and body rewritten; else the merged PR that already holds
 * the branch's `head`, left as it is; else a new one.
 */
export async function upsertPull(
  octokit: GitHubClient,
  { owner, repo, branch, base, head, title, body }: Where & { branch: string; base: string; head: string; title: string; body: string },
): Promise<{ number: number; url: string; created: boolean; open: boolean }> {
  const pulls = await pullsFrom(octokit, { owner, repo, branch, base });
  const open = pulls.find((pull) => pull.state === 'open');
  if (open) {
    const { data } = await octokit.request('PATCH /repos/{owner}/{repo}/pulls/{pull_number}', {
      owner,
      repo,
      pull_number: open.number,
      title,
      body,
    });
    const written = PullWrittenSchema.parse(data);
    return { number: written.number, url: written.html_url, created: false, open: true };
  }
  const merged = pulls.find((pull) => pull.merged_at && pull.head?.sha === head);
  if (merged) return { number: merged.number, url: merged.html_url, created: false, open: false };
  const { data } = await octokit.request('POST /repos/{owner}/{repo}/pulls', { owner, repo, head: branch, base, title, body });
  const opened = PullWrittenSchema.parse(data);
  return { number: opened.number, url: opened.html_url, created: true, open: true };
}
