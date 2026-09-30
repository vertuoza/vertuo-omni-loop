// Test support for `pr-stats`: a stubbed GitHub holding pull requests per repository, and a fake store
// holding the rows the collector writes. Nothing in the app imports it.
//
// The stubbed GitHub answers both of GitHub's APIs the way octokit hands them back: REST through
// `octokit.request(route, params)`, each call spending one of the core budget and answering with its
// `x-ratelimit-*` headers, and GraphQL through `octokit.graphql(query, variables)`, each query spending
// one of the GraphQL budget and answering `rateLimit` when asked. The two budgets are separate, as on
// GitHub; a spent budget answers 403 (REST) or RATE_LIMITED (GraphQL).

/**
 * @param {Record<string, {
 *   pulls?: object[],          each: number, user, created_at, updated_at, merged_at, closed_at, merged_by,
 *                              base, head, commits, additions, deletions, body, reviews?, commitMessages?
 *   fail?: { status: number, message: string, after?: number },  fail every request, or every pull detail read
 *                              once `after` of them were answered (REST: one per pull request; GraphQL: one
 *                              per details query)
 * }>} repos  keyed by `owner/name`
 * @param {{ core?: { limit: number, remaining: number }, graphql?: { limit: number, remaining: number } }} [budgets]
 */
export function fakeGitHub(repos, budgets = {}) {
  const requests = [];
  const queries = [];
  const details = new Map();
  const budget = {
    core: { limit: 5000, remaining: 5000, ...budgets.core },
    graphql: { limit: 5000, remaining: 5000, ...budgets.graphql },
  };

  function repoOf({ owner, repo }, detail = false) {
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

  function pullOf(params, detail = false) {
    const pull = (repoOf(params, detail).pulls ?? []).find((candidate) => candidate.number === params.pull_number);
    if (!pull) throw httpError(404, 'Not Found');
    return pull;
  }

  const page = (items, { per_page = 30, page = 1 }) => items.slice((page - 1) * per_page, page * per_page);
  const newestFirst = (pulls) => [...(pulls ?? [])].sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));

  function spend(kind) {
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
    async request(route, params) {
      requests.push({ route, ...params });
      spend('core');
      switch (route) {
        case 'GET /repos/{owner}/{repo}/pulls':
          return { headers: headers(), data: page(newestFirst(repoOf(params).pulls), params).map(({ reviews, commitMessages, ...pull }) => pull) };
        case 'GET /repos/{owner}/{repo}/pulls/{pull_number}': {
          const { reviews, commitMessages, ...pull } = pullOf(params, true);
          return { headers: headers(), data: pull };
        }
        case 'GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews':
          return { headers: headers(), data: page(pullOf(params).reviews ?? [], params) };
        case 'GET /repos/{owner}/{repo}/pulls/{pull_number}/commits':
          return { headers: headers(), data: page((pullOf(params).commitMessages ?? []).map((message) => ({ commit: { message } })), params) };
        default:
          throw new Error(`fake GitHub: unexpected ${route}`);
      }
    },

    async graphql(query, variables = {}) {
      const operation = /query\s+(\w+)/.exec(query)?.[1];
      const numbers = [...query.matchAll(/pullRequest\(number:\s*(\d+)\)/g)].map((match) => Number(match[1]));
      queries.push({ operation, ...variables, ...(numbers.length ? { numbers } : {}) });
      spend('graphql');
      const answer = answers[operation];
      if (!answer) throw new Error(`fake GitHub: unexpected GraphQL query ${operation}`);
      return { ...(/\brateLimit\b/.test(query) ? { rateLimit: rateLimit() } : {}), ...answer(variables, numbers) };
    },
  };

  /** What each of the collector's GraphQL queries answers, besides `rateLimit`. */
  const answers = {
    Budget: () => ({}),
    PullsUpdated(variables) {
      const sorted = newestFirst(graphqlRepo(variables).pulls);
      const from = variables.after ? Number(variables.after) : 0;
      const nodes = sorted.slice(from, from + (variables.first ?? 100)).map((pull) => ({ number: pull.number, updatedAt: pull.updated_at }));
      const end = from + nodes.length;
      return { repository: { pullRequests: { pageInfo: { hasNextPage: end < sorted.length, endCursor: String(end) }, nodes } } };
    },
    PullDetails(variables, numbers) {
      const pulls = graphqlRepo(variables, true).pulls ?? [];
      const repository = {};
      for (const number of numbers) {
        const pull = pulls.find((candidate) => candidate.number === number);
        repository[`p${number}`] = pull ? asGraphql(pull) : null;
      }
      return { repository };
    },
  };

  function graphqlRepo({ owner, repo }, detail = false) {
    const key = `${owner}/${repo}`;
    if (!repos[key]) {
      throw graphqlError('NOT_FOUND', `Could not resolve to a Repository with the name '${key}'.`);
    }
    return repoOf({ owner, repo }, detail);
  }

  return { octokit, requests, queries, budget };
}

/** A pull request of the REST shape `pull()` builds, as GitHub's GraphQL API answers it. */
function asGraphql(pull) {
  const actor = (user) => (user ? { login: user.type === 'Bot' ? user.login.replace(/\[bot\]$/, '') : user.login, __typename: user.type === 'Bot' ? 'Bot' : 'User' } : null);
  const messages = pull.commitMessages ?? [];
  return {
    number: pull.number,
    author: actor(pull.user),
    createdAt: pull.created_at,
    mergedAt: pull.merged_at ?? null,
    closedAt: pull.closed_at ?? null,
    mergedBy: actor(pull.merged_by),
    baseRefName: pull.base?.ref ?? null,
    headRefName: pull.head?.ref ?? null,
    body: pull.body ?? '',
    additions: pull.additions,
    deletions: pull.deletions,
    commits: { totalCount: pull.commits, nodes: messages.slice(-100).map((message) => ({ commit: { message } })) },
    reviews: { nodes: (pull.reviews ?? []).slice(0, 100).map((review) => ({ author: actor(review.user), submittedAt: review.submitted_at ?? null })) },
  };
}

function graphqlError(type, message) {
  return Object.assign(new Error(`Request failed due to following response errors:\n - ${message}`), { errors: [{ type, message }] });
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

/**
 * A store in memory, the shape `supabase-store.mjs` gives the collector.
 * @param {{ workspaceId: string, installationId: number | null, fullName: string, tracked?: boolean, collectedUntil?: string | null }[]} repositories
 */
export function fakeStore(repositories) {
  const state = {
    repositories: repositories.map((repository) => ({
      tracked: true,
      collectedAt: null,
      collectedUntil: null,
      collectError: null,
      ...repository,
    })),
    pulls: new Map(),
    reviews: new Map(),
    writes: 0,
  };

  return {
    state,
    async trackedRepositories() {
      return state.repositories
        .filter((repository) => repository.tracked && repository.installationId)
        .map(({ workspaceId, installationId, fullName, collectedUntil }) => ({ workspaceId, installationId, fullName, collectedUntil }));
    },
    async savePull(row, reviews) {
      state.writes += 1;
      state.pulls.set(`${row.workspace_id}|${row.repo}|${row.number}`, structuredClone(row));
      for (const review of reviews) {
        state.reviews.set(`${review.workspace_id}|${review.repo}|${review.number}|${review.reviewer}`, structuredClone(review));
      }
    },
    async updateRepository(workspaceId, fullName, patch) {
      const repository = state.repositories.find((candidate) => candidate.workspaceId === workspaceId && candidate.fullName === fullName);
      if ('collected_at' in patch) repository.collectedAt = patch.collected_at;
      if ('collected_until' in patch) repository.collectedUntil = patch.collected_until;
      if ('collect_error' in patch) repository.collectError = patch.collect_error;
    },
  };
}

/** A pull request as GitHub's REST API returns it, with its reviews and commit messages beside it. */
export function pull(number, fields = {}) {
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
    commits: 1,
    additions: 10,
    deletions: 2,
    body: '',
    reviews: [],
    commitMessages: ['feat: something'],
    ...fields,
  };
}
