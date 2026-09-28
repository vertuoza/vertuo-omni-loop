import { generateKeyPairSync } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { githubReader, latestPull, SUMMARY_TTL_MS } from './reader';
import { UNREAD } from './summary';

// The PRD page's GitHub reader (PRD 426, part 1), against a stubbed `fetch`: never GitHub itself.
// A small fake GitHub answers by route; each test says what the repository holds.

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const CREDS = { appId: '123456', privateKey: privateKey.export({ type: 'pkcs1', format: 'pem' }).toString() };
const NOW = Date.parse('2026-09-28T10:00:00Z');
const DOSSIER = { id: 'd-426', home_repo: 'acme/widgets', prd: 426 };

const CONFIG = 'kit: 1\nrepo:\n  slug: acme/widgets\n  defaultBranch: trunk\nbranches:\n  feature: feature/{topic}\npaths:\n  delivery: loop/delivery\n';

type Route = (url: URL, init: RequestInit) => Response | Promise<Response> | undefined;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const pull = (number: number, head: string, more: Record<string, unknown> = {}) => ({
  number, html_url: `https://github.com/acme/widgets/pull/${number}`, state: 'open' as 'open' | 'closed', draft: false, merged_at: null as string | null,
  created_at: `2026-09-${String(10 + (number % 18)).padStart(2, '0')}T00:00:00Z`, head: { ref: head }, body: null, ...more,
});
const merged = (number: number, head: string, more: Record<string, unknown> = {}) =>
  pull(number, head, { state: 'closed', merged_at: '2026-09-27T00:00:00Z', ...more });

/** A fake GitHub: the App's installation and token routes, then the repository's contents and pulls. */
function fakeGithub(repo: {
  config?: string | null;
  shipped?: string[];
  inbox?: string[];
  issue?: unknown;
  pulls?: ReturnType<typeof pull>[];
  installed?: boolean;
  fail?: RegExp;
}) {
  const calls: string[] = [];
  let tokens = 0;
  const routes: Route[] = [
    (url) => (url.pathname === '/repos/acme/widgets/installation'
      ? (repo.installed === false ? json({}, 404) : json({ id: 5001, account: { login: 'acme', type: 'Organization' } })) : undefined),
    (url, init) => {
      if (url.pathname !== '/app/installations/5001/access_tokens' || init.method !== 'POST') return undefined;
      tokens += 1;
      return json({ token: `ghs_${tokens}`, expires_at: new Date(NOW + 60 * 60_000).toISOString() }, 201);
    },
    (url) => (url.pathname === '/repos/acme/widgets/contents/.omni-loop/config.yml'
      ? (repo.config === null ? json({}, 404) : new Response(repo.config ?? CONFIG)) : undefined),
    (url) => {
      const dir = /^\/repos\/acme\/widgets\/contents\/loop\/delivery\/(shipped|inbox)$/.exec(url.pathname)?.[1] as 'shipped' | 'inbox' | undefined;
      if (!dir) return undefined;
      expect(url.searchParams.get('ref')).toBe('trunk');
      const names = repo[dir];
      return names ? json(names.map((name) => ({ name, type: 'dir' }))) : json({}, 404);
    },
    (url) => (url.pathname === '/repos/acme/widgets/issues/426'
      ? (repo.issue === undefined ? json({}, 404) : json(repo.issue)) : undefined),
    (url) => {
      if (url.pathname !== '/repos/acme/widgets/pulls') return undefined;
      const head = url.searchParams.get('head');
      const base = url.searchParams.get('base');
      return json((repo.pulls ?? []).filter((p) => (head ? `acme:${p.head.ref}` === head : true))
        .filter((p) => (base ? (p as { base?: string }).base === base && p.state === 'closed' : true)));
    },
  ];
  const fetchImpl = vi.fn(async (href: string, init: RequestInit) => {
    const url = new URL(href);
    calls.push(`${url.pathname}${url.search}`);
    if (repo.fail?.test(`${url.pathname}${url.search}`)) return json({ message: 'boom' }, 502);
    for (const route of routes) {
      const answer = await route(url, init);
      if (answer) return answer;
    }
    throw new Error(`unexpected GitHub call ${href}`);
  });
  return { fetchImpl, calls, tokens: () => tokens };
}

beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { vi.restoreAllMocks(); });

const ISSUE = { number: 426, html_url: 'https://github.com/acme/widgets/issues/426', state: 'open' };
const sub = (number: number, isMerged: boolean) =>
  ({ ...(isMerged ? merged(number, `feature/prd-page-stage--s${number}`) : pull(number, `feature/prd-page-stage--s${number}`, { state: 'closed' })), base: 'feature/prd-page-stage' });

describe('the GitHub summary of a numbered dossier', () => {
  it('reads the issue, each PR by the branch shapes of the repository\'s own config, and counts merged sub-PRs', async () => {
    const gh = fakeGithub({
      inbox: ['0425-other', '0426-prd-page-stage'],
      issue: ISSUE,
      pulls: [merged(431, 'docs/phase-0-prd-page-stage'), pull(433, 'feature/prd-page-stage', { draft: true }), sub(434, true), sub(435, true), sub(436, false)],
    });
    const summary = await githubReader(CREDS, gh.fetchImpl, () => NOW).summary(DOSSIER);
    expect(summary).toEqual({
      repo: 'acme/widgets', prd: 426, folder: '0426-prd-page-stage', topic: 'prd-page-stage',
      issue: { number: 426, url: 'https://github.com/acme/widgets/issues/426', state: 'open' },
      phase0: { number: 431, url: 'https://github.com/acme/widgets/pull/431', state: 'merged', draft: false },
      feature: { number: 433, url: 'https://github.com/acme/widgets/pull/433', state: 'open', draft: true },
      retro: null,
      mergedSlices: 2,
    });
    expect(gh.calls).toContain('/repos/acme/widgets/pulls?state=all&per_page=100&head=acme%3Afeature%2Fprd-page-stage&sort=created&direction=desc');
    expect(gh.calls).toContain('/repos/acme/widgets/pulls?state=closed&per_page=100&base=feature%2Fprd-page-stage');
    expect(JSON.stringify(summary)).not.toContain('ghs_');
  });

  it('finds the folder under shipped first, and the retro PR on the retro branch', async () => {
    const gh = fakeGithub({
      shipped: ['0426-prd-page-stage'],
      issue: { ...ISSUE, state: 'closed' },
      pulls: [merged(431, 'docs/phase-0-prd-page-stage'), merged(433, 'feature/prd-page-stage'), pull(440, 'docs/retro-prd-page-stage')],
    });
    const summary = await githubReader(CREDS, gh.fetchImpl, () => NOW).summary(DOSSIER);
    expect(summary).toMatchObject({ folder: '0426-prd-page-stage', feature: { state: 'merged' }, retro: { number: 440, state: 'open' } });
    expect(gh.calls.some((c) => c.includes('/contents/loop/delivery/inbox'))).toBe(false);
  });

  it('counts a closed, unmerged PR as absent and takes the most recent open or merged one', () => {
    const closed = pull(9, 'x', { state: 'closed', created_at: '2026-09-28T00:00:00Z' });
    expect(latestPull([closed])).toBeNull();
    expect(latestPull([closed, merged(3, 'x', { created_at: '2026-09-01T00:00:00Z' }), pull(5, 'x', { created_at: '2026-09-05T00:00:00Z' })]))
      .toMatchObject({ number: 5, state: 'open' });
  });

  it('before phase-0 merges, finds the topic from the PR that carries the PRD\'s link line', async () => {
    const gh = fakeGithub({
      issue: ISSUE,
      pulls: [pull(4260, 'docs/phase-0-other', { body: 'Refs #4260' }), pull(430, 'docs/phase-0-prd-page-stage', { body: 'Spec.\n\nRefs #426' })],
    });
    expect(await githubReader(CREDS, gh.fetchImpl, () => NOW).summary(DOSSIER)).toMatchObject({
      folder: null, topic: 'prd-page-stage', phase0: { number: 430, state: 'open' }, feature: null, retro: null, mergedSlices: 0,
    });
  });

  it('answers "none yet" when no folder and no PR name the PRD', async () => {
    const gh = fakeGithub({ issue: ISSUE });
    expect(await githubReader(CREDS, gh.fetchImpl, () => NOW).summary(DOSSIER)).toMatchObject({
      topic: null, phase0: null, feature: null, retro: null, mergedSlices: 0, issue: { number: 426 },
    });
  });

  it('lets one read fail while the others answer', async () => {
    const gh = fakeGithub({
      inbox: ['0426-prd-page-stage'], issue: ISSUE,
      pulls: [merged(431, 'docs/phase-0-prd-page-stage')], fail: /\/issues\/426|head=acme%3Afeature/,
    });
    expect(await githubReader(CREDS, gh.fetchImpl, () => NOW).summary(DOSSIER)).toMatchObject({
      issue: UNREAD, feature: UNREAD, phase0: { number: 431, state: 'merged' }, retro: null,
    });
  });

  it('is null when the App is not installed on the repository, when it has no config, and when GitHub is unreachable', async () => {
    expect(await githubReader(CREDS, fakeGithub({ installed: false }).fetchImpl, () => NOW).summary(DOSSIER)).toBeNull();
    expect(await githubReader(CREDS, fakeGithub({ config: null }).fetchImpl, () => NOW).summary(DOSSIER)).toBeNull();
    expect(await githubReader(CREDS, async () => { throw new TypeError('fetch failed'); }, () => NOW).summary(DOSSIER)).toBeNull();
  });

  it('never puts an odd repository in a GitHub address', async () => {
    const gh = fakeGithub({});
    expect(await githubReader(CREDS, gh.fetchImpl, () => NOW).summary({ ...DOSSIER, home_repo: '../evil' })).toBeNull();
    expect(gh.fetchImpl).not.toHaveBeenCalled();
  });
});

describe('the cache and the token', () => {
  it('makes no call on a second read within 60 s, and reads again after', async () => {
    let now = NOW;
    const gh = fakeGithub({ inbox: ['0426-prd-page-stage'], issue: ISSUE });
    const reader = githubReader(CREDS, gh.fetchImpl, () => now);
    const first = await reader.summary(DOSSIER);
    const count = gh.fetchImpl.mock.calls.length;
    now += SUMMARY_TTL_MS - 1;
    expect(await reader.summary(DOSSIER)).toEqual(first);
    expect(gh.fetchImpl.mock.calls.length).toBe(count);
    now += 1;
    await reader.summary(DOSSIER);
    expect(gh.fetchImpl.mock.calls.length).toBeGreaterThan(count);
  });

  it('keeps an unreadable answer for 60 s too', async () => {
    const gh = fakeGithub({ installed: false });
    const reader = githubReader(CREDS, gh.fetchImpl, () => NOW);
    await reader.summary(DOSSIER);
    await reader.summary(DOSSIER);
    expect(gh.fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('reuses the installation token until a minute before it expires', async () => {
    let now = NOW;
    const gh = fakeGithub({ inbox: ['0426-prd-page-stage'], issue: ISSUE });
    const reader = githubReader(CREDS, gh.fetchImpl, () => now);
    await reader.summary(DOSSIER);
    now += 30 * 60_000;
    await reader.summary(DOSSIER);
    expect(gh.tokens()).toBe(1);
    now = NOW + 59 * 60_000;
    await reader.summary(DOSSIER);
    expect(gh.tokens()).toBe(2);
    const authorizations = gh.fetchImpl.mock.calls
      .filter(([href]) => String(href).includes('/issues/426'))
      .map(([, init]) => (init.headers as Record<string, string>).authorization);
    expect(authorizations).toEqual(['Bearer ghs_1', 'Bearer ghs_1', 'Bearer ghs_2']);
  });
});
