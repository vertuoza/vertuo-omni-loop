// `publish`: the run record and the prose in, the retro branch, its files and the retro PR out (PRD 72,
// "The retro PR"). Through GitHub's Git Data API only: it never clones, never force-pushes, never
// writes to the default branch and never merges.
//
// Idempotent, so a replay or a retry after a half-done publish completes it rather than duplicating
// it: the branch (`branches.retro` with its topic) is cut from the merge SHA only when it does not
// exist; `retro.json` on the branch keeps every run, the record of the same feature PR and run
// replaced; a commit is added on top of the branch's head — a fast-forward — only when `retro.md` or
// `retro.json` changes; the PR is found again by its branch, its title and body rewritten in place,
// and opened only when none is open. At most one retro PR per PRD is open at a time.
import { mergeRuns, render } from './render.mjs';
import { readContent } from './github.mjs';

/**
 * @param {{ request: Function }} octokit
 * @param {{ owner: string, repo: string, config: object, prd: object, pr: object, record: object, prose: object | null }} input
 * @returns {Promise<{ branch: string, committed: boolean, commit: string, pr: { number: number, url: string, created: boolean } | null }>}
 */
export async function publishRetro(octokit, { owner, repo, config, prd, pr, record, prose }) {
  const branch = config.branches.retro.replaceAll('{topic}', prd.topic);
  const base = config.repo.defaultBranch;
  if (branch === base) throw new Error(`The retro branch \`${branch}\` is the default branch; refusing to write to it.`);

  const head = await branchHead(octokit, { owner, repo, branch, from: pr.mergeSha });
  const paths = { markdown: `${prd.folder}/retro.md`, json: `${prd.folder}/retro.json` };

  const onBranch = {
    json: await readContent(octokit, { owner, repo, ref: branch, path: paths.json }),
    markdown: await readContent(octokit, { owner, repo, ref: branch, path: paths.markdown }),
  };
  const out = render({ doc: mergeRuns(onBranch.json, record), featurePr: pr.number, prose });
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

  const retroPr = commit === pr.mergeSha ? null : await upsertPull(octokit, { owner, repo, branch, base, title: out.title, body: out.prBody });
  if (retroPr) {
    await octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/labels', {
      owner,
      repo,
      issue_number: retroPr.number,
      labels: [config.labels.retro],
    });
  }
  return { branch, committed: !unchanged, commit, pr: retroPr };
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

/** The open PR from the branch, its title and body rewritten; or a new one when none is open. */
async function upsertPull(octokit, { owner, repo, branch, base, title, body }) {
  const { data: open } = await octokit.request('GET /repos/{owner}/{repo}/pulls', {
    owner,
    repo,
    head: `${owner}:${branch}`,
    base,
    state: 'open',
    per_page: 10,
    page: 1,
  });
  if (open.length > 0) {
    const { data } = await octokit.request('PATCH /repos/{owner}/{repo}/pulls/{pull_number}', {
      owner,
      repo,
      pull_number: open[0].number,
      title,
      body,
    });
    return { number: data.number, url: data.html_url, created: false };
  }
  const { data } = await octokit.request('POST /repos/{owner}/{repo}/pulls', { owner, repo, head: branch, base, title, body });
  return { number: data.number, url: data.html_url, created: true };
}
