// The loop's code host when it is GitHub (PRD 1665, s1 and s2): the one file of the loop's reads that
// knows GitHub. It reads a repository as the Omni Loop App, by REST but for two facts REST does not hold: it finds the App's installation on
// the repository, creates an installation token and keeps it in server memory until a minute before it
// expires, and sends every call through the shared, budget-aware client (`@omni/github`, PRD 902), so a
// repeated read goes out with its stored ETag and an unchanged answer (a 304) spends nothing of the
// budget. Reads are `interactive`: a person, or their agent, waits on the answer. The two GraphQL reads,
// sent through the same client, which spends GraphQL's own budget for them and stores nothing, are a
// change's review threads (whether a thread is resolved, and the thread's id a reply names, exist in
// GraphQL only) and the changes that close an issue.
//
// What GitHub answers is mapped to the loop's facts (./loop.contract.ts): an open draft is `draft`, a
// closed pull request with a merge time is `merged`; a check run still running, or a commit status
// pending, is `pending`, and each ends as `success`, `failure`, `neutral` or `skipped`. GitHub lists a
// pull request among a repository's issues: an issue read here never is one. The token never leaves this
// module: no answer, error or log line carries it.
import { GithubDeferred, GithubPaused, githubClient, type GithubStore } from '@omni/github';
import { z } from 'zod';
import { CommentIdSchema, IssueNumberSchema, PrNumberSchema, type IssueNumber, type PrNumber } from 'omni-loop/kit/lib/ids.ts';
import { githubApp, type AppCredentials, type InstallationToken } from '../signup/github-app';
import type {
  Change, ChangeDetail, ChangesQuery, ChangeState, Check, CheckState, Comment, CommentsQuery, Issue, IssueDetail, IssuesQuery, Thread,
} from './loop.contract';
import { HostSpent, HostUnreadable, type LoopHost } from './loop.service';

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

const GITHUB = 'https://api.github.com';
/** A token is renewed this long before it expires. */
const TOKEN_MARGIN_MS = 60_000;
/** GitHub's page size, at most. */
const PAGE = 100;
/** How many pages of pull requests a list reads at most, label filtering included. */
export const MAX_LIST_PAGES = 5;
/** GitHub lists at most 3000 files of a pull request. */
const MAX_FILE_PAGES = 30;
/** How many pages of checks, of comments, and of review threads a read takes at most. */
export const MAX_PAGES = 10;

const Pull = z.object({
  number: PrNumberSchema,
  title: z.string(),
  html_url: z.url(),
  state: z.enum(['open', 'closed']),
  draft: z.boolean().optional().default(false),
  created_at: z.string(),
  updated_at: z.string(),
  merged_at: z.string().nullable().optional().default(null),
  body: z.string().nullable().optional().default(null),
  user: z.object({ login: z.string() }).nullable().optional().default(null),
  labels: z.array(z.object({ name: z.string() })).optional().default([]),
  head: z.object({ ref: z.string(), sha: z.string() }),
  base: z.object({ ref: z.string() }),
  mergeable: z.boolean().nullable().optional().default(null),
});
type Pull = z.infer<typeof Pull>;
const Pulls = z.array(Pull);
const Files = z.array(z.object({ filename: z.string() }));
const Commit = z.object({ commit: z.object({ committer: z.object({ date: z.string() }).nullable() }) });
const CheckRun = z.object({ id: z.number(), name: z.string(), status: z.string(), conclusion: z.string().nullable().optional().default(null) });
type CheckRun = z.infer<typeof CheckRun>;
const CheckRuns = z.object({ check_runs: z.array(CheckRun) });
const CombinedStatus = z.object({ statuses: z.array(z.object({ context: z.string(), state: z.string() })) });
const IssueComment = z.object({
  id: CommentIdSchema,
  user: z.object({ login: z.string() }).nullable().optional().default(null),
  body: z.string().nullable().optional().default(null),
  created_at: z.string(),
  updated_at: z.string(),
});
const IssueComments = z.array(IssueComment);
const GithubIssue = z.object({
  number: IssueNumberSchema,
  title: z.string(),
  state: z.enum(['open', 'closed']),
  body: z.string().nullable().optional().default(null),
  labels: z.array(z.union([z.object({ name: z.string() }), z.string()])).optional().default([]),
  pull_request: z.unknown().optional(),
});
type GithubIssue = z.infer<typeof GithubIssue>;
const GithubIssues = z.array(GithubIssue);

/** GraphQL's answer: its data, or the errors it gives with a 200. */
const GraphqlAnswer = z.object({ data: z.unknown().optional(), errors: z.array(z.object({ message: z.string() })).nullish() });
const ThreadNode = z.object({
  id: z.string().min(1),
  isResolved: z.boolean(),
  path: z.string().nullable().optional().default(null),
  line: z.number().int().nullable().optional().default(null),
  comments: z.object({ nodes: z.array(z.object({ author: z.object({ login: z.string() }).nullable(), body: z.string(), createdAt: z.string() }).nullable()) }),
});
const ThreadsData = z.object({
  repository: z.object({
    pullRequest: z.object({
      reviewThreads: z.object({
        nodes: z.array(ThreadNode.nullable()),
        pageInfo: z.object({ hasNextPage: z.boolean(), endCursor: z.string().nullable() }),
      }),
    }).nullable(),
  }).nullable(),
});
type ThreadsData = z.infer<typeof ThreadsData>;
const ClosedByData = z.object({
  repository: z.object({
    issue: z.object({
      closedByPullRequestsReferences: z.object({
        nodes: z.array(z.object({ number: PrNumberSchema, repository: z.object({ nameWithOwner: z.string() }) }).nullable()),
      }),
    }).nullable(),
  }).nullable(),
});

const THREADS_QUERY = `query($owner: String!, $name: String!, $number: Int!, $after: String) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      reviewThreads(first: 100, after: $after) {
        nodes { id isResolved path line comments(first: 100) { nodes { author { login } body createdAt } } }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
}`;

const CLOSED_BY_QUERY = `query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    issue(number: $number) {
      closedByPullRequestsReferences(first: 100, includeClosedPrs: true) { nodes { number repository { nameWithOwner } } }
    }
  }
}`;

/** The conclusions of a check run that failed. */
const FAILED_RUN = new Set(['failure', 'timed_out', 'cancelled', 'action_required', 'startup_failure']);

/** A check run's state, in the loop's words: pending until it completes, then how it ended. */
export function checkRunState({ status, conclusion }: Pick<CheckRun, 'status' | 'conclusion'>): CheckState {
  if (status !== 'completed' || conclusion === null) return 'pending';
  if (conclusion === 'success') return 'success';
  if (conclusion === 'skipped') return 'skipped';
  return FAILED_RUN.has(conclusion) ? 'failure' : 'neutral';
}

/** The newest run of each check, in the order GitHub first lists its name. GitHub keeps the latest run of a
 * check per check suite only, so a workflow run a later one superseded on the same head stays listed beside
 * it (#2468); a newer run has a greater id. */
function newestRuns(runs: readonly CheckRun[]): CheckRun[] {
  const newest = new Map<string, CheckRun>();
  for (const run of runs) {
    const kept = newest.get(run.name);
    if (kept === undefined || run.id > kept.id) newest.set(run.name, run);
  }
  return [...newest.values()];
}

/** A commit status's state, in the loop's words. */
export function commitStatusState(state: string): CheckState {
  if (state === 'success') return 'success';
  return state === 'failure' || state === 'error' ? 'failure' : 'pending';
}

/** An issue's or a pull request's comment, in the loop's words. */
function commentOf(comment: z.infer<typeof IssueComment>): Comment {
  return { id: comment.id, author: comment.user?.login ?? null, body: comment.body ?? '', createdAt: comment.created_at, updatedAt: comment.updated_at };
}

/** An issue, in the loop's words. */
export function issueOf(issue: GithubIssue): Issue {
  return {
    number: issue.number,
    title: issue.title,
    state: issue.state,
    labels: issue.labels.map((label) => (typeof label === 'string' ? label : label.name)),
    body: issue.body ?? '',
  };
}

/** A pull request's state, in the loop's words. */
export function stateOf(pull: Pick<Pull, 'state' | 'draft' | 'merged_at'>): ChangeState {
  if (pull.state === 'open') return pull.draft ? 'draft' : 'open';
  return pull.merged_at ? 'merged' : 'closed';
}

/** A pull request as a change. */
export function changeOf(pull: Pull): Change {
  return {
    number: pull.number,
    title: pull.title,
    head: pull.head.ref,
    base: pull.base.ref,
    state: stateOf(pull),
    createdAt: pull.created_at,
    updatedAt: pull.updated_at,
    mergedAt: pull.merged_at,
    labels: pull.labels.map((label) => label.name),
    body: pull.body ?? '',
    url: pull.html_url,
    author: pull.user?.login ?? null,
  };
}

/** GitHub's answer could not be read as it documents it. */
function malformed(route: string): Error {
  return new Error(`GitHub's answer to ${route} is not the shape it documents`);
}

export type GithubLoopHostDeps = {
  creds: AppCredentials;
  fetch?: Fetch;
  clock?: () => number;
  /** The budget's store (github_etags, github_budget); without one every call goes out plain. */
  store?: GithubStore | null;
};

export function githubLoopHost({ creds, fetch: send = (url, init) => fetch(url, init), clock = Date.now, store = null }: GithubLoopHostDeps): LoopHost {
  const app = githubApp(creds, send, clock);
  const github = githubClient({ store, fetch: send, clock });
  const tokens = new Map<string, InstallationToken & { installation: number }>();

  /** A token for `repo` and its installation, reused until a minute before it expires. */
  async function tokenFor(repo: string): Promise<{ token: string; installation: number }> {
    const kept = tokens.get(repo);
    if (kept && clock() < kept.expiresAt - TOKEN_MARGIN_MS) return kept;
    let found;
    try {
      const installation = await app.repoInstallation(repo);
      if (!installation) throw new HostUnreadable(repo, 'the app is not installed there');
      found = { ...(await app.installationToken(installation.id)), installation: installation.id };
    } catch (error) {
      if (error instanceof HostUnreadable) throw error;
      throw new HostUnreadable(repo, 'the app\'s token was refused');
    }
    tokens.set(repo, found);
    return found;
  }

  /** A call for `repo` to `url`, as JSON; null on a 404. A refusal of the token, or of the repository, is
   * HostUnreadable; a spent budget is HostSpent; any other error throws, naming `what`. */
  async function call(repo: string, url: string, what: string, init: RequestInit = {}): Promise<unknown> {
    const { token, installation } = await tokenFor(repo);
    let res: Response;
    try {
      res = await github.fetch(url, {
        ...init,
        headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' },
        cache: 'no-store',
        installation,
        priority: 'interactive',
      });
    } catch (error) {
      if (error instanceof GithubPaused || error instanceof GithubDeferred) throw new HostSpent(repo, error.until, 'GitHub');
      throw error;
    }
    if (res.status === 404) return null;
    if (res.status === 401 || res.status === 403) {
      tokens.delete(repo);
      throw new HostUnreadable(repo, `GitHub answered ${res.status}`);
    }
    if (!res.ok) throw new Error(`GitHub answered ${res.status} to ${what}`);
    return res.json();
  }

  /** A GET of `route` under the repository, as JSON; null on a 404. */
  function json(repo: string, route: string): Promise<unknown> {
    return call(repo, `${GITHUB}/repos/${repo}${route}`, route);
  }

  /** A GraphQL query about the repository, its data parsed by `schema`. Errors GraphQL answers with a
   * 200 throw, named by `what`, and so does data in another shape. */
  async function graphql<T>(repo: string, what: string, query: string, variables: Record<string, unknown>, schema: z.ZodType<T>): Promise<T> {
    const [owner, name] = repo.split('/');
    const body = JSON.stringify({ query, variables: { owner, name, ...variables } });
    const answer = GraphqlAnswer.safeParse(await call(repo, `${GITHUB}/graphql`, what, { method: 'POST', body }));
    if (!answer.success) throw malformed(what);
    if (answer.data.errors?.length) throw new Error(`GitHub's GraphQL answered errors to ${what}`);
    const data = schema.safeParse(answer.data.data);
    if (!data.success) throw malformed(what);
    return data.data;
  }

  /** Every review thread of a pull request, a hundred at a time, at most MAX_PAGES pages. */
  async function threadsOf(repo: string, number: PrNumber): Promise<Thread[]> {
    const threads: Thread[] = [];
    let after: string | null = null;
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const data: ThreadsData = await graphql(repo, `the review threads of #${number}`, THREADS_QUERY, { number, after }, ThreadsData);
      const found = data.repository?.pullRequest?.reviewThreads;
      if (!found) break;
      for (const node of found.nodes) {
        if (!node) continue;
        const comments = node.comments.nodes.flatMap((c) => (c ? [{ author: c.author?.login ?? null, body: c.body, createdAt: c.createdAt }] : []));
        threads.push({ id: node.id, path: node.path, line: node.line, resolved: node.isResolved, comments });
      }
      if (!found.pageInfo.hasNextPage || !found.pageInfo.endCursor) break;
      after = found.pageInfo.endCursor;
    }
    return threads;
  }

  /** The checks on a commit: the newest run of each check, then its commit statuses (GitHub lists the
   * latest of each context). */
  async function checksOf(repo: string, sha: string): Promise<Check[]> {
    const runs: CheckRun[] = [];
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const route = `/commits/${sha}/check-runs?per_page=${PAGE}&page=${page}`;
      const answer = await json(repo, route);
      if (answer === null) break;
      const parsed = CheckRuns.safeParse(answer);
      if (!parsed.success) throw malformed(route);
      runs.push(...parsed.data.check_runs);
      if (parsed.data.check_runs.length < PAGE) break;
    }
    const statusRoute = `/commits/${sha}/status?per_page=${PAGE}`;
    const combined = await json(repo, statusRoute);
    const statuses = combined === null ? null : CombinedStatus.safeParse(combined);
    if (statuses && !statuses.success) throw malformed(statusRoute);
    return [
      ...newestRuns(runs).map((run) => ({ name: run.name, state: checkRunState(run) })),
      ...(statuses?.data.statuses ?? []).map((status) => ({ name: status.context, state: commitStatusState(status.state) })),
    ];
  }

  /** Every comment of an issue's or a pull request's conversation, oldest first, at most MAX_PAGES
   * pages; null when the repository has neither by that number. */
  async function commentsOf(repo: string, number: IssueNumber | PrNumber): Promise<Comment[] | null> {
    const comments: Comment[] = [];
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const route = `/issues/${number}/comments?per_page=${PAGE}&page=${page}`;
      const answer = await json(repo, route);
      if (answer === null) return page === 1 ? null : comments;
      const parsed = IssueComments.safeParse(answer);
      if (!parsed.success) throw malformed(route);
      comments.push(...parsed.data.map(commentOf));
      if (parsed.data.length < PAGE) break;
    }
    return comments;
  }

  /** The pull requests of `repo` itself that close one of its issues. */
  async function closedByOf(repo: string, number: IssueNumber): Promise<PrNumber[]> {
    const data = await graphql(repo, `the changes that close #${number}`, CLOSED_BY_QUERY, { number }, ClosedByData);
    const nodes = data.repository?.issue?.closedByPullRequestsReferences.nodes ?? [];
    return nodes.flatMap((node) => (node && node.repository.nameWithOwner.toLowerCase() === repo.toLowerCase() ? [node.number] : []));
  }

  /** Every page of a list, until a short page or `pages` of them. */
  async function pages<T>(repo: string, route: (page: number) => string, schema: z.ZodType<T[]>, max: number, enough: (kept: T[]) => boolean = () => false): Promise<T[]> {
    const kept: T[] = [];
    for (let page = 1; page <= max; page += 1) {
      const path = route(page);
      const parsed = schema.safeParse((await json(repo, path)) ?? []);
      if (!parsed.success) throw malformed(path);
      kept.push(...parsed.data);
      if (parsed.data.length < PAGE || enough(kept)) break;
    }
    return kept;
  }

  return {
    async changes({ repo, base, head, label, state }: ChangesQuery, limit: number): Promise<Change[]> {
      const [owner] = repo.split('/');
      const filter = new URLSearchParams({ state, sort: 'created', direction: 'desc', per_page: String(PAGE) });
      if (base) filter.set('base', base);
      if (head) filter.set('head', `${owner}:${head}`);
      const labelled = (pull: Pull) => !label || pull.labels.some((l) => l.name === label);
      const pulls = await pages(repo, (page) => `/pulls?${filter}&page=${page}`, Pulls, MAX_LIST_PAGES, (kept) => kept.filter(labelled).length >= limit);
      return pulls.filter(labelled).slice(0, limit).map(changeOf);
    },

    async change(repo: string, number: PrNumber): Promise<ChangeDetail | null> {
      const route = `/pulls/${number}`;
      const answer = await json(repo, route);
      if (answer === null) return null;
      const parsed = Pull.safeParse(answer);
      if (!parsed.success) throw malformed(route);
      const pull = parsed.data;
      const [commit, files, checks, threads] = await Promise.all([
        json(repo, `/commits/${pull.head.sha}`),
        pages(repo, (page) => `${route}/files?per_page=${PAGE}&page=${page}`, Files, MAX_FILE_PAGES),
        checksOf(repo, pull.head.sha),
        threadsOf(repo, number),
      ]);
      const committed = commit === null ? null : Commit.safeParse(commit);
      if (committed && !committed.success) throw malformed(`/commits/${pull.head.sha}`);
      return {
        ...changeOf(pull),
        lastCommitAt: committed?.data.commit.committer?.date ?? null,
        files: files.map((file) => file.filename),
        review: { checks, mergeable: pull.mergeable, threads },
      };
    },

    comments({ repo, on }: CommentsQuery): Promise<Comment[] | null> {
      return commentsOf(repo, on);
    },

    async issues({ repo, label, state }: IssuesQuery, limit: number): Promise<Issue[]> {
      const filter = new URLSearchParams({ state, sort: 'created', direction: 'desc', per_page: String(PAGE) });
      if (label) filter.set('labels', label);
      const onlyIssues = (issue: GithubIssue) => issue.pull_request === undefined;
      const enough = (kept: GithubIssue[]) => kept.filter(onlyIssues).length >= limit;
      const found = await pages(repo, (page) => `/issues?${filter}&page=${page}`, GithubIssues, MAX_LIST_PAGES, enough);
      return found.filter(onlyIssues).slice(0, limit).map(issueOf);
    },

    async issue(repo: string, number: IssueNumber): Promise<IssueDetail | null> {
      const route = `/issues/${number}`;
      const answer = await json(repo, route);
      if (answer === null) return null;
      const parsed = GithubIssue.safeParse(answer);
      if (!parsed.success) throw malformed(route);
      if (parsed.data.pull_request !== undefined) return null;
      const [comments, closedBy] = await Promise.all([commentsOf(repo, number), closedByOf(repo, number)]);
      return { ...issueOf(parsed.data), comments: comments ?? [], closedBy };
    },
  };
}
