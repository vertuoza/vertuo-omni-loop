// The GitHub reads and writes the `inbox-check` function needs beyond the outbox check's own
// (`readPull`, `readBaseConfig`) and `snapshot`: the inbox check run, started and failed closed with
// the inbox's `external_id`; the compare's changed paths and commits; and the PRD issue. Every call
// goes through `octokit.request(route, params)`, so a test stubs one function.
import { INBOX_EXTERNAL_ID } from '../inngest-client.mjs';

const PER_PAGE = 100;
/** Pages read at most: 3,000 entries, GitHub's own cap on a compare's files. */
const MAX_PAGES = 30;

/** Creates the inbox check run, `in_progress`, on the head SHA. @returns {Promise<number>} its id */
export async function startInboxCheck(octokit, { owner, repo, headSha, name }) {
  const { data } = await octokit.request('POST /repos/{owner}/{repo}/check-runs', {
    owner,
    repo,
    name,
    head_sha: headSha,
    external_id: INBOX_EXTERNAL_ID,
    status: 'in_progress',
    started_at: new Date().toISOString(),
  });
  return data.id;
}

/**
 * Adds the buttons to a completed check run (PRD 839: the canon gate's two actions). A PATCH with the
 * actions alone leaves its conclusion and output as they are.
 */
export async function addCheckActions(octokit, { owner, repo, checkRunId, actions }) {
  await octokit.request('PATCH /repos/{owner}/{repo}/check-runs/{check_run_id}', {
    owner,
    repo,
    check_run_id: checkRunId,
    actions,
  });
}

/**
 * The branch's changed paths and its commits, `base...head`, from GitHub's compare endpoint: the
 * paths in the `{ path, status }` shape the kit reads, the commits as `{ sha, message }`.
 */
export async function compareFacts(octokit, { owner, repo, baseSha, headSha }) {
  const changes = new Map();
  const commits = new Map();
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const { data } = await octokit.request('GET /repos/{owner}/{repo}/compare/{basehead}', {
      owner,
      repo,
      basehead: `${baseSha}...${headSha}`,
      per_page: PER_PAGE,
      page,
    });
    const files = data.files ?? [];
    const pageCommits = data.commits ?? [];
    for (const file of files) changes.set(file.filename, { path: file.filename, status: file.status });
    for (const commit of pageCommits) commits.set(commit.sha, { sha: commit.sha, message: commit.commit?.message ?? '' });
    if (files.length < PER_PAGE && pageCommits.length < PER_PAGE) break;
  }
  return { changes: [...changes.values()], commits: [...commits.values()] };
}

/**
 * Issue `number`: its state, its labels, and whether it is a pull request (GitHub serves both on the
 * issues route). `null` when there is none.
 */
export async function readIssue(octokit, { owner, repo, number }) {
  try {
    const { data } = await octokit.request('GET /repos/{owner}/{repo}/issues/{issue_number}', {
      owner,
      repo,
      issue_number: number,
    });
    return {
      number,
      state: data.state,
      labels: (data.labels ?? []).map((label) => (typeof label === 'string' ? label : label.name)),
      isPullRequest: Boolean(data.pull_request),
    };
  } catch (error) {
    if (error?.status === 404 || error?.status === 410) return null;
    throw error;
  }
}

/**
 * Fail closed: completes every inbox check run of this name on the head SHA that is not completed yet
 * as `failure`, the reason as its title. When there is none it creates one already completed, unless
 * `create` is false (the handler could not tell whether this is a phase-0 PR).
 * @returns {Promise<number[]>} the check run ids completed or created
 */
export async function completeInboxAsFailure(octokit, { owner, repo, headSha, name, reason, create = true }) {
  const title = `omni-loop could not evaluate: ${firstLine(reason)}`;
  const output = { title, summary: title };
  const completed_at = new Date().toISOString();

  const { data } = await octokit.request('GET /repos/{owner}/{repo}/commits/{ref}/check-runs', {
    owner,
    repo,
    ref: headSha,
    check_name: name,
    per_page: PER_PAGE,
  });
  const open = (data.check_runs ?? []).filter((run) => run.status !== 'completed');

  const ids = [];
  for (const run of open) {
    try {
      await octokit.request('PATCH /repos/{owner}/{repo}/check-runs/{check_run_id}', {
        owner,
        repo,
        check_run_id: run.id,
        status: 'completed',
        conclusion: 'failure',
        completed_at,
        output,
      });
      ids.push(run.id);
    } catch {
      // Not this app's check run; GitHub refuses the write.
    }
  }
  if (ids.length > 0 || !create) return ids;

  const { data: created } = await octokit.request('POST /repos/{owner}/{repo}/check-runs', {
    owner,
    repo,
    name,
    head_sha: headSha,
    external_id: INBOX_EXTERNAL_ID,
    status: 'completed',
    conclusion: 'failure',
    completed_at,
    output,
  });
  return [created.id];
}

function firstLine(reason) {
  const text = String(reason ?? 'unknown error').trim();
  return text.split('\n')[0] || 'unknown error';
}
