// The GitHub reads and writes the `inbox-check` function needs beyond the outbox check's own
// (`readPull`, `readBaseConfig`) and `snapshot`: the inbox check run, started and failed closed with
// the inbox's `external_id`; the compare's changed paths and commits; and the PRD issue. Every call
// goes through `octokit.request(route, params)`, so a test stubs one function.
import type { IssueNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { INBOX_EXTERNAL_ID } from '../inngest-client.ts';
import { completeAsFailure } from '../outbox-check/github.ts';
import {
  ComparePageSchema,
  CreatedSchema,
  IssueSchema,
  labelName,
  statusOf,
  type GitHubClient,
  type Repo,
} from '../outbox-check/github-schema.ts';

const PER_PAGE = 100;
/** Pages read at most: 3,000 entries, GitHub's own cap on a compare's files. */
const MAX_PAGES = 30;

/** The PRD issue's facts; `null`: GitHub has no issue of that number. */
export type IssueFacts = { number: IssueNumber; state: string; labels: string[]; isPullRequest: boolean } | null;

/** A changed path, its status as GitHub's compare names it. */
export type ComparedChange = { path: string; status: string };

/** A commit of the branch. */
export type Commit = { sha: string; message: string };

/** A check run's button (PRD 839). */
export type CheckAction = { label: string; description: string; identifier: string };

/** Creates the inbox check run, `in_progress`, on the head SHA. @returns its id */
export async function startInboxCheck(
  octokit: GitHubClient,
  { owner, repo, headSha, name }: Repo & { headSha: string; name: string },
): Promise<number> {
  const { data } = await octokit.request('POST /repos/{owner}/{repo}/check-runs', {
    owner,
    repo,
    name,
    head_sha: headSha,
    external_id: INBOX_EXTERNAL_ID,
    status: 'in_progress',
    started_at: new Date().toISOString(),
  });
  return CreatedSchema.parse(data).id;
}

/**
 * The branch's changed paths and its commits, `base...head`, from GitHub's compare endpoint: the
 * paths in the `{ path, status }` shape the kit reads, the commits as `{ sha, message }`.
 */
export async function compareFacts(
  octokit: GitHubClient,
  { owner, repo, baseSha, headSha }: Repo & { baseSha: string; headSha: string },
): Promise<{ changes: ComparedChange[]; commits: Commit[] }> {
  const changes = new Map<string, ComparedChange>();
  const commits = new Map<string, Commit>();
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const { data: answer } = await octokit.request('GET /repos/{owner}/{repo}/compare/{basehead}', {
      owner,
      repo,
      basehead: `${baseSha}...${headSha}`,
      per_page: PER_PAGE,
      page,
    });
    const data = ComparePageSchema.parse(answer);
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
export async function readIssue(octokit: GitHubClient, { owner, repo, number }: Repo & { number: IssueNumber }): Promise<IssueFacts> {
  let answer: unknown;
  try {
    ({ data: answer } = await octokit.request('GET /repos/{owner}/{repo}/issues/{issue_number}', {
      owner,
      repo,
      issue_number: number,
    }));
  } catch (error) {
    const status = statusOf(error);
    if (status === 404 || status === 410) return null;
    throw error;
  }
  const data = IssueSchema.parse(answer);
  return {
    number,
    state: data.state,
    labels: (data.labels ?? []).map(labelName).filter((name) => name !== undefined),
    isPullRequest: Boolean(data.pull_request),
  };
}

/**
 * Fail closed: completes every inbox check run of this name on the head SHA that is not completed yet
 * as `failure`, the reason as its title. When there is none it creates one already completed, unless
 * `create` is false (the handler could not tell whether this is a phase-0 PR).
 * @returns the check run ids completed or created
 */
export function completeInboxAsFailure(
  octokit: GitHubClient,
  { owner, repo, headSha, name, reason, create = true }: Repo & { headSha: string; name: string; reason: unknown; create?: boolean },
): Promise<number[]> {
  return completeAsFailure(octokit, { owner, repo, headSha, name, reason, create, externalId: INBOX_EXTERNAL_ID });
}

/**
 * Adds the buttons to a completed check run (PRD 839: the canon gate's two actions). A PATCH with the
 * actions alone leaves its conclusion and output as they are.
 */
export async function addCheckActions(
  octokit: GitHubClient,
  { owner, repo, checkRunId, actions }: Repo & { checkRunId: number; actions: CheckAction[] },
): Promise<void> {
  await octokit.request('PATCH /repos/{owner}/{repo}/check-runs/{check_run_id}', {
    owner,
    repo,
    check_run_id: checkRunId,
    actions,
  });
}
