// Test support for `pr-stats`: a stubbed GitHub holding pull requests per repository, and a fake store
// holding the rows the collector writes. Nothing in the app imports it.

/**
 * @param {Record<string, {
 *   pulls?: object[],          each: number, user, created_at, updated_at, merged_at, closed_at, merged_by,
 *                              base, commits, additions, deletions, body, reviews?, commitMessages?
 *   fail?: { status: number, message: string, after?: number },  fail every request, or every pull detail read
 *                              once `after` of them were answered
 * }>} repos  keyed by `owner/name`
 */
export function fakeGitHub(repos) {
  const requests = [];
  const details = new Map();

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

  const octokit = {
    async request(route, params) {
      requests.push({ route, ...params });
      switch (route) {
        case 'GET /repos/{owner}/{repo}/pulls': {
          const sorted = [...(repoOf(params).pulls ?? [])].sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
          return { data: page(sorted, params).map(({ reviews, commitMessages, ...pull }) => pull) };
        }
        case 'GET /repos/{owner}/{repo}/pulls/{pull_number}': {
          const { reviews, commitMessages, ...pull } = pullOf(params, true);
          return { data: pull };
        }
        case 'GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews':
          return { data: page(pullOf(params).reviews ?? [], params) };
        case 'GET /repos/{owner}/{repo}/pulls/{pull_number}/commits':
          return { data: page((pullOf(params).commitMessages ?? []).map((message) => ({ commit: { message } })), params) };
        default:
          throw new Error(`fake GitHub: unexpected ${route}`);
      }
    },
  };
  return { octokit, requests };
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
    commits: 1,
    additions: 10,
    deletions: 2,
    body: '',
    reviews: [],
    commitMessages: ['feat: something'],
    ...fields,
  };
}
