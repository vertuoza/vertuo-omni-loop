// The collector's GitHub reads (PRD 612), through the one Octokit seam the app's other units use,
// `octokit.request(route, params)`, so a test stubs one function.
import { isBot, isOmniSigned } from './signed.mjs';

export const PER_PAGE = 100;
/** Pages of pull requests listed at most per read: 5,000 of them. */
export const MAX_LIST_PAGES = 50;
/** Pages of one pull request's reviews or commits read at most (GitHub lists 250 commits at most). */
const MAX_PAGES = 5;

/**
 * The pull requests of `owner/repo` updated strictly after `since`, oldest update first, as
 * `{ number, updatedAt }`. GitHub lists them newest update first; the read stops at the first one
 * not after `since`.
 */
export async function pullsUpdatedAfter(octokit, { owner, repo, since }) {
  const after = Date.parse(since);
  const out = [];
  for (let page = 1; page <= MAX_LIST_PAGES; page += 1) {
    const { data } = await octokit.request('GET /repos/{owner}/{repo}/pulls', {
      owner,
      repo,
      state: 'all',
      sort: 'updated',
      direction: 'desc',
      per_page: PER_PAGE,
      page,
    });
    for (const pull of data) {
      if (Date.parse(pull.updated_at) <= after) return out.reverse();
      out.push({ number: pull.number, updatedAt: pull.updated_at });
    }
    if (data.length < PER_PAGE) break;
  }
  return out.reverse();
}

async function every(octokit, route, params) {
  const all = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const { data } = await octokit.request(route, { ...params, per_page: PER_PAGE, page });
    all.push(...data);
    if (data.length < PER_PAGE) break;
  }
  return all;
}

/**
 * One pull request as the collector stores it: its `pull_requests` row and its
 * `pull_request_reviews` rows — submitted reviews of any state, once per reviewer, dated at the
 * first, never by its author.
 */
export async function readPullRecord(octokit, { workspaceId, fullName, number }) {
  const [owner, repo] = fullName.split('/');
  const params = { owner, repo, pull_number: number };
  const { data } = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', params);
  const reviews = await every(octokit, 'GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews', params);
  const commits = await every(octokit, 'GET /repos/{owner}/{repo}/pulls/{pull_number}/commits', params);

  const author = data.user?.login ?? null;
  const row = {
    workspace_id: workspaceId,
    repo: fullName,
    number: data.number,
    author,
    author_is_bot: isBot(data.user),
    opened_at: data.created_at,
    merged_at: data.merged_at ?? null,
    closed_at: data.closed_at ?? null,
    merged_by: data.merged_by?.login ?? null,
    base: data.base?.ref ?? null,
    commits: data.commits ?? 0,
    additions: data.additions ?? 0,
    deletions: data.deletions ?? 0,
    omni_signed: isOmniSigned({ author, body: data.body, commitMessages: commits.map((commit) => commit.commit?.message) }),
  };

  const first = new Map();
  for (const review of reviews) {
    const reviewer = review.user?.login;
    if (!reviewer || !review.submitted_at || reviewer === author) continue;
    const at = first.get(reviewer);
    if (!at || Date.parse(review.submitted_at) < Date.parse(at)) first.set(reviewer, review.submitted_at);
  }
  const reviewRows = [...first]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([reviewer, firstAt]) => ({ workspace_id: workspaceId, repo: fullName, number: data.number, reviewer, first_at: firstAt }));

  return { row, reviews: reviewRows };
}
