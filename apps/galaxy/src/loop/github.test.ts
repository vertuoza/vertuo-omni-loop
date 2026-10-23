import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { memoryGithubStore } from '@omni/github';
import { careState } from 'omni-loop/kit/lib/care/state.ts';
import { parseIssue, parsePr } from 'omni-loop/kit/lib/ids.ts';
import { LoopChangeDetailSchema } from 'omni-loop/kit/lib/loop-reads/contract.ts';
import { changeOf, checkRunState, commitStatusState, githubLoopHost, issueOf, MAX_LIST_PAGES, MAX_PAGES, stateOf } from './github';
import { ChangeDetailSchema, ChangeSchema, ChangesQuerySchema, CommentsQuerySchema, IssueDetailSchema, IssueSchema, IssuesQuerySchema } from './loop.contract';
import { HostSpent, HostUnreadable } from './loop.service';

vi.mock('server-only', () => ({}));

// The loop's GitHub host (PRD 1665, s1 and s2), against a stubbed `fetch` answering recorded REST payloads:
// never GitHub itself. Each test says what the repository holds.

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const CREDS = { appId: '123456', privateKey: privateKey.export({ type: 'pkcs1', format: 'pem' }).toString() };
const NOW = Date.parse('2026-10-12T10:00:00Z');
const TOKEN = 'ghs_' + 'secret_installation_token';

/** A pull request as GitHub's REST API answers it, trimmed to what the host reads and a little more. */
const pull = (number: number, more: Record<string, unknown> = {}) => ({
  url: `https://api.github.com/repos/acme/widgets/pulls/${number}`,
  number,
  title: `Change ${number}`,
  html_url: `https://github.com/acme/widgets/pull/${number}`,
  state: 'open',
  draft: false,
  locked: false,
  created_at: `2026-10-${String(1 + (number % 9)).padStart(2, '0')}T08:00:00Z`,
  updated_at: '2026-10-11T08:00:00Z',
  merged_at: null,
  body: `Part of #${number}`,
  user: { login: 'ada', id: 1 },
  labels: [{ id: 9, name: 'omni:sub', color: 'ededed' }],
  head: { ref: `feat/x--s${number}`, sha: `sha${number}`, repo: { full_name: 'acme/widgets' } },
  base: { ref: 'feat/x', sha: 'base' },
  ...more,
});

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

/** An issue as GitHub's REST API answers it; a pull request carries `pull_request`. */
const issue = (number: number, more: Record<string, unknown> = {}) => ({
  url: `https://api.github.com/repos/acme/widgets/issues/${number}`,
  number,
  title: `Issue ${number}`,
  state: 'open',
  body: `PRD #${number}`,
  user: { login: 'ada' },
  labels: [{ id: 3, name: 'omni:bug' }],
  ...more,
});

/** An issue comment as GitHub's REST API answers it. */
const comment = (id: number, more: Record<string, unknown> = {}) => ({
  id,
  node_id: `IC_${id}`,
  user: { login: 'ada', id: 1 },
  body: `Comment ${id}`,
  created_at: '2026-10-11T08:00:00Z',
  updated_at: '2026-10-11T09:00:00Z',
  ...more,
});

/** A review thread as GitHub's GraphQL API answers it. */
const thread = (id: string, more: Record<string, unknown> = {}) => ({
  id,
  isResolved: false,
  path: 'src/a.ts',
  line: 4,
  comments: { nodes: [{ author: { login: 'grace' }, body: 'Rename this.', createdAt: '2026-10-11T09:40:00Z' }] },
  ...more,
});

type World = {
  installed?: boolean;
  /** The head commit's check runs, as GitHub lists them; each one's id is its place in the list unless it says. */
  checkRuns?: { id?: number; name: string; status: string; conclusion: string | null }[];
  /** The head commit's statuses, as GitHub's combined status lists them. */
  statuses?: { context: string; state: string }[];
  /** The pull request's review threads, as GraphQL pages them. */
  threads?: ReturnType<typeof thread>[];
  /** GraphQL answers these errors with a 200. */
  graphqlErrors?: string[];
  issues?: ReturnType<typeof issue>[];
  /** Each issue's (or pull request's) comments, by its number. */
  comments?: Record<number, ReturnType<typeof comment>[]>;
  /** The pull requests that close an issue, with their repository. */
  closedBy?: { number: number; repo: string }[];
  pulls?: ReturnType<typeof pull>[];
  /** Answers a pulls list with this status instead. */
  listStatus?: number;
  files?: string[];
  commitDate?: string | null;
  etag?: boolean;
  spent?: boolean;
};

type Route = (url: URL, init: RequestInit) => Response | undefined;

/** A sent request's body, which the host only ever sends as text. */
const bodyOf = (init: RequestInit): string => (typeof init.body === 'string' ? init.body : '');

const SPENT = { 'x-ratelimit-limit': '5000', 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(NOW / 1000 + 1800) };

/** One page of a hundred, as the `page` parameter asks. */
const pageOf = <T>(all: T[], url: URL) => {
  const page = Number(url.searchParams.get('page'));
  return all.slice((page - 1) * 100, page * 100);
};

/** The repository's own routes, each answering what the world holds. */
function repositoryRoutes(world: World): Route[] {
  return [
    () => (world.spent ? json({ message: 'API rate limit exceeded' }, 403, SPENT) : undefined),
    (url, init) => {
      if (url.pathname !== '/repos/acme/widgets/pulls') return undefined;
      if (world.listStatus) return json({ message: 'nope' }, world.listStatus);
      const etag: Record<string, string> = world.etag ? { etag: '"list"' } : {};
      if (world.etag && new Headers(init.headers).get('if-none-match') === '"list"') return new Response(null, { status: 304, headers: etag });
      const all = (world.pulls ?? []).filter((p) => url.searchParams.get('state') === 'all' || p.state === 'open');
      return json(pageOf(all, url), 200, etag);
    },
    (url) => {
      const one = /^\/repos\/acme\/widgets\/pulls\/(\d+)$/.exec(url.pathname);
      if (!one) return undefined;
      const found = (world.pulls ?? []).find((p) => p.number === Number(one[1]));
      return found ? json(found) : json({ message: 'Not Found' }, 404);
    },
    (url) => (/^\/repos\/acme\/widgets\/pulls\/\d+\/files$/.test(url.pathname)
      ? json(pageOf(world.files ?? [], url).map((filename) => ({ filename, status: 'modified' }))) : undefined),
    (url) => (/^\/repos\/acme\/widgets\/commits\/[^/]+\/check-runs$/.test(url.pathname)
      ? json({ total_count: world.checkRuns?.length ?? 0, check_runs: pageOf(world.checkRuns ?? [], url).map((run, i) => ({ id: i + 1, head_sha: 'x', ...run })) }) : undefined),
    (url) => (/^\/repos\/acme\/widgets\/commits\/[^/]+\/status$/.test(url.pathname)
      ? json({ state: 'pending', sha: 'x', total_count: world.statuses?.length ?? 0, statuses: (world.statuses ?? []).map((status, i) => ({ id: i + 1, ...status })) }) : undefined),
    (url) => {
      if (!url.pathname.startsWith('/repos/acme/widgets/commits/')) return undefined;
      return world.commitDate === null ? json({ message: 'No commit' }, 404) : json({ sha: 'x', commit: { committer: { name: 'ada', date: world.commitDate ?? '2026-10-11T09:30:00Z' } } });
    },
    (url) => {
      if (url.pathname !== '/repos/acme/widgets/issues') return undefined;
      const label = url.searchParams.get('labels');
      const all = (world.issues ?? [])
        .filter((i) => url.searchParams.get('state') === 'all' || i.state === (url.searchParams.get('state') ?? 'open'))
        .filter((i) => !label || i.labels.some((l) => l.name === label));
      return json(pageOf(all, url));
    },
    (url) => {
      const found = /^\/repos\/acme\/widgets\/issues\/(\d+)\/comments$/.exec(url.pathname);
      if (!found) return undefined;
      const kept = world.comments?.[Number(found[1])];
      return kept ? json(pageOf(kept, url)) : json({ message: 'Not Found' }, 404);
    },
    (url) => {
      const found = /^\/repos\/acme\/widgets\/issues\/(\d+)$/.exec(url.pathname);
      if (!found) return undefined;
      const one = (world.issues ?? []).find((i) => i.number === Number(found[1]));
      return one ? json(one) : json({ message: 'Not Found' }, 404);
    },
    (url, init) => (url.pathname === '/graphql' ? graphqlAnswer(world, init) : undefined),
  ];
}

/** GraphQL's answer to one of the host's two queries, paging threads two at a time by their index. */
function graphqlAnswer(world: World, init: RequestInit): Response {
  if (world.graphqlErrors) return json({ errors: world.graphqlErrors.map((message) => ({ message })) });
  const { query: text, variables } = JSON.parse(bodyOf(init)) as { query: string; variables: { owner: string; name: string; after: string | null } };
  expect(variables).toMatchObject({ owner: 'acme', name: 'widgets' });
  if (text.includes('closedByPullRequestsReferences')) {
    const nodes = (world.closedBy ?? []).map((pr) => ({ number: pr.number, repository: { nameWithOwner: pr.repo } }));
    return json({ data: { repository: { issue: { closedByPullRequestsReferences: { nodes } } } } });
  }
  const all = world.threads ?? [];
  const start = variables.after === null ? 0 : Number(variables.after);
  const nodes = all.slice(start, start + 2);
  const more = start + 2 < all.length;
  return json({ data: { repository: { pullRequest: { reviewThreads: { nodes, pageInfo: { hasNextPage: more, endCursor: more ? String(start + 2) : null } } } } } });
}

/** A fake GitHub: the App's installation and token routes, then the repository's. */
function fakeGithub(world: World = {}) {
  const sent: { url: URL; init: RequestInit }[] = [];
  let tokens = 0;
  const routes: Route[] = [
    (url) => {
      if (url.pathname !== '/repos/acme/widgets/installation') return undefined;
      return world.installed === false ? json({ message: 'Not Found' }, 404) : json({ id: 5001, account: { login: 'acme', type: 'Organization' } });
    },
    (url) => {
      if (url.pathname !== '/app/installations/5001/access_tokens') return undefined;
      tokens += 1;
      return json({ token: TOKEN, expires_at: new Date(NOW + 3_600_000).toISOString() }, 201);
    },
    ...repositoryRoutes(world),
  ];
  const fetch = (raw: string, init: RequestInit = {}): Promise<Response> => {
    const url = new URL(raw);
    sent.push({ url, init });
    for (const route of routes) {
      const answer = route(url, init);
      if (answer) return Promise.resolve(answer);
    }
    return Promise.reject(new Error(`no route for ${raw}`));
  };
  const host = githubLoopHost({ creds: CREDS, fetch, clock: () => NOW, store: memoryGithubStore() });
  return {
    host, sent, tokens: () => tokens,
    reads: () => sent.filter((s) => s.url.pathname.startsWith('/repos/acme/widgets/') && !s.url.pathname.endsWith('/installation')),
    graphql: () => sent.filter((s) => s.url.pathname === '/graphql'),
  };
}

const query = (q: Record<string, string> = {}) => ChangesQuerySchema.parse({ repo: 'acme/widgets', ...q });

describe('the loop facts of a pull request', () => {
  it('names its state in the loop\'s words: draft, open, merged, closed', () => {
    expect(stateOf({ state: 'open', draft: true, merged_at: null })).toBe('draft');
    expect(stateOf({ state: 'open', draft: false, merged_at: null })).toBe('open');
    expect(stateOf({ state: 'closed', draft: false, merged_at: '2026-10-10T00:00:00Z' })).toBe('merged');
    expect(stateOf({ state: 'closed', draft: false, merged_at: null })).toBe('closed');
  });

  it('maps a recorded pull request to a Change the contract accepts', async () => {
    const { host } = fakeGithub({ pulls: [pull(7, { body: null, user: null, labels: [] })] });
    const [change] = await host.changes(query(), 200);
    expect(ChangeSchema.parse(change)).toEqual({
      number: parsePr(7), title: 'Change 7', head: 'feat/x--s7', base: 'feat/x', state: 'open',
      createdAt: '2026-10-08T08:00:00Z', updatedAt: '2026-10-11T08:00:00Z', mergedAt: null,
      labels: [], body: '', url: 'https://github.com/acme/widgets/pull/7', author: null,
    });
  });

  it('keeps labels, author and body', () => {
    const parsed = changeOf({ ...pull(3), number: parsePr(3), state: 'open', draft: false, merged_at: null, body: 'b', user: { login: 'ada' }, labels: [{ name: 'omni:sub' }], head: { ref: 'h', sha: 's' }, base: { ref: 'b' }, mergeable: null });
    expect(parsed).toMatchObject({ labels: ['omni:sub'], author: 'ada', body: 'b' });
  });
});

describe('githubLoopHost: a repository\'s changes', () => {
  it('asks GitHub by base, head as owner:branch and state, newest first', async () => {
    const { host, reads } = fakeGithub({ pulls: [pull(1)] });
    await host.changes(query({ base: 'feat/x', head: 'feat/x--s1', state: 'all' }), 200);
    const params = reads()[0]?.url.searchParams;
    expect(Object.fromEntries(params ?? [])).toEqual({
      state: 'all', sort: 'created', direction: 'desc', per_page: '100', base: 'feat/x', head: 'acme:feat/x--s1', page: '1',
    });
  });

  it('reads open changes only unless asked for all', async () => {
    const { host } = fakeGithub({ pulls: [pull(1), pull(2, { state: 'closed', merged_at: '2026-10-10T00:00:00Z' })] });
    expect((await host.changes(query(), 200)).map((c) => c.number)).toEqual([1]);
    expect((await host.changes(query({ state: 'all' }), 200)).map((c) => c.state)).toEqual(['open', 'merged']);
  });

  it('filters by label, reading further pages until it has enough', async () => {
    const pulls = Array.from({ length: 250 }, (_, i) => pull(i + 1, { labels: i % 2 ? [{ name: 'omni:sub' }] : [] }));
    const { host, reads } = fakeGithub({ pulls });
    const found = await host.changes(query({ label: 'omni:sub' }), 100);
    expect(found).toHaveLength(100);
    expect(found.every((c) => c.labels.includes('omni:sub'))).toBe(true);
    expect(reads()).toHaveLength(2);
  });

  it('stops at its page limit', async () => {
    const pulls = Array.from({ length: 100 * (MAX_LIST_PAGES + 2) }, (_, i) => pull(i + 1, { labels: [] }));
    const { host, reads } = fakeGithub({ pulls });
    expect(await host.changes(query({ label: 'omni:sub' }), 200)).toEqual([]);
    expect(reads()).toHaveLength(MAX_LIST_PAGES);
  });

  it('sends a repeated read with If-None-Match and serves the stored list on a 304', async () => {
    const { host, reads } = fakeGithub({ pulls: [pull(1)], etag: true });
    const first = await host.changes(query(), 200);
    const second = await host.changes(query(), 200);
    expect(second).toEqual(first);
    expect(new Headers(reads()[1]?.init.headers).get('if-none-match')).toBe('"list"');
  });

  it('reuses its installation token', async () => {
    const { host, tokens } = fakeGithub({ pulls: [pull(1)] });
    await host.changes(query(), 200);
    await host.changes(query(), 200);
    expect(tokens()).toBe(1);
  });
});

describe('githubLoopHost: one change', () => {
  it('answers it with its last commit\'s date and every file it touches', async () => {
    const files = Array.from({ length: 130 }, (_, i) => `src/f${i}.ts`);
    const { host } = fakeGithub({ pulls: [pull(4, { draft: true })], files });
    const change = ChangeDetailSchema.parse(await host.change('acme/widgets', parsePr(4)));
    expect(change).toMatchObject({ number: 4, state: 'draft', lastCommitAt: '2026-10-11T09:30:00Z' });
    expect(change.files).toEqual(files);
  });

  it('answers its review: the head\'s check runs and statuses, whether it merges, its threads', async () => {
    const { host } = fakeGithub({
      pulls: [pull(4, { mergeable: false })],
      checkRuns: [{ name: 'test', status: 'completed', conclusion: 'success' }, { name: 'lint', status: 'in_progress', conclusion: null }],
      statuses: [{ context: 'outbox', state: 'failure' }],
      threads: [thread('PRRT_1'), thread('PRRT_2', { isResolved: true, path: null, line: null, comments: { nodes: [{ author: null, body: 'ok', createdAt: '2026-10-11T10:00:00Z' }] } })],
    });
    const { review } = ChangeDetailSchema.parse(await host.change('acme/widgets', parsePr(4)));
    expect(review).toEqual({
      checks: [{ name: 'test', state: 'success' }, { name: 'lint', state: 'pending' }, { name: 'outbox', state: 'failure' }],
      mergeable: false,
      threads: [
        { id: 'PRRT_1', path: 'src/a.ts', line: 4, resolved: false, comments: [{ author: 'grace', body: 'Rename this.', createdAt: '2026-10-11T09:40:00Z' }] },
        { id: 'PRRT_2', path: null, line: null, resolved: true, comments: [{ author: null, body: 'ok', createdAt: '2026-10-11T10:00:00Z' }] },
      ],
    });
  });

  it('answers the newest run of each check, so a run superseded on the same head no longer turns the care state red (#2468)', async () => {
    // #2456's head: GitHub lists newest first, and keeps a superseded workflow run's check runs beside the new run's.
    const { host } = fakeGithub({
      pulls: [pull(4)],
      checkRuns: [
        { id: 120119738190, name: 'quick', status: 'completed', conclusion: 'success' },
        { id: 120118941575, name: 'gitleaks', status: 'completed', conclusion: 'success' },
        { id: 120118832107, name: 'quick', status: 'completed', conclusion: 'cancelled' },
        { id: 120118538829, name: 'gitleaks', status: 'completed', conclusion: 'success' },
      ],
    });
    const change = LoopChangeDetailSchema.parse(await host.change('acme/widgets', parsePr(4)));
    expect(careState({ change, comments: [] }, { statusMarker: null, needsFixLabel: null }).checks).toMatchObject({ state: 'green', failed: [] });
    expect(change.review.checks).toEqual([{ name: 'quick', state: 'success' }, { name: 'gitleaks', state: 'success' }]);
  });

  it('takes the run of a check with the greatest id wherever GitHub lists it, and leaves a check run once as it ended', async () => {
    const { host } = fakeGithub({
      pulls: [pull(4)],
      checkRuns: [
        { id: 3, name: 'test', status: 'completed', conclusion: 'failure' },
        { id: 7, name: 'lint', status: 'completed', conclusion: 'success' },
        { id: 5, name: 'test', status: 'completed', conclusion: 'success' },
        { id: 8, name: 'lint', status: 'queued', conclusion: null },
        { id: 4, name: 'test', status: 'completed', conclusion: 'cancelled' },
        { id: 2, name: 'build', status: 'completed', conclusion: 'cancelled' },
      ],
    });
    expect((await host.change('acme/widgets', parsePr(4)))?.review.checks).toEqual([
      { name: 'test', state: 'success' },
      { name: 'lint', state: 'pending' },
      { name: 'build', state: 'failure' },
    ]);
  });

  it('answers mergeable null while GitHub has not worked it out, and no checks nor threads when none', async () => {
    const { host } = fakeGithub({ pulls: [pull(4, { mergeable: null })] });
    expect((await host.change('acme/widgets', parsePr(4)))?.review).toEqual({ checks: [], mergeable: null, threads: [] });
  });

  it('reads every page of review threads, asking GraphQL from the last cursor, and only that far', async () => {
    const threads = Array.from({ length: 5 }, (_, i) => thread(`PRRT_${i}`));
    const { host, graphql } = fakeGithub({ pulls: [pull(4)], threads });
    expect((await host.change('acme/widgets', parsePr(4)))?.review.threads.map((t) => t.id)).toEqual(threads.map((t) => t.id));
    const afters = graphql().map((s) => (JSON.parse(bodyOf(s.init)) as { variables: { after: string | null } }).variables.after);
    expect(afters).toEqual([null, '2', '4']);
    expect(graphql().every((s) => s.init.method === 'POST')).toBe(true);
  });

  it('stops at its page limit for threads and for check runs', async () => {
    const { host, graphql, reads } = fakeGithub({
      pulls: [pull(4)],
      threads: Array.from({ length: 2 * (MAX_PAGES + 3) }, (_, i) => thread(`PRRT_${i}`)),
      checkRuns: Array.from({ length: 100 * (MAX_PAGES + 1) }, (_, i) => ({ name: `c${i}`, status: 'queued', conclusion: null })),
    });
    const change = await host.change('acme/widgets', parsePr(4));
    expect(change?.review.threads).toHaveLength(2 * MAX_PAGES);
    expect(graphql()).toHaveLength(MAX_PAGES);
    expect(change?.review.checks).toHaveLength(100 * MAX_PAGES);
    expect(reads().filter((s) => s.url.pathname.endsWith('/check-runs'))).toHaveLength(MAX_PAGES);
  });

  it('throws when GraphQL answers errors, naming what it read', async () => {
    const { host } = fakeGithub({ pulls: [pull(4)], graphqlErrors: ['Something went wrong'] });
    await expect(host.change('acme/widgets', parsePr(4))).rejects.toThrow('the review threads of #4');
  });

  it('answers no last commit when the head commit is gone', async () => {
    const { host } = fakeGithub({ pulls: [pull(4)], commitDate: null });
    expect(await host.change('acme/widgets', parsePr(4))).toMatchObject({ lastCommitAt: null, files: [] });
  });

  it('answers null for a number the repository has no change by', async () => {
    const { host } = fakeGithub({ pulls: [] });
    expect(await host.change('acme/widgets', parsePr(99))).toBeNull();
  });
});

describe('the loop facts of a check', () => {
  it.each([
    ['queued', null, 'pending'],
    ['in_progress', null, 'pending'],
    ['completed', null, 'pending'],
    ['completed', 'success', 'success'],
    ['completed', 'skipped', 'skipped'],
    ['completed', 'neutral', 'neutral'],
    ['completed', 'stale', 'neutral'],
    ['completed', 'failure', 'failure'],
    ['completed', 'timed_out', 'failure'],
    ['completed', 'cancelled', 'failure'],
    ['completed', 'action_required', 'failure'],
    ['completed', 'startup_failure', 'failure'],
  ] as const)('a check run %s with %s is %s', (status, conclusion, state) => {
    expect(checkRunState({ status, conclusion })).toBe(state);
  });

  it.each([['success', 'success'], ['failure', 'failure'], ['error', 'failure'], ['pending', 'pending']] as const)('a commit status %s is %s', (given, state) => {
    expect(commitStatusState(given)).toBe(state);
  });
});

const comments = (on: number) => CommentsQuerySchema.parse({ repo: 'acme/widgets', on: String(on) });
const issues = (q: Record<string, string> = {}) => IssuesQuerySchema.parse({ repo: 'acme/widgets', ...q });

describe('githubLoopHost: comments', () => {
  it('answers an issue\'s or a change\'s conversation, oldest first, in the contract\'s shape', async () => {
    const { host } = fakeGithub({ comments: { 9: [comment(1), comment(2, { user: null, body: null })] } });
    expect(await host.comments(comments(9))).toEqual([
      { id: 1, author: 'ada', body: 'Comment 1', createdAt: '2026-10-11T08:00:00Z', updatedAt: '2026-10-11T09:00:00Z' },
      { id: 2, author: null, body: '', createdAt: '2026-10-11T08:00:00Z', updatedAt: '2026-10-11T09:00:00Z' },
    ]);
  });

  it('reads every page, up to its limit', async () => {
    const { host, reads } = fakeGithub({ comments: { 9: Array.from({ length: 100 * (MAX_PAGES + 1) }, (_, i) => comment(i + 1)) } });
    expect(await host.comments(comments(9))).toHaveLength(100 * MAX_PAGES);
    expect(reads()).toHaveLength(MAX_PAGES);
  });

  it('answers an empty conversation as no comments, and a missing number as null', async () => {
    const { host } = fakeGithub({ comments: { 9: [] } });
    expect(await host.comments(comments(9))).toEqual([]);
    expect(await host.comments(comments(8))).toBeNull();
  });
});

describe('githubLoopHost: issues', () => {
  it('maps an issue to the contract, its labels named', () => {
    expect(IssueSchema.parse(issueOf({ ...issue(3), number: parseIssue(3), state: 'closed', body: null, labels: [{ name: 'omni:bug' }, 'plain'], pull_request: undefined }))).toEqual({
      number: 3, title: 'Issue 3', state: 'closed', labels: ['omni:bug', 'plain'], body: '',
    });
  });

  it('asks GitHub by label and state, newest first, and never answers a pull request', async () => {
    const { host, reads } = fakeGithub({ issues: [issue(5), issue(4, { pull_request: { url: 'x' } }), issue(3, { state: 'closed' })] });
    expect((await host.issues(issues({ label: 'omni:bug', state: 'all' }), 200)).map((i) => i.number)).toEqual([5, 3]);
    expect(Object.fromEntries(reads()[0]?.url.searchParams ?? [])).toEqual({
      state: 'all', sort: 'created', direction: 'desc', per_page: '100', labels: 'omni:bug', page: '1',
    });
    expect((await host.issues(issues(), 200)).map((i) => i.number)).toEqual([5]);
  });

  it('reads further pages when pull requests take room, and stops at its page limit', async () => {
    const many = Array.from({ length: 100 * (MAX_LIST_PAGES + 1) }, (_, i) => issue(i + 1, i % 2 ? {} : { pull_request: {} }));
    const { host, reads } = fakeGithub({ issues: many });
    expect(await host.issues(issues(), 120)).toHaveLength(120);
    expect(reads()).toHaveLength(3);
    const all = fakeGithub({ issues: many });
    expect(await all.host.issues(issues(), 1000)).toHaveLength(50 * MAX_LIST_PAGES);
    expect(all.reads()).toHaveLength(MAX_LIST_PAGES);
  });

  it('answers one issue with its comments and the changes of its own repository that close it', async () => {
    const { host } = fakeGithub({
      issues: [issue(21, { state: 'closed' })],
      comments: { 21: [comment(7)] },
      closedBy: [{ number: 31, repo: 'acme/widgets' }, { number: 4, repo: 'acme/other' }, { number: 32, repo: 'Acme/Widgets' }],
    });
    expect(IssueDetailSchema.parse(await host.issue('acme/widgets', parseIssue(21)))).toEqual({
      number: 21, title: 'Issue 21', state: 'closed', labels: ['omni:bug'], body: 'PRD #21',
      comments: [{ id: 7, author: 'ada', body: 'Comment 7', createdAt: '2026-10-11T08:00:00Z', updatedAt: '2026-10-11T09:00:00Z' }],
      closedBy: [31, 32],
    });
  });

  it('answers null for a number with no issue, and for a pull request\'s', async () => {
    const { host, graphql } = fakeGithub({ issues: [issue(4, { pull_request: { url: 'x' } })] });
    expect(await host.issue('acme/widgets', parseIssue(9))).toBeNull();
    expect(await host.issue('acme/widgets', parseIssue(4))).toBeNull();
    expect(graphql()).toEqual([]);
  });
});

describe('githubLoopHost: refusals', () => {
  it('cannot read a repository the App is not installed on', async () => {
    const { host, reads } = fakeGithub({ installed: false });
    await expect(host.changes(query(), 200)).rejects.toBeInstanceOf(HostUnreadable);
    expect(reads()).toEqual([]);
  });

  it.each([401, 403])('cannot read a repository whose token GitHub refuses (%i)', async (status) => {
    const { host } = fakeGithub({ listStatus: status });
    await expect(host.changes(query(), 200)).rejects.toBeInstanceOf(HostUnreadable);
  });

  it('says when a spent budget refills', async () => {
    const { host } = fakeGithub({ spent: true });
    const error: unknown = await host.changes(query(), 200).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HostSpent);
    expect(error).toMatchObject({ until: NOW + 1_800_000, host: 'GitHub' });
  });

  it('throws on any other error, naming the route and never the token', async () => {
    const { host } = fakeGithub({ listStatus: 502 });
    const error: unknown = await host.changes(query(), 200).catch((e: unknown) => e);
    expect(String(error)).toContain('GitHub answered 502');
    expect(String(error)).not.toContain(TOKEN);
  });

  it('refuses the new reads as it refuses a list', async () => {
    await expect(fakeGithub({ installed: false }).host.issues(issues(), 200)).rejects.toBeInstanceOf(HostUnreadable);
    await expect(fakeGithub({ installed: false }).host.comments(comments(1))).rejects.toBeInstanceOf(HostUnreadable);
    await expect(fakeGithub({ spent: true }).host.issue('acme/widgets', parseIssue(1))).rejects.toBeInstanceOf(HostSpent);
  });

  it('never puts the token in an error it throws', async () => {
    for (const world of [{ installed: false }, { listStatus: 401 }, { spent: true }] satisfies World[]) {
      const { host } = fakeGithub(world);
      const error: unknown = await host.changes(query(), 200).catch((e: unknown) => e);
      expect(error instanceof Error ? `${error.message} ${error.stack ?? ''}` : String(error)).not.toContain(TOKEN);
    }
  });
});
