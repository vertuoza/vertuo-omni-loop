// Test support for `pr-stats`: a stubbed GitHub holding pull requests per repository, and a fake store
// holding the rows the collector writes. Nothing in the app imports it.
//
// The stubbed GitHub answers both of GitHub's APIs the way octokit hands them back: REST through
// `octokit.request(route, params)`, each call spending one of the core budget and answering with its
// `x-ratelimit-*` headers, and GraphQL through `octokit.graphql(query, variables)`, each query spending
// one of the GraphQL budget and answering `rateLimit` when asked. The two budgets are separate, as on
// GitHub; a spent budget answers 403 (REST) or RATE_LIMITED (GraphQL).

import type { PrStatsStore, RepositoryPatch } from './supabase-store.ts';

/** A user as GitHub's REST API names it. */
export type FakeUser = { login: string; type?: string };

/**
 * A pull request as GitHub's REST API returns it, with what the stub answers beside it: its reviews,
 * its commit messages, `commit_dates` (each commit's committed date, the pull request's `created_at`
 * when left out), `comments` (each comment's body, oldest first) and `label_events` (each label
 * added, oldest first).
 */
export type FakePull = {
  number: number;
  user: FakeUser | null;
  created_at: string;
  updated_at: string;
  merged_at: string | null;
  closed_at: string | null;
  merged_by: FakeUser | null;
  base?: { ref: string } | null;
  head?: { ref: string } | null;
  draft: boolean;
  labels: { name: string }[];
  commits: number;
  additions: number;
  deletions: number;
  body: string | null;
  reviews?: { user: FakeUser | null; submitted_at?: string | null; state?: string }[];
  commitMessages?: string[];
  commit_dates?: string[];
  comments?: string[];
  label_events?: { name: string; created_at: string }[];
};

/**
 * A repository the stub holds: its pull requests, and `fail` to fail every request, or every pull
 * detail read once `after` of them were answered (REST: one per pull request; GraphQL: one per
 * details query).
 */
export type FakeRepo = { pulls?: FakePull[]; fail?: { status: number; message: string; after?: number } };

type Limit = { limit: number; remaining: number };
type Params = { owner: string; repo: string; pull_number?: number; per_page?: number; page?: number };
type Variables = { owner: string; repo: string; first?: number; after?: string | null };
type Query = { operation: string | undefined; numbers?: number[] } & Partial<Variables>;

/** A stubbed GitHub holding `repos`, keyed by `owner/name`. */
export function fakeGitHub(repos: Record<string, FakeRepo>, budgets: { core?: Limit; graphql?: Limit } = {}) {
  const requests: ({ route: string } & Params)[] = [];
  const queries: Query[] = [];
  const details = new Map<string, number>();
  const budget = {
    core: { limit: 5000, remaining: 5000, ...budgets.core },
    graphql: { limit: 5000, remaining: 5000, ...budgets.graphql },
  };

  function repoOf({ owner, repo }: { owner: string; repo: string }, detail = false): FakeRepo {
    const key = `${owner}/${repo}`;
    const found = repos[key];
    if (!found) throw httpError(404, `Not Found: ${key}`);
    const { fail } = found;
    if (fail && (fail.after === undefined || (detail && (details.get(key) ?? 0) >= fail.after))) {
      throw httpError(fail.status, fail.message);
    }
    if (detail) details.set(key, (details.get(key) ?? 0) + 1);
    return found;
  }

  function pullOf(params: Params, detail = false): FakePull {
    const pull = (repoOf(params, detail).pulls ?? []).find((candidate) => candidate.number === params.pull_number);
    if (!pull) throw httpError(404, 'Not Found');
    return pull;
  }

  const page = <T>(items: T[], { per_page = 30, page = 1 }: Params): T[] => items.slice((page - 1) * per_page, page * per_page);
  const newestFirst = (pulls: FakePull[] | undefined) => [...(pulls ?? [])].sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));

  function spend(kind: 'core' | 'graphql') {
    const left = budget[kind];
    if (left.remaining <= 0) {
      if (kind === 'core') throw httpError(403, 'API rate limit exceeded for installation');
      throw graphqlError('RATE_LIMITED', 'API rate limit exceeded for installation');
    }
    left.remaining -= 1;
  }

  const headers = () => ({
    'x-ratelimit-limit': String(budget.core.limit),
    'x-ratelimit-remaining': String(budget.core.remaining),
    'x-ratelimit-resource': 'core',
  });

  const rateLimit = () => ({ limit: budget.graphql.limit, remaining: budget.graphql.remaining, cost: 1, resetAt: '2026-09-29T13:23:00Z' });

  const octokit = {
    async request(route: string, params: Params) {
      requests.push({ route, ...params });
      spend('core');
      switch (route) {
        case 'GET /repos/{owner}/{repo}/pulls':
          return { headers: headers(), data: page(newestFirst(repoOf(params).pulls), params).map(({ reviews, commitMessages, comments, label_events, ...pull }) => pull) };
        case 'GET /repos/{owner}/{repo}/pulls/{pull_number}': {
          const { reviews, commitMessages, comments, label_events, ...pull } = pullOf(params, true);
          return { headers: headers(), data: pull };
        }
        case 'GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews':
          return { headers: headers(), data: page(pullOf(params).reviews ?? [], params) };
        case 'GET /repos/{owner}/{repo}/pulls/{pull_number}/commits':
          return { headers: headers(), data: page((pullOf(params).commitMessages ?? []).map((message: string) => ({ commit: { message } })), params) };
        default:
          throw new Error(`fake GitHub: unexpected ${route}`);
      }
    },

    async graphql(query: string, variables: Partial<Variables> = {}): Promise<Record<string, unknown>> {
      const operation = /query\s+(\w+)/.exec(query)?.[1];
      const numbers = [...query.matchAll(/pullRequest\(number:\s*(\d+)\)/g)].map((match) => Number(match[1]));
      queries.push({ operation, ...variables, ...(numbers.length ? { numbers } : {}) });
      spend('graphql');
      const answer = operation === 'Budget' || operation === 'PullsUpdated' || operation === 'PullDetails' || operation === 'PullStatus' ? answers[operation] : undefined;
      if (!answer) throw new Error(`fake GitHub: unexpected GraphQL query ${operation}`);
      return { ...(/\brateLimit\b/.test(query) ? { rateLimit: rateLimit() } : {}), ...answer(variables, numbers) };
    },
  };

  /** What each of the collector's GraphQL queries answers, besides `rateLimit`. */
  const answers = {
    Budget: (_variables: Partial<Variables>, _numbers: number[]) => ({}),
    PullsUpdated(variables: Partial<Variables>, _numbers: number[]) {
      const sorted = newestFirst(graphqlRepo(variables).pulls);
      const from = variables.after ? Number(variables.after) : 0;
      const nodes = sorted.slice(from, from + (variables.first ?? 100)).map((pull) => ({ number: pull.number, updatedAt: pull.updated_at }));
      const end = from + nodes.length;
      return { repository: { pullRequests: { pageInfo: { hasNextPage: end < sorted.length, endCursor: String(end) }, nodes } } };
    },
    PullDetails(variables: Partial<Variables>, numbers: number[]) {
      return { repository: aliased(graphqlRepo(variables, true).pulls ?? [], numbers, asGraphql) };
    },
    PullStatus(variables: Partial<Variables>, numbers: number[]) {
      const comments = (pull: FakePull) => ({ comments: { nodes: (pull.comments ?? []).slice(0, 100).map((body) => ({ body })) } });
      return { repository: aliased(graphqlRepo(variables).pulls ?? [], numbers, comments) };
    },
  };

  function graphqlRepo({ owner, repo }: Partial<Variables>, detail = false): FakeRepo {
    const key = `${owner}/${repo}`;
    if (!repos[key] || owner === undefined || repo === undefined) {
      throw graphqlError('NOT_FOUND', `Could not resolve to a Repository with the name '${key}'.`);
    }
    return repoOf({ owner, repo }, detail);
  }

  return { octokit, requests, queries, budget };
}

/** One aliased field per number, `p<number>`, as a query of several pull requests answers: each pull request as `shape` gives it, `null` when the repository has none by that number. */
function aliased(pulls: readonly FakePull[], numbers: readonly number[], shape: (pull: FakePull) => unknown): Record<string, unknown> {
  const repository: Record<string, unknown> = {};
  for (const number of numbers) {
    const pull = pulls.find((candidate) => candidate.number === number);
    repository[`p${number}`] = pull ? shape(pull) : null;
  }
  return repository;
}

/** A pull request of the REST shape `pull()` builds, as GitHub's GraphQL API answers it. */
function asGraphql(pull: FakePull) {
  const actor = (user: FakeUser | null) => (user ? { login: user.type === 'Bot' ? user.login.replace(/\[bot\]$/, '') : user.login, __typename: user.type === 'Bot' ? 'Bot' : 'User' } : null);
  const messages = pull.commitMessages ?? [];
  const dates = pull.commit_dates ?? [];
  return {
    number: pull.number,
    author: actor(pull.user),
    createdAt: pull.created_at,
    mergedAt: pull.merged_at ?? null,
    closedAt: pull.closed_at ?? null,
    mergedBy: actor(pull.merged_by),
    ...loopFactsOf(pull),
    body: pull.body ?? '',
    additions: pull.additions,
    deletions: pull.deletions,
    commits: { totalCount: pull.commits, nodes: messages.map((message, i) => ({ commit: { message, committedDate: dates[i] ?? pull.created_at } })).slice(-100) },
    reviews: { nodes: (pull.reviews ?? []).slice(0, 100).map((review) => ({ author: actor(review.user), submittedAt: review.submitted_at ?? null })) },
  };
}

/** The branches, draft, labels and label events of a REST-shaped pull request, as GraphQL answers them. */
function loopFactsOf(pull: FakePull) {
  return {
    baseRefName: pull.base?.ref ?? null,
    headRefName: pull.head?.ref ?? null,
    isDraft: Boolean(pull.draft),
    labels: { nodes: (pull.labels ?? []).map((label) => ({ name: label.name })) },
    timelineItems: { nodes: (pull.label_events ?? []).slice(0, 100).map((event) => ({ createdAt: event.created_at, label: { name: event.name } })) },
  };
}

function graphqlError(type: string, message: string): Error {
  return Object.assign(new Error(`Request failed due to following response errors:\n - ${message}`), { errors: [{ type, message }] });
}

function httpError(status: number, message: string): Error {
  return Object.assign(new Error(message), { status });
}

/** A repository the fake store holds, as a test names it. */
export type FakeRepository = {
  workspaceId: string;
  installationId: number | null;
  fullName: string;
  tracked?: boolean;
  collectedAt?: string | null;
  collectedUntil?: string | null;
  collectError?: string | null;
};

type StoredRepository = FakeRepository & {
  tracked: boolean;
  collectedAt: string | null | undefined;
  collectedUntil: string | null | undefined;
  collectError: string | null | undefined;
};

/** A store in memory, the shape `supabase-store.ts` gives the collector. */
export function fakeStore(repositories: FakeRepository[]) {
  const state = {
    repositories: repositories.map((repository): StoredRepository => ({
      tracked: true,
      collectedAt: null,
      collectedUntil: null,
      collectError: null,
      ...repository,
    })),
    pulls: new Map<string, Parameters<PrStatsStore['savePull']>[0]>(),
    reviews: new Map<string, Parameters<PrStatsStore['savePull']>[1][number]>(),
    writes: 0,
  };

  const store = {
    async trackedRepositories() {
      return state.repositories.flatMap(({ tracked, workspaceId, installationId, fullName, collectedUntil }) =>
        tracked && installationId ? [{ workspaceId, installationId, fullName, collectedUntil: collectedUntil ?? null }] : [],
      );
    },
    async savePull(...[row, reviews]: Parameters<PrStatsStore['savePull']>) {
      state.writes += 1;
      state.pulls.set(`${row.workspace_id}|${row.repo}|${row.number}`, structuredClone(row));
      for (const review of reviews) {
        state.reviews.set(`${review.workspace_id}|${review.repo}|${review.number}|${review.reviewer}`, structuredClone(review));
      }
    },
    async updateRepository(workspaceId: string, fullName: string, patch: RepositoryPatch) {
      const repository = state.repositories.find((candidate) => candidate.workspaceId === workspaceId && candidate.fullName === fullName);
      if (!repository) throw new Error(`fake store: no repository ${workspaceId}/${fullName}`);
      if ('collected_at' in patch) repository.collectedAt = patch.collected_at;
      if ('collected_until' in patch) repository.collectedUntil = patch.collected_until;
      if ('collect_error' in patch) repository.collectError = patch.collect_error;
    },
  } satisfies PrStatsStore;
  return { state, ...store };
}

/** A pull request as GitHub's REST API returns it, with its reviews and commit messages beside it. */
export function pull(number: number, fields: Partial<FakePull> = {}): FakePull {
  const created = fields.created_at ?? '2026-09-20T10:00:00Z';
  return {
    number,
    user: { login: 'ana', type: 'User' },
    created_at: created,
    updated_at: created,
    merged_at: null,
    closed_at: null,
    merged_by: null,
    base: { ref: 'main' },
    head: { ref: 'feature' },
    draft: false,
    labels: [],
    commits: 1,
    additions: 10,
    deletions: 2,
    body: '',
    reviews: [],
    commitMessages: ['feat: something'],
    ...fields,
  };
}
