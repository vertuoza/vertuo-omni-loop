import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { GithubDeferred, GithubPaused, memoryGithubStore } from '@omni/github';
import { settled } from '../settled';
import { stagesReader } from './github';

vi.mock('server-only', () => ({}));

// The stages sync's reader, against a stubbed `fetch`: never GitHub itself. A small fake GitHub answers
// by route; each test says what the repository holds.

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const CREDS = { appId: '123456', privateKey: privateKey.export({ type: 'pkcs1', format: 'pem' }).toString() };
const NOW = Date.parse('2026-09-29T12:00:00Z');
const CONFIG = 'kit: 1\nrepo:\n  slug: acme/widgets\n  defaultBranch: trunk\npaths:\n  delivery: loop/delivery\nlabels:\n  prd: product\n';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const pull = (number: number, head: string, more: Record<string, unknown> = {}) => ({
  number, state: 'open', draft: false, merged_at: null, created_at: '2026-09-20T00:00:00Z', head: { ref: head }, base: { ref: 'trunk' }, ...more,
});

type FakeRepo = {
  config?: string | null; inbox?: string[]; shipped?: string[]; issues?: unknown[]; pulls?: unknown[]; events?: Record<number, unknown[]>; fail?: RegExp;
  reviews?: Record<number, unknown[]>; checks?: Record<string, unknown[]>;
};
/** One route of the fake GitHub: its answer, or null when the URL is not its own. */
type Route = (url: URL, repo: FakeRepo, init: RequestInit) => Response | null;

/** The page of a hundred the URL asks for. */
const page = (url: URL, items: unknown[] = []) => {
  const at = Number(url.searchParams.get('page'));
  return items.slice((at - 1) * 100, at * 100);
};

const tokenRoute: Route = (url, _repo, init) =>
  (url.pathname === '/app/installations/11/access_tokens' && init.method === 'POST'
    ? json({ token: 'ghs_1', expires_at: new Date(NOW + 3_600_000).toISOString() }, 201)
    : null);

const configRoute: Route = (url, repo) => {
  if (url.pathname !== '/repos/acme/widgets/contents/.omni-loop/config.yml') return null;
  return repo.config === null ? json({}, 404) : new Response(repo.config ?? CONFIG);
};

const folderRoute: Route = (url, repo) => {
  const dir = /^\/repos\/acme\/widgets\/contents\/loop\/delivery\/(inbox|shipped)$/.exec(url.pathname)?.[1] as 'inbox' | 'shipped' | undefined;
  if (!dir) return null;
  expect(url.searchParams.get('ref')).toBe('trunk');
  const names = repo[dir];
  return names ? json([...names.map((name) => ({ name, type: 'dir' })), { name: '.gitkeep', type: 'file' }]) : json({}, 404);
};

const issuesRoute: Route = (url, repo) => {
  if (url.pathname !== '/repos/acme/widgets/issues') return null;
  expect(url.searchParams.get('labels')).toBe('product');
  return json(page(url, repo.issues));
};

const pullsRoute: Route = (url, repo) => (url.pathname === '/repos/acme/widgets/pulls' ? json(page(url, repo.pulls)) : null);

const eventsRoute: Route = (url, repo) => {
  const events = /^\/repos\/acme\/widgets\/issues\/(\d+)\/events$/.exec(url.pathname)?.[1];
  return events ? json(repo.events?.[Number(events)] ?? []) : null;
};

const reviewsRoute: Route = (url, repo) => {
  const pr = /^\/repos\/acme\/widgets\/pulls\/(\d+)\/reviews$/.exec(url.pathname)?.[1];
  return pr ? json(repo.reviews?.[Number(pr)] ?? []) : null;
};

const checksRoute: Route = (url, repo) => {
  const sha = /^\/repos\/acme\/widgets\/commits\/(\w+)\/check-runs$/.exec(url.pathname)?.[1];
  return sha ? json({ total_count: 0, check_runs: repo.checks?.[sha] ?? [] }) : null;
};

const ROUTES: readonly Route[] = [tokenRoute, configRoute, folderRoute, issuesRoute, pullsRoute, eventsRoute, reviewsRoute, checksRoute];

function fakeGithub(repo: FakeRepo) {
  const calls: string[] = [];
  const fetchImpl = vi.fn((href: string, init: RequestInit) => settled(() => {
    const url = new URL(href);
    const at = `${url.pathname}${url.search}`;
    calls.push(at);
    if (repo.fail?.test(at)) return json({ message: 'boom' }, 502);
    for (const route of ROUTES) {
      const answer = route(url, repo, init);
      if (answer) return answer;
    }
    throw new Error(`unexpected GitHub call ${href}`);
  }));
  return { fetchImpl, calls };
}

describe('the stages sync reader', () => {
  it('reads the config, the folders, the labelled issues, the pull requests and the ready time of a feature PR', async () => {
    const gh = fakeGithub({
      inbox: ['0042-dark-mode'],
      shipped: ['0041-light-mode'],
      issues: [{ number: 42, created_at: '2026-09-18T00:00:00Z' }, { number: 60, created_at: '2026-09-19T00:00:00Z', pull_request: {} }],
      pulls: [
        pull(9, 'feat/dark-mode'),
        pull(10, 'feat/dark-mode--s1', { state: 'closed', merged_at: '2026-09-21T00:00:00Z', base: { ref: 'feat/dark-mode' } }),
        pull(11, 'other'),
      ],
      events: { 9: [{ event: 'convert_to_draft', created_at: '2026-09-22T00:00:00Z' }, { event: 'ready_for_review', created_at: '2026-09-23T00:00:00Z' }] },
    });
    const snap = await stagesReader(CREDS, gh.fetchImpl, () => NOW).snapshot(11, 'acme/widgets');
    expect(snap.config?.delivery).toBe('loop/delivery');
    expect(snap.inbox).toEqual(['0042-dark-mode']);
    expect(snap.shipped).toEqual(['0041-light-mode']);
    expect(snap.issues).toEqual([{ number: 42, created_at: '2026-09-18T00:00:00Z' }]);
    expect(snap.pulls.map((p) => [p.number, p.head, p.base, p.ready_at])).toEqual([
      [9, 'feat/dark-mode', 'trunk', '2026-09-23T00:00:00Z'],
      [10, 'feat/dark-mode--s1', 'feat/dark-mode', null],
      [11, 'other', 'trunk', null],
    ]);
    expect(gh.calls.filter((c) => c.includes('/events'))).toEqual(['/repos/acme/widgets/issues/9/events?per_page=100']);
  });

  it('gives an empty snapshot, and reads nothing more, for a repository without a config', async () => {
    const gh = fakeGithub({ config: null });
    const snap = await stagesReader(CREDS, gh.fetchImpl, () => NOW).snapshot(11, 'acme/widgets');
    expect(snap).toEqual({ repository: 'acme/widgets', config: null, inbox: [], shipped: [], issues: [], pulls: [] });
    expect(gh.calls.some((c) => c.includes('/pulls') || c.includes('/issues'))).toBe(false);
  });

  it('reads no folder as none', async () => {
    const snap = await stagesReader(CREDS, fakeGithub({}).fetchImpl, () => NOW).snapshot(11, 'acme/widgets');
    expect(snap.inbox).toEqual([]);
    expect(snap.shipped).toEqual([]);
  });

  it('after a sync, reads only the pull requests and issues updated since it: no page of older pull requests', async () => {
    const since = '2026-09-29T11:00:00Z';
    const at = (minutes: number) => new Date(Date.parse(since) + minutes * 60_000).toISOString();
    // 250 pull requests, most recently updated first: 120 since the last sync, 130 before it.
    const pulls = Array.from({ length: 250 }, (_, i) => pull(1000 - i, `other-${i}`, { updated_at: at(120 - i) }));
    const gh = fakeGithub({ pulls, issues: [{ number: 42, created_at: '2026-09-18T00:00:00Z' }] });
    const snap = await stagesReader(CREDS, gh.fetchImpl, () => NOW).snapshot(11, 'acme/widgets', since);

    const pullPages = gh.calls.filter((c) => c.startsWith('/repos/acme/widgets/pulls')).map((c) => new URL(c, 'https://x').searchParams);
    expect(pullPages.map((q) => [q.get('sort'), q.get('direction'), q.get('page')])).toEqual([['updated', 'desc', '1'], ['updated', 'desc', '2']]);
    expect(snap.pulls.map((p) => p.number)).toEqual(pulls.slice(0, 121).map((p) => p.number));
    const issuePages = gh.calls.filter((c) => c.startsWith('/repos/acme/widgets/issues?')).map((c) => new URL(c, 'https://x').searchParams);
    expect(issuePages.map((q) => q.get('since'))).toEqual([since]);
  });

  it('without a last sync, reads every pull request and issue as before', async () => {
    const pulls = Array.from({ length: 250 }, (_, i) => pull(1000 - i, `other-${i}`));
    const gh = fakeGithub({ pulls });
    const snap = await stagesReader(CREDS, gh.fetchImpl, () => NOW).snapshot(11, 'acme/widgets', null);
    expect(snap.pulls).toHaveLength(250);
    expect(gh.calls.filter((c) => c.startsWith('/repos/acme/widgets/pulls')).map((c) => new URL(c, 'https://x').searchParams.get('sort'))).toEqual(['created', 'created', 'created']);
    expect(gh.calls.filter((c) => c.startsWith('/repos/acme/widgets/issues?')).some((c) => c.includes('since='))).toBe(false);
  });

  it('throws when GitHub fails, naming what it read', async () => {
    const reader = stagesReader(CREDS, fakeGithub({ fail: /\/pulls/ }).fetchImpl, () => NOW);
    await expect(reader.snapshot(11, 'acme/widgets')).rejects.toThrow(/502 to \/pulls/);
  });
});

describe('the stages sync reader and the waits (PRD 2377, s1)', () => {
  const waiting = (number: number, head: string, more: Record<string, unknown> = {}) =>
    pull(number, head, { head: { ref: head, sha: `sha${String(number)}` }, ...more });
  const reads = (calls: string[]) => calls.filter((c) => /\/(reviews|check-runs|events)/.test(c)).sort();

  it('reads the reviewers asked and the labels from the list, and the reviews and checks only of a counted, open, ready pull request into the default branch', async () => {
    const gh = fakeGithub({
      inbox: ['0042-dark-mode'],
      pulls: [
        waiting(9, 'feat/dark-mode', { requested_reviewers: [{ login: 'rita' }], requested_teams: [{ slug: 'core' }] }),
        waiting(5, 'fix/crash', { labels: [{ name: 'omni:bug' }] }),
        waiting(10, 'feat/dark-mode--s1', { base: { ref: 'feat/dark-mode' } }),
        waiting(11, 'feat/dark-mode', { draft: true }),
        waiting(12, 'feat/dark-mode', { state: 'closed', merged_at: '2026-09-25T00:00:00Z' }),
        waiting(13, 'chore/bump'),
      ],
      events: { 5: [{ event: 'review_requested', created_at: '2026-09-24T00:00:00Z' }, { event: 'review_requested', created_at: '2026-09-26T00:00:00Z' }] },
      reviews: { 9: [{ user: { login: 'rita' }, state: 'APPROVED', submitted_at: '2026-09-27T00:00:00Z' }] },
      checks: {
        sha9: [
          { id: 91, name: 'outbox', status: 'completed', conclusion: 'failure', output: { title: 'Locked law changed without its CODEOWNER\'s approval — BR-PRODUCT-5, N-PRODUCT-15; 1 open item' } },
          { id: 92, name: 'test', status: 'completed', conclusion: 'success', output: { title: null } },
        ],
        sha5: [{ id: 51, name: 'test', status: 'in_progress', conclusion: null }],
      },
    });
    const snap = await stagesReader(CREDS, gh.fetchImpl, () => NOW).snapshot(11, 'acme/widgets');
    expect(reads(gh.calls)).toEqual([
      '/repos/acme/widgets/commits/sha5/check-runs?per_page=100',
      '/repos/acme/widgets/commits/sha9/check-runs?per_page=100',
      // The merged feature PR's events, for when it was first marked ready (PRD 2370); no reviews, no checks.
      '/repos/acme/widgets/issues/12/events?per_page=100',
      '/repos/acme/widgets/issues/5/events?per_page=100',
      '/repos/acme/widgets/issues/9/events?per_page=100',
      '/repos/acme/widgets/pulls/5/reviews?per_page=100',
      '/repos/acme/widgets/pulls/9/reviews?per_page=100',
    ]);
    const byNumber = new Map(snap.pulls.map((p) => [Number(p.number), p]));
    expect(byNumber.get(9)).toMatchObject({
      requested: ['rita', 'acme/core'], labels: [],
      reviews: [{ login: 'rita', state: 'APPROVED', submitted_at: '2026-09-27T00:00:00Z' }],
      lawLocked: ['BR-PRODUCT-5', 'N-PRODUCT-15'], checksRed: true,
    });
    expect(byNumber.get(5)).toMatchObject({ labels: ['omni:bug'], requested_at: '2026-09-26T00:00:00Z', reviews: [], lawLocked: [], checksRed: false });
    for (const n of [10, 11, 12, 13]) expect(byNumber.get(n)).toMatchObject({ reviews: null, lawLocked: null, checksRed: null });
  });

  it('reads nothing more for a pull request the run did not list: after a sync, only the ones that changed', async () => {
    const since = '2026-09-29T11:00:00Z';
    const gh = fakeGithub({
      inbox: ['0042-dark-mode'],
      pulls: [waiting(9, 'feat/dark-mode', { updated_at: '2026-09-29T11:30:00Z' }), waiting(8, 'feat/dark-mode', { updated_at: '2026-09-28T00:00:00Z' })],
    });
    await stagesReader(CREDS, gh.fetchImpl, () => NOW).snapshot(11, 'acme/widgets', since);
    expect(reads(gh.calls).filter((c) => !c.includes('/events'))).toEqual([
      '/repos/acme/widgets/commits/sha9/check-runs?per_page=100',
      '/repos/acme/widgets/pulls/9/reviews?per_page=100',
    ]);
  });

  it('leaves a pull request\'s reviews and checks unread when GitHub refuses them, and still gives the snapshot', async () => {
    const gh = fakeGithub({ inbox: ['0042-dark-mode'], pulls: [waiting(9, 'feat/dark-mode')], fail: /\/reviews/ });
    const snap = await stagesReader(CREDS, gh.fetchImpl, () => NOW).snapshot(11, 'acme/widgets');
    expect(snap.pulls[0]).toMatchObject({ reviews: null, lawLocked: null, checksRed: null });
  });

  // GitHub keeps the latest run of a check per check suite only, and each workflow run is a suite of its own:
  // a run a later one superseded on the same head stays listed beside it (#2475).
  it('reads a check re-run green as green, not red from the cancelled run it superseded on the same head (#2475)', async () => {
    const gh = fakeGithub({
      inbox: ['0042-dark-mode'],
      pulls: [waiting(9, 'feat/dark-mode')],
      checks: {
        sha9: [
          { id: 101, name: 'quick', status: 'completed', conclusion: 'cancelled' },
          { id: 102, name: 'test', status: 'completed', conclusion: 'success' },
          { id: 103, name: 'quick', status: 'completed', conclusion: 'success' },
        ],
      },
    });
    const snap = await stagesReader(CREDS, gh.fetchImpl, () => NOW).snapshot(11, 'acme/widgets');
    expect(snap.pulls[0]).toMatchObject({ checksRed: false });
  });

  it('holds no law the outbox check held on a run a later green run superseded on the same head (#2475)', async () => {
    const gh = fakeGithub({
      inbox: ['0042-dark-mode'],
      pulls: [waiting(9, 'feat/dark-mode')],
      checks: {
        sha9: [
          { id: 202, name: 'outbox', status: 'completed', conclusion: 'success', output: { title: 'No open item' } },
          { id: 201, name: 'outbox', status: 'completed', conclusion: 'failure', output: { title: 'Locked law changed without its CODEOWNER\'s approval — BR-PRODUCT-5; 1 open item' } },
        ],
      },
    });
    const snap = await stagesReader(CREDS, gh.fetchImpl, () => NOW).snapshot(11, 'acme/widgets');
    expect(snap.pulls[0]).toMatchObject({ lawLocked: [], checksRed: false });
  });

  it('still reads red a check whose only run was cancelled, and one whose newest run failed after a green one', async () => {
    const gh = fakeGithub({
      inbox: ['0042-dark-mode'],
      pulls: [waiting(9, 'feat/dark-mode'), waiting(8, 'feat/dark-mode')],
      checks: {
        sha9: [
          { id: 101, name: 'quick', status: 'completed', conclusion: 'cancelled' },
          { id: 102, name: 'test', status: 'completed', conclusion: 'success' },
        ],
        sha8: [
          { id: 302, name: 'outbox', status: 'completed', conclusion: 'failure', output: { title: 'Locked law changed without its CODEOWNER\'s approval — BR-PRODUCT-5; 1 open item' } },
          { id: 301, name: 'outbox', status: 'completed', conclusion: 'success', output: { title: 'No open item' } },
        ],
      },
    });
    const snap = await stagesReader(CREDS, gh.fetchImpl, () => NOW).snapshot(11, 'acme/widgets');
    const byNumber = new Map(snap.pulls.map((p) => [Number(p.number), p]));
    expect(byNumber.get(9)).toMatchObject({ lawLocked: [], checksRed: true });
    expect(byNumber.get(8)).toMatchObject({ lawLocked: ['BR-PRODUCT-5'], checksRed: true });
  });
});

describe('the stages sync reader and the budget (PRD 902, s1)', () => {
  const RESET = NOW + 30 * 60_000;
  const repoCalls = (calls: string[]) => calls.filter((c) => c.startsWith('/repos/'));

  it('reads in the background: below 20% of the installation\'s limit it sends nothing and throws GithubDeferred', async () => {
    const store = memoryGithubStore();
    await store.saveBudget(11, 'core', { limit: 5000, remaining: 999, resetAt: RESET, at: NOW });
    const gh = fakeGithub({ inbox: ['0042-dark-mode'] });
    await expect(stagesReader(CREDS, gh.fetchImpl, () => NOW, store).snapshot(11, 'acme/widgets')).rejects.toBeInstanceOf(GithubDeferred);
    expect(repoCalls(gh.calls)).toEqual([]);
  });

  it('sends nothing while the installation is paused', async () => {
    const store = memoryGithubStore();
    await store.pause(11, 'core', RESET, NOW);
    const gh = fakeGithub({ inbox: ['0042-dark-mode'] });
    await expect(stagesReader(CREDS, gh.fetchImpl, () => NOW, store).snapshot(11, 'acme/widgets')).rejects.toBeInstanceOf(GithubPaused);
    expect(repoCalls(gh.calls)).toEqual([]);
  });

  it('records the budget each answer reports, for the installation it reads as', async () => {
    const store = memoryGithubStore();
    const gh = fakeGithub({});
    const reported = { 'x-ratelimit-limit': '5000', 'x-ratelimit-remaining': '4200', 'x-ratelimit-reset': String(RESET / 1000), 'x-ratelimit-resource': 'core' };
    const limited = vi.fn(async (href: string, init: RequestInit) => {
      const answer = await gh.fetchImpl(href, init);
      const headers = new Headers(answer.headers);
      for (const [name, value] of Object.entries(reported)) headers.set(name, value);
      return new Response(await answer.text(), { status: answer.status, headers });
    });
    await stagesReader(CREDS, limited, () => NOW, store).snapshot(11, 'acme/widgets');
    expect(await store.budget(11, 'core')).toMatchObject({ limit: 5000, remaining: 4200, resetAt: RESET });
  });
});

describe('the stages sync reader and the timeline (PRD 2370, s1)', () => {
  const READY = [{ event: 'ready_for_review', created_at: '2026-09-23T00:00:00Z' }, { event: 'convert_to_draft', created_at: '2026-09-24T00:00:00Z' }, { event: 'ready_for_review', created_at: '2026-09-25T00:00:00Z' }];
  const eventCalls = (calls: string[]) => calls.filter((c) => c.includes('/events'));

  it('keeps each pull request\'s body and the config\'s feature link, adding no call', async () => {
    const gh = fakeGithub({ pulls: [pull(9, 'other', { body: 'Closes #42' }), pull(10, 'more')] });
    const snap = await stagesReader(CREDS, gh.fetchImpl, () => NOW).snapshot(11, 'acme/widgets');
    expect(snap.featureLink).toBe('Closes #{prd}');
    expect(snap.pulls.map((p) => p.body)).toEqual(['Closes #42', null]);
    expect(eventCalls(gh.calls)).toEqual([]);
  });

  it('reads when a feature PR was first marked ready, while it is open and ready and once it merged, never for a draft or a closed one', async () => {
    const gh = fakeGithub({
      inbox: ['0042-dark-mode', '0043-light-mode', '0044-sky'],
      shipped: ['0041-sea'],
      pulls: [
        pull(9, 'feat/dark-mode'),
        pull(10, 'feat/sea', { state: 'closed', merged_at: '2026-09-28T00:00:00Z' }),
        pull(11, 'feat/light-mode', { draft: true }),
        pull(12, 'feat/sky', { state: 'closed' }),
        pull(13, 'feat/dark-mode--s1', { state: 'closed', merged_at: '2026-09-21T00:00:00Z', base: { ref: 'feat/dark-mode' } }),
      ],
      events: { 9: READY, 10: [] },
    });
    const snap = await stagesReader(CREDS, gh.fetchImpl, () => NOW).snapshot(11, 'acme/widgets');
    expect(snap.pulls.map((p) => [p.number, p.ready_at, p.first_ready_at])).toEqual([
      [9, '2026-09-25T00:00:00Z', '2026-09-23T00:00:00Z'],
      [10, null, null],
      [11, null, undefined],
      [12, null, undefined],
      [13, null, undefined],
    ]);
    expect(eventCalls(gh.calls)).toEqual(['/repos/acme/widgets/issues/9/events?per_page=100', '/repos/acme/widgets/issues/10/events?per_page=100']);
  });

  it('reads the events of a feature PR whose folder is not on the default branch when its body carries the feature link', async () => {
    const gh = fakeGithub({
      pulls: [
        pull(20, 'feat/night-mode', { body: 'Closes #12\n\nThe night mode.' }),
        pull(21, 'feat/night-mode--s1', { body: 'Part of #12', base: { ref: 'feat/night-mode' } }),
        pull(22, 'fix/night-glare', { body: 'Closes #12' }),
      ],
      events: { 20: READY },
    });
    const snap = await stagesReader(CREDS, gh.fetchImpl, () => NOW).snapshot(11, 'acme/widgets');
    expect(snap.pulls.map((p) => [p.number, p.ready_at, p.first_ready_at])).toEqual([
      [20, null, '2026-09-23T00:00:00Z'],
      [21, null, undefined],
      [22, null, undefined],
    ]);
    expect(eventCalls(gh.calls)).toEqual(['/repos/acme/widgets/issues/20/events?per_page=100']);
  });

  it('reads when a target feature PR of a plan repository\'s PRD was first marked ready, its body read from the list (PRD 2370, s4)', async () => {
    const gh = fakeGithub({
      pulls: [
        pull(30, 'feat/dark-mode', { body: 'Part of acme/plan#7\n\nThe widgets side.', state: 'closed', merged_at: '2026-09-28T00:00:00Z' }),
        pull(31, 'feat/dark-mode--s1', { body: 'Part of acme/plan#7', base: { ref: 'feat/dark-mode' }, state: 'closed', merged_at: '2026-09-22T00:00:00Z' }),
        pull(32, 'feat/sky', { body: 'Part of acme/plan#8', draft: true }),
        pull(33, 'feat/sea', { body: 'Part of mobile-12' }),
        pull(34, 'feat/own', { body: 'Part of acme/widgets#7' }),
      ],
      events: { 30: READY },
    });
    const snap = await stagesReader(CREDS, gh.fetchImpl, () => NOW).snapshot(11, 'acme/widgets');
    expect(snap.pulls.map((p) => [p.number, p.ready_at, p.first_ready_at])).toEqual([
      [30, null, '2026-09-23T00:00:00Z'],
      [31, null, undefined],
      [32, null, undefined],
      [33, null, undefined],
      [34, null, undefined],
    ]);
    expect(eventCalls(gh.calls)).toEqual(['/repos/acme/widgets/issues/30/events?per_page=100']);
  });
});
