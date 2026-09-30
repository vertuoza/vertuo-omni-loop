// The collector's GitHub reads (PRD 612), through GitHub's GraphQL API only: `octokit.graphql(query,
// variables)`, so a test stubs one function.
//
// Not REST (bug 638): the REST core budget of an installation is the one the outbox check, the retro,
// the knowledge harvest and the verdict comment spend, and three REST calls per pull request through a
// 90-day backfill spent all of it. GraphQL has a budget of its own, and one query reads a whole batch.
//
// Every query asks for `rateLimit`, and none is sent unless the budget would still hold more than half
// of its limit after it (`BudgetLow` otherwise): the collector never drives a budget below half.
import { isBot, isOmniSigned } from './signed.mjs';

/** Pull requests listed per page. */
const PER_PAGE = 100;
/** Pages of pull requests listed at most per read: 5,000 of them. */
const MAX_LIST_PAGES = 50;
/** Commit messages read per pull request, the latest ones, for the Omni-man trailer. */
const COMMITS_READ = 100;
/** Reviews read per pull request, the first ones. */
const REVIEWS_READ = 100;
/** The share of a budget the collector always leaves. */
const BUDGET_FLOOR = 0.5;
/** The most points one of the collector's queries can cost; a query is sent only with this much above the floor. */
const QUERY_COST_MARGIN = 10;

const RATE_LIMIT = 'rateLimit { limit remaining resetAt }';

/** Thrown before a query that could take the budget under `BUDGET_FLOOR` of its limit. */
export class BudgetLow extends Error {
  constructor(budget) {
    super(`GitHub budget low: ${budget.remaining} of ${budget.limit} left, until ${budget.resetAt ?? 'the reset'}`);
    this.name = 'BudgetLow';
  }
}

/**
 * Whether a budget, as `rateLimit` last answered it, still affords one more query above the floor. A
 * budget not known yet (`{}`) does: its first query reads it.
 */
export function affords(budget) {
  if (budget.limit === undefined) return true;
  return budget.remaining - QUERY_COST_MARGIN >= budget.limit * BUDGET_FLOOR;
}

/**
 * One query, sent only when `budget` affords it; `budget` is updated in place from its `rateLimit`.
 * A `budget` of `{}` is not known yet: it is read first, with a query that asks for nothing else.
 */
async function ask(octokit, budget, query, variables) {
  if (budget.limit === undefined) {
    const { rateLimit } = await octokit.graphql(`query Budget { ${RATE_LIMIT} }`);
    Object.assign(budget, rateLimit);
  }
  if (!affords(budget)) throw new BudgetLow(budget);
  const data = await octokit.graphql(query, variables);
  if (data?.rateLimit) Object.assign(budget, data.rateLimit);
  return data;
}

const LIST = `query PullsUpdated($owner: String!, $repo: String!, $first: Int!, $after: String) {
  ${RATE_LIMIT}
  repository(owner: $owner, name: $repo) {
    pullRequests(first: $first, after: $after, orderBy: { field: UPDATED_AT, direction: DESC }) {
      pageInfo { hasNextPage endCursor }
      nodes { number updatedAt }
    }
  }
}`;

/**
 * The pull requests of `owner/repo` updated strictly after `since`, oldest update first, as
 * `{ number, updatedAt }`. GitHub lists them newest update first; the read stops at the first one
 * not after `since`.
 */
export async function pullsUpdatedAfter(octokit, budget, { owner, repo, since }) {
  const after = Date.parse(since);
  const out = [];
  let cursor = null;
  for (let page = 1; page <= MAX_LIST_PAGES; page += 1) {
    const data = await ask(octokit, budget, LIST, { owner, repo, first: PER_PAGE, after: cursor });
    const { nodes, pageInfo } = data.repository.pullRequests;
    for (const pull of nodes) {
      if (Date.parse(pull.updatedAt) <= after) return out.reverse();
      out.push({ number: pull.number, updatedAt: pull.updatedAt });
    }
    if (!pageInfo.hasNextPage) break;
    cursor = pageInfo.endCursor;
  }
  return out.reverse();
}

const PULL_FIELDS = `number
  author { login __typename }
  createdAt mergedAt closedAt
  mergedBy { login __typename }
  baseRefName headRefName body additions deletions
  commits(last: ${COMMITS_READ}) { totalCount nodes { commit { message } } }
  reviews(first: ${REVIEWS_READ}) { nodes { author { login __typename } submittedAt } }`;

/**
 * Several pull requests as the collector stores them, in one query: for each, its `pull_requests` row
 * and its `pull_request_reviews` rows — submitted reviews of any state, once per reviewer, dated at
 * the first, never by its author. In the order of `numbers`; a number GitHub does not know is left out.
 */
export async function readPullRecords(octokit, budget, { workspaceId, fullName, numbers }) {
  if (numbers.length === 0) return [];
  const [owner, repo] = fullName.split('/');
  const pulls = numbers.map((number) => `p${number}: pullRequest(number: ${Number(number)}) { ${PULL_FIELDS} }`).join('\n    ');
  const query = `query PullDetails($owner: String!, $repo: String!) {
  ${RATE_LIMIT}
  repository(owner: $owner, name: $repo) {
    ${pulls}
  }
}`;
  const data = await ask(octokit, budget, query, { owner, repo });
  return numbers.map((number) => data.repository[`p${number}`]).filter(Boolean).map((pull) => recordOf(pull, { workspaceId, fullName }));
}

/**
 * GraphQL names an app by its bare login (`omni-loop-invader`), REST as `omni-loop-invader[bot]`; the
 * rows keep REST's, the name the rest of the product uses.
 */
function loginOf(actor) {
  if (!actor?.login) return null;
  return actor.__typename === 'Bot' && !actor.login.endsWith('[bot]') ? `${actor.login}[bot]` : actor.login;
}

function recordOf(pull, { workspaceId, fullName }) {
  const author = loginOf(pull.author);
  const commits = pull.commits ?? { totalCount: 0, nodes: [] };
  const row = {
    workspace_id: workspaceId,
    repo: fullName,
    number: pull.number,
    author,
    author_is_bot: Boolean(pull.author) && isBot({ login: author, type: pull.author.__typename }),
    opened_at: pull.createdAt,
    ...closing(pull),
    base: pull.baseRefName ?? null,
    head: pull.headRefName ?? null,
    commits: commits.totalCount,
    additions: pull.additions ?? 0,
    deletions: pull.deletions ?? 0,
    omni_signed: isOmniSigned({ author, body: pull.body, commitMessages: commits.nodes.map((node) => node.commit?.message) }),
  };
  return { row, reviews: firstReviews(pull, author).map(([reviewer, firstAt]) => ({ workspace_id: workspaceId, repo: fullName, number: pull.number, reviewer, first_at: firstAt })) };
}

/** When and by whom a pull request was merged or closed. */
function closing(pull) {
  return { merged_at: pull.mergedAt ?? null, closed_at: pull.closedAt ?? null, merged_by: loginOf(pull.mergedBy) };
}

/** `[reviewer, first submitted]` of every submitted review, once per reviewer, never by `author`, by reviewer. */
function firstReviews(pull, author) {
  const first = new Map();
  for (const review of pull.reviews?.nodes ?? []) {
    const reviewer = loginOf(review.author);
    if (!reviewer || !review.submittedAt || reviewer === author) continue;
    const at = first.get(reviewer);
    if (!at || Date.parse(review.submittedAt) < Date.parse(at)) first.set(reviewer, review.submittedAt);
  }
  return [...first].sort(([a], [b]) => a.localeCompare(b));
}
