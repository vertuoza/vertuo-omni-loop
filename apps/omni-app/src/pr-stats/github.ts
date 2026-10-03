// The collector's GitHub reads (PRD 612), through GitHub's GraphQL API only: `octokit.graphql(query,
// variables)`, so a test stubs one function.
//
// Not REST (bug 638): the REST core budget of an installation is the one the outbox check, the retro,
// the knowledge harvest and the verdict comment spend, and three REST calls per pull request through a
// 90-day backfill spent all of it. GraphQL has a budget of its own, and one query reads a whole batch.
//
// Every query asks for `rateLimit`, and none is sent unless the budget would still hold more than half
// of its limit after it (`BudgetLow` otherwise): the collector never drives a budget below half.
//
// Each pull request's label events come in the same query (PRD 714 s4): `needs_fix_at` is when
// `omni:needs-fix` was first added, whatever was removed or added after.
//
// The loop's status comment (PRD 714 s3) is read in a second, small query, and only for the pull
// requests of a batch where a status can hold a run: open, Omni-man-signed and into `main`, `master` or
// `develop`. A batch with none sends no second query.
import { parseConfig } from 'vertuo-omni-plan/kit/lib/config.ts';
import { makeMarkers } from 'vertuo-omni-plan/kit/lib/markers.ts';
import type { z } from 'zod';
import type { Database } from '../../../../supabase/database.types.ts';
import { type Actor, type BudgetSchema, parseAnswer, type PullDetail, PullCommentsSchema, PullDetailSchema, PullDetailsSchema, PullsUpdatedSchema, RateLimited } from './schema.ts';
import { isBot, isOmniSigned } from './signed.ts';

/** The one seam of GitHub the collector reads through: a GraphQL query and its variables. */
export type GraphqlOctokit = { graphql: (query: string, variables?: Record<string, unknown>) => Promise<unknown> };

/** An installation's budget as `rateLimit` last answered it; `{}` until its first query. */
export type Budget = z.infer<typeof BudgetSchema>;

type Tables = Database['public']['Tables'];
/** A `pull_requests` row, as the collector writes it. */
export type PullRow = Omit<Tables['pull_requests']['Row'], 'status_state'> & { status_state?: string | null };
/** A `pull_request_reviews` row. */
export type ReviewRow = Tables['pull_request_reviews']['Insert'];
/** A pull request as the collector stores it: its row and its reviewers' rows. */
export type PullRecord = { row: PullRow; reviews: ReviewRow[] };
/** A pull request listed by its last update. */
export type ListedPull = { number: number; updatedAt: string };

/** Pull requests listed per page. */
const PER_PAGE = 100;
/** Pages of pull requests listed at most per read: 5,000 of them. */
const MAX_LIST_PAGES = 50;
/** Commit messages read per pull request, the latest ones, for the Omni-man trailer. */
const COMMITS_READ = 100;
/** Labels read per pull request, the first ones. */
const LABELS_READ = 100;
/** Reviews read per pull request, the first ones. */
const REVIEWS_READ = 100;
/** Label events read per pull request, the first ones, for when `omni:needs-fix` was first added (PRD 714 s4). */
const LABEL_EVENTS_READ = 100;
/** The label a stuck pull request carries, the kit's default: `omni:needs-fix`. */
const NEEDS_FIX_LABEL = parseConfig('kit: 1\n').labels.needsFix;
/** Comments read per pull request for its status comment, the first ones: `/omni:pr` posts it early. */
const COMMENTS_READ = 100;
/** The branches a status comment is read on (PRD 714): the Engineering board's fixed set. */
const MAIN_BRANCHES = ['main', 'master', 'develop'];
/** The marker of the loop's status comment, with the kit's default prefix: `<!-- omni-outbox-status -->`. */
const STATUS_MARKER = makeMarkers(parseConfig('kit: 1\n').markers.prefix).status;
/** The share of a budget the collector always leaves. */
const BUDGET_FLOOR = 0.5;
/** The most points one of the collector's queries can cost; a query is sent only with this much above the floor. */
const QUERY_COST_MARGIN = 10;

const RATE_LIMIT = 'rateLimit { limit remaining resetAt }';

/** Thrown before a query that could take the budget under `BUDGET_FLOOR` of its limit. */
export class BudgetLow extends Error {
  constructor(budget: Budget) {
    super(`GitHub budget low: ${budget.remaining} of ${budget.limit} left, until ${budget.resetAt ?? 'the reset'}`);
    this.name = 'BudgetLow';
  }
}

/**
 * Whether a budget, as `rateLimit` last answered it, still affords one more query above the floor. A
 * budget not known yet (`{}`) does: its first query reads it.
 */
export function affords(budget: Budget): boolean {
  if (budget.limit === undefined) return true;
  return Number(budget.remaining) - QUERY_COST_MARGIN >= budget.limit * BUDGET_FLOOR;
}

/**
 * One query, sent only when `budget` affords it; `budget` is updated in place from its `rateLimit`.
 * A `budget` of `{}` is not known yet: it is read first, with a query that asks for nothing else.
 */
async function ask(octokit: GraphqlOctokit, budget: Budget, query: string, variables: Record<string, unknown>): Promise<unknown> {
  if (budget.limit === undefined) {
    const answer = parseAnswer(RateLimited, await octokit.graphql(`query Budget { ${RATE_LIMIT} }`), 'Budget');
    Object.assign(budget, answer?.rateLimit);
  }
  if (!affords(budget)) throw new BudgetLow(budget);
  const data = await octokit.graphql(query, variables);
  const answer = parseAnswer(RateLimited, data, operationOf(query));
  if (answer?.rateLimit) Object.assign(budget, answer.rateLimit);
  return data;
}

/** A query's operation name, as its errors name it. */
function operationOf(query: string): string {
  return /query\s+(\w+)/.exec(query)?.[1] ?? 'a query';
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
export async function pullsUpdatedAfter(
  octokit: GraphqlOctokit,
  budget: Budget,
  { owner, repo, since }: { owner: string | undefined; repo: string | undefined; since: string },
): Promise<ListedPull[]> {
  const after = Date.parse(since);
  const out: ListedPull[] = [];
  let cursor: string | null | undefined = null;
  for (let page = 1; page <= MAX_LIST_PAGES; page += 1) {
    const answer = await ask(octokit, budget, LIST, { owner, repo, first: PER_PAGE, after: cursor });
    const data = parseAnswer(PullsUpdatedSchema, answer, 'PullsUpdated');
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
  baseRefName headRefName isDraft body additions deletions
  labels(first: ${LABELS_READ}) { nodes { name } }
  commits(last: ${COMMITS_READ}) { totalCount nodes { commit { message committedDate } } }
  reviews(first: ${REVIEWS_READ}) { nodes { author { login __typename } submittedAt } }
  timelineItems(first: ${LABEL_EVENTS_READ}, itemTypes: [LABELED_EVENT]) { nodes { ... on LabeledEvent { createdAt label { name } } } }`;

/**
 * Several pull requests as the collector stores them, in one query: for each, its `pull_requests` row
 * and its `pull_request_reviews` rows — submitted reviews of any state, once per reviewer, dated at
 * the first, never by its author. In the order of `numbers`; a number GitHub does not know is left out.
 */
export async function readPullRecords(
  octokit: GraphqlOctokit,
  budget: Budget,
  { workspaceId, fullName, numbers }: { workspaceId: string; fullName: string; numbers: number[] },
): Promise<PullRecord[]> {
  if (numbers.length === 0) return [];
  const [owner, repo] = fullName.split('/');
  const pulls = numbers.map((number) => `p${number}: pullRequest(number: ${number}) { ${PULL_FIELDS} }`).join('\n    ');
  const query = `query PullDetails($owner: String!, $repo: String!) {
  ${RATE_LIMIT}
  repository(owner: $owner, name: $repo) {
    ${pulls}
  }
}`;
  const data = parseAnswer(PullDetailsSchema, await ask(octokit, budget, query, { owner, repo }), 'PullDetails');
  const records = numbers.flatMap((number) => {
    const pull = data.repository[`p${number}`];
    return pull ? [recordOf(parseAnswer(PullDetailSchema, pull, `PullDetails, pull request ${number}`), { workspaceId, fullName })] : [];
  });
  const held = records.filter(({ row }) => canHoldRun(row)).map(({ row }) => row.number);
  const states = await readStatusStates(octokit, budget, { owner, repo, numbers: held });
  for (const { row } of records) row.status_state = states.get(row.number) ?? null;
  return records;
}

/** Whether a pull request's status comment can hold a run: open, signed, into a main branch (PRD 714). */
function canHoldRun(row: PullRow): boolean {
  return !row.merged_at && !row.closed_at && row.omni_signed && MAIN_BRANCHES.includes(row.base ?? '');
}

/**
 * The `state:` of each pull request's status comment, the first comment carrying `STATUS_MARKER`, in
 * one query; a pull request with no such comment is left out. No query for no pull request.
 * @returns {Promise<Map<number, string>>}
 */
async function readStatusStates(
  octokit: GraphqlOctokit,
  budget: Budget,
  { owner, repo, numbers }: { owner: string | undefined; repo: string | undefined; numbers: number[] },
): Promise<Map<number, string>> {
  const states = new Map<number, string>();
  if (numbers.length === 0) return states;
  const pulls = numbers.map((number) => `p${number}: pullRequest(number: ${number}) { comments(first: ${COMMENTS_READ}) { nodes { body } } }`).join('\n    ');
  const query = `query PullStatus($owner: String!, $repo: String!) {
  ${RATE_LIMIT}
  repository(owner: $owner, name: $repo) {
    ${pulls}
  }
}`;
  const data = parseAnswer(PullDetailsSchema, await ask(octokit, budget, query, { owner, repo }), 'PullStatus');
  for (const number of numbers) {
    const pull = parseAnswer(PullCommentsSchema, data.repository[`p${number}`], `PullStatus, pull request ${number}`);
    const comment = pull?.comments?.nodes?.find((node) => node?.body?.includes(STATUS_MARKER));
    const state = comment?.body ? stateOf(comment.body) : null;
    if (state) states.set(number, state);
  }
  return states;
}

/** The value of a status comment's `- state: <value>` line, or null without one. */
function stateOf(body: string): string | null {
  return /^\s*-?\s*state:\s*(.+?)\s*$/m.exec(body)?.[1] ?? null;
}

/**
 * GraphQL names an app by its bare login (`omni-loop-invader`), REST as `omni-loop-invader[bot]`; the
 * rows keep REST's, the name the rest of the product uses.
 */
function loginOf(actor: Actor): string | null {
  if (!actor?.login) return null;
  return actor.__typename === 'Bot' && !actor.login.endsWith('[bot]') ? `${actor.login}[bot]` : actor.login;
}

function recordOf(pull: PullDetail, { workspaceId, fullName }: { workspaceId: string; fullName: string }): PullRecord {
  const author = loginOf(pull.author);
  const commits = pull.commits ?? { totalCount: 0, nodes: [] };
  const row: PullRow = {
    workspace_id: workspaceId,
    repo: fullName,
    number: pull.number,
    author,
    author_is_bot: Boolean(pull.author) && isBot({ login: author, type: pull.author?.__typename }),
    opened_at: pull.createdAt,
    ...closing(pull),
    ...loopFacts(pull, commits),
    commits: commits.totalCount,
    additions: pull.additions ?? 0,
    deletions: pull.deletions ?? 0,
    omni_signed: isOmniSigned({ author, body: pull.body, commitMessages: commits.nodes.map((node) => node.commit?.message) }),
  };
  return { row, reviews: firstReviews(pull, author).map(([reviewer, firstAt]) => ({ workspace_id: workspaceId, repo: fullName, number: pull.number, reviewer, first_at: firstAt })) };
}

/** What Loop health reads of a pull request: its branches, draft, labels, last commit and first `omni:needs-fix`. */
function loopFacts(pull: PullDetail, commits: NonNullable<PullDetail['commits']>) {
  return {
    base: pull.baseRefName ?? null,
    head: pull.headRefName ?? null,
    draft: Boolean(pull.isDraft),
    labels: (pull.labels?.nodes ?? []).map((label) => label?.name).filter((name): name is string => Boolean(name)),
    head_committed_at: commits.nodes.at(-1)?.commit?.committedDate ?? null,
    needs_fix_at: firstNeedsFix(pull),
  };
}

/** When `omni:needs-fix` was first added to a pull request, of its label events; null when never. */
function firstNeedsFix(pull: PullDetail): string | null {
  let first: string | null = null;
  for (const event of pull.timelineItems?.nodes ?? []) {
    if (event?.label?.name !== NEEDS_FIX_LABEL || !event.createdAt) continue;
    if (!first || Date.parse(event.createdAt) < Date.parse(first)) first = event.createdAt;
  }
  return first;
}

/** When and by whom a pull request was merged or closed. */
function closing(pull: PullDetail) {
  return { merged_at: pull.mergedAt ?? null, closed_at: pull.closedAt ?? null, merged_by: loginOf(pull.mergedBy) };
}

/** `[reviewer, first submitted]` of every submitted review, once per reviewer, never by `author`, by reviewer. */
function firstReviews(pull: PullDetail, author: string | null): [string, string][] {
  const first = new Map<string, string>();
  for (const review of pull.reviews?.nodes ?? []) {
    const reviewer = loginOf(review.author);
    if (!reviewer || !review.submittedAt || reviewer === author) continue;
    const at = first.get(reviewer);
    if (!at || Date.parse(review.submittedAt) < Date.parse(at)) first.set(reviewer, review.submittedAt);
  }
  return [...first].sort(([a], [b]) => a.localeCompare(b));
}
