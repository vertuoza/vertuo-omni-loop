import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { stagesReader } from './github';

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

type FakeRepo = { config?: string | null; inbox?: string[]; shipped?: string[]; issues?: unknown[]; pulls?: unknown[]; events?: Record<number, unknown[]>; fail?: RegExp };
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

const ROUTES: readonly Route[] = [tokenRoute, configRoute, folderRoute, issuesRoute, pullsRoute, eventsRoute];

function fakeGithub(repo: FakeRepo) {
  const calls: string[] = [];
  const fetchImpl = vi.fn(async (href: string, init: RequestInit) => {
    const url = new URL(href);
    const at = `${url.pathname}${url.search}`;
    calls.push(at);
    if (repo.fail?.test(at)) return json({ message: 'boom' }, 502);
    for (const route of ROUTES) {
      const answer = route(url, repo, init);
      if (answer) return answer;
    }
    throw new Error(`unexpected GitHub call ${href}`);
  });
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
