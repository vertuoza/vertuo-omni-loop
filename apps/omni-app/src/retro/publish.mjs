// `publish`: the run record and the prose in, the retro branch, its files and the retro PR out (PRD 72,
// "The retro PR"). Through GitHub's Git Data API only: it never clones, never force-pushes, never
// writes to the default branch and never merges.
//
// Idempotent, so a replay or a retry after a half-done publish completes it rather than duplicating
// it: the branch (`branches.retro` with its topic) is cut from the merge SHA only when it does not
// exist; `retro.json` on the branch keeps every run, the record of the same feature PR and run
// replaced; a commit is added on top of the branch's head — a fast-forward — only when `retro.md` or
// `retro.json` changes; the PR is found again by its branch, its title and body rewritten in place,
// and opened only when none is open and the branch holds something its base does not. At most one
// retro PR per PRD is open at a time.
//
// The day-14 run (a record whose `run` is `day-14`) commits to that same branch while its PR is open.
// Once that PR is merged, or closed, it writes to `<branch>-day-14` instead, cut from the default
// branch's head, and opens a PR from there. The records of the runs before it (`earlier`) are written
// again beside its own, so its `retro.md` is the whole retro even when the first PR was never merged.
import { mergeRuns, render } from './render.mjs';
import { readContent } from './github.mjs';

/** The run that comes fourteen days after the merge, and the suffix of its own branch. */
const FOLLOW_UP_RUN = 'day-14';
export const FOLLOW_UP_SUFFIX = '-day-14';

/**
 * @param {{ request: Function }} octokit
 * @param {{ owner: string, repo: string, config: object, prd: object, pr: object, record: object,
 *   prose: object | null, earlier?: object[] }} input
 * @returns {Promise<{ branch: string, committed: boolean, commit: string, pr: { number: number, url: string, created: boolean } | null }>}
 */
export async function publishRetro(octokit, { owner, repo, config, prd, pr, record, prose, earlier = [] }) {
  const base = config.repo.defaultBranch;
  const { branch, from } = await branchFor(octokit, {
    owner,
    repo,
    base,
    first: config.branches.retro.replaceAll('{topic}', prd.topic),
    run: record.run,
    mergeSha: pr.mergeSha,
  });
  if (branch === base) throw new Error(`The retro branch \`${branch}\` is the default branch; refusing to write to it.`);

  const head = await branchHead(octokit, { owner, repo, branch, from });
  const paths = { markdown: `${prd.folder}/retro.md`, json: `${prd.folder}/retro.json` };

  const onBranch = {
    json: await readContent(octokit, { owner, repo, ref: branch, path: paths.json }),
    markdown: await readContent(octokit, { owner, repo, ref: branch, path: paths.markdown }),
  };
  const out = render({ doc: withRuns(onBranch.json, [...earlier, record]), featurePr: pr.number, prose });
  const unchanged = onBranch.markdown === out.markdown && onBranch.json === out.json;

  let commit = head;
  if (!unchanged) {
    commit = await addCommit(octokit, {
      owner,
      repo,
      branch,
      parent: head,
      message: `${out.title}\n\nThe ${record.run} run of #${pr.number}.`,
      files: [
        { path: paths.markdown, content: out.markdown },
        { path: paths.json, content: out.json },
      ],
    });
  }

  // A branch holding nothing beyond where it is cut from has nothing to propose.
  const found = commit === from ? null : await upsertPull(octokit, { owner, repo, branch, base, head: commit, title: out.title, body: out.prBody });
  if (found?.open) {
    await octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/labels', {
      owner,
      repo,
      issue_number: found.number,
      labels: [config.labels.retro],
    });
  }
  const retroPr = found && { number: found.number, url: found.url, created: found.created };
  return { branch, committed: !unchanged, commit, pr: retroPr };
}

/**
 * The branch a run writes to, and the commit it is cut from when it does not exist yet: the retro
 * branch, from the merge SHA; for the day-14 run once the retro branch's PR is merged or closed,
 * `<branch>-day-14`, from the default branch's head.
 */
async function branchFor(octokit, { owner, repo, base, first, run, mergeSha }) {
  if (run !== FOLLOW_UP_RUN) return { branch: first, from: mergeSha };
  const pulls = await pullsFrom(octokit, { owner, repo, branch: first, base });
  if (pulls.length === 0 || pulls.some((pull) => pull.state === 'open')) return { branch: first, from: mergeSha };
  const { data } = await octokit.request('GET /repos/{owner}/{repo}/git/ref/{ref}', { owner, repo, ref: `heads/${base}` });
  return { branch: `${first}${FOLLOW_UP_SUFFIX}`, from: data.object.sha };
}

/** `retro.json`'s content with each record in it, in order (`mergeRuns`). */
function withRuns(existing, records) {
  let text = existing;
  let doc = null;
  for (const record of records) {
    doc = mergeRuns(text, record);
    text = JSON.stringify(doc);
  }
  return doc;
}

/** The branch's head, cutting the branch from `from` when it does not exist. */
async function branchHead(octokit, { owner, repo, branch, from }) {
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

/** One commit on top of `parent` holding `files`, and the branch moved to it without force. */
async function addCommit(octokit, { owner, repo, branch, parent, message, files }) {
  const { data: parentCommit } = await octokit.request('GET /repos/{owner}/{repo}/git/commits/{commit_sha}', {
    owner,
    repo,
    commit_sha: parent,
  });
  const { data: tree } = await octokit.request('POST /repos/{owner}/{repo}/git/trees', {
    owner,
    repo,
    base_tree: parentCommit.tree.sha,
    tree: files.map(({ path, content }) => ({ path, mode: '100644', type: 'blob', content })),
  });
  const { data: commit } = await octokit.request('POST /repos/{owner}/{repo}/git/commits', {
    owner,
    repo,
    message,
    tree: tree.sha,
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

/** Every PR from the branch into `base`, open or closed, newest first. */
async function pullsFrom(octokit, { owner, repo, branch, base }) {
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
 */
async function upsertPull(octokit, { owner, repo, branch, base, head, title, body }) {
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
