import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { memoryGithubStore } from '@omni/github';
import { parsePr } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { changeOf, githubLoopHost, MAX_LIST_PAGES, stateOf } from './github';
import { ChangeDetailSchema, ChangeSchema, ChangesQuerySchema } from './loop.contract';
import { HostSpent, HostUnreadable } from './loop.service';

vi.mock('server-only', () => ({}));

// The loop's GitHub host (PRD 1665, s1), against a stubbed `fetch` answering recorded REST payloads:
// never GitHub itself. Each test says what the repository holds.

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const CREDS = { appId: '123456', privateKey: privateKey.export({ type: 'pkcs1', format: 'pem' }).toString() };
const NOW = Date.parse('2026-10-12T10:00:00Z');
const TOKEN = 'ghs_secret_installation_token';

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

type World = {
  installed?: boolean;
  pulls?: ReturnType<typeof pull>[];
  /** Answers a pulls list with this status instead. */
  listStatus?: number;
  files?: string[];
  commitDate?: string | null;
  etag?: boolean;
  spent?: boolean;
};

type Route = (url: URL, init: RequestInit) => Response | undefined;

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
    (url) => {
      if (!url.pathname.startsWith('/repos/acme/widgets/commits/')) return undefined;
      return world.commitDate === null ? json({ message: 'No commit' }, 404) : json({ sha: 'x', commit: { committer: { name: 'ada', date: world.commitDate ?? '2026-10-11T09:30:00Z' } } });
    },
  ];
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
  return { host, sent, tokens: () => tokens, reads: () => sent.filter((s) => s.url.pathname.startsWith('/repos/acme/widgets/') && !s.url.pathname.endsWith('/installation')) };
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
    const parsed = changeOf({ ...pull(3), number: parsePr(3), state: 'open', draft: false, merged_at: null, body: 'b', user: { login: 'ada' }, labels: [{ name: 'omni:sub' }], head: { ref: 'h', sha: 's' }, base: { ref: 'b' } });
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

  it('answers no last commit when the head commit is gone', async () => {
    const { host } = fakeGithub({ pulls: [pull(4)], commitDate: null });
    expect(await host.change('acme/widgets', parsePr(4))).toMatchObject({ lastCommitAt: null, files: [] });
  });

  it('answers null for a number the repository has no change by', async () => {
    const { host } = fakeGithub({ pulls: [] });
    expect(await host.change('acme/widgets', parsePr(99))).toBeNull();
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

  it('never puts the token in an error it throws', async () => {
    for (const world of [{ installed: false }, { listStatus: 401 }, { spent: true }] satisfies World[]) {
      const { host } = fakeGithub(world);
      const error: unknown = await host.changes(query(), 200).catch((e: unknown) => e);
      expect(error instanceof Error ? `${error.message} ${error.stack ?? ''}` : String(error)).not.toContain(TOKEN);
    }
  });
});
