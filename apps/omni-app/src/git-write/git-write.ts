// @ts-nocheck
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

const FILE_MODE = '100644';

/** Thrown when a write would land on the default branch. */
export class DefaultBranchError extends Error {
  constructor(branch) {
    super(`The branch \`${branch}\` is the default branch; refusing to write to it.`);
    this.name = 'DefaultBranchError';
    this.branch = branch;
  }
}

/** Throws `DefaultBranchError` when `branch` is the default branch. */
export function refuseDefault(branch, defaultBranch) {
  if (!branch || branch === defaultBranch) throw new DefaultBranchError(branch);
}

/**
 * The branch's head, cutting the branch from `from` when it does not exist.
 * @param {{ request: Function }} octokit
 * @param {{ owner: string, repo: string, branch: string, from: string, defaultBranch: string }} input
 * @returns {Promise<string>}
 */
export async function branchHead(octokit, { owner, repo, branch, from, defaultBranch }) {
  refuseDefault(branch, defaultBranch);
  const read = async () => {
    const { data } = await octokit.request('GET /repos/{owner}/{repo}/git/ref/{ref}', { owner, repo, ref: `heads/${branch}` });
    return data.object.sha;
  };
  try {
    return await read();
  } catch (error) {
    if (error?.status !== 404) throw error;
  }
  try {
    await octokit.request('POST /repos/{owner}/{repo}/git/refs', { owner, repo, ref: `refs/heads/${branch}`, sha: from });
    return from;
  } catch (error) {
    // Cut by an earlier attempt between the read and the write: read it again.
    if (error?.status === 422) return read();
    throw error;
  }
}

/**
 * One commit on top of `parent` holding the files, the moves and the deletions, and the branch moved
 * to it without force.
 * @param {{ request: Function }} octokit
 * @param {{ owner: string, repo: string, branch: string, parent: string, message: string, defaultBranch: string,
 *   files?: { path: string, content: string }[], moves?: { from: string, to: string }[], deletes?: string[] }} input
 * @returns {Promise<string>} the new commit's sha
 */
export async function addCommit(octokit, { owner, repo, branch, parent, message, defaultBranch, files = [], moves = [], deletes = [] }) {
  refuseDefault(branch, defaultBranch);
  const { data: parentCommit } = await octokit.request('GET /repos/{owner}/{repo}/git/commits/{commit_sha}', {
    owner,
    repo,
    commit_sha: parent,
  });
  const baseTree = parentCommit.tree.sha;
  const moved = moves.length > 0 ? await movedEntries(octokit, { owner, repo, tree: baseTree, moves }) : { added: [], removed: [] };

  const tree = [
    ...files.map(({ path, content }) => ({ path, mode: FILE_MODE, type: 'blob', content })),
    ...moved.added,
    ...moved.removed,
    ...deletes.map((path) => ({ path, mode: FILE_MODE, type: 'blob', sha: null })),
  ];
  const { data: written } = await octokit.request('POST /repos/{owner}/{repo}/git/trees', { owner, repo, base_tree: baseTree, tree });
  const { data: commit } = await octokit.request('POST /repos/{owner}/{repo}/git/commits', {
    owner,
    repo,
    message,
    tree: written.sha,
    parents: [parent],
  });
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
async function movedEntries(octokit, { owner, repo, tree, moves }) {
  const { data } = await octokit.request('GET /repos/{owner}/{repo}/git/trees/{tree_sha}', {
    owner,
    repo,
    tree_sha: tree,
    recursive: '1',
  });
  if (data.truncated) throw new Error('The tree is too large to read whole; refusing to move files in it.');
  const blobs = data.tree.filter((entry) => entry.type === 'blob');
  const added = [];
  const removed = [];
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
export async function pullsFrom(octokit, { owner, repo, branch, base }) {
  const { data } = await octokit.request('GET /repos/{owner}/{repo}/pulls', {
    owner,
    repo,
    head: `${owner}:${branch}`,
    base,
    state: 'all',
    per_page: 10,
    page: 1,
  });
  return [...data].sort((a, b) => b.number - a.number);
}

/**
 * The open PR from the branch, its title and body rewritten; else the merged PR that already holds
 * the branch's `head`, left as it is; else a new one.
 * @returns {Promise<{ number: number, url: string, created: boolean, open: boolean }>}
 */
export async function upsertPull(octokit, { owner, repo, branch, base, head, title, body }) {
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
    return { number: data.number, url: data.html_url, created: false, open: true };
  }
  const merged = pulls.find((pull) => pull.merged_at && pull.head?.sha === head);
  if (merged) return { number: merged.number, url: merged.html_url, created: false, open: false };
  const { data } = await octokit.request('POST /repos/{owner}/{repo}/pulls', { owner, repo, head: branch, base, title, body });
  return { number: data.number, url: data.html_url, created: true, open: true };
}
