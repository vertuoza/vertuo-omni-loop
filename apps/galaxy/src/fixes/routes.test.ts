import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FAKE_WORKSPACE, fakeSupabase } from '../dossier/store.fake';
import { sure } from '../arcade/sure';
import { settled as answering } from '../stages/settled';

// The routes of PRD 627, called as the server calls them, reading as the viewer through the stubbed
// client of ../dossier/store.fake.ts: /visual and /bugs list only their kind, /prd only PRDs; a fix's
// page opens on its own route, and each page sends another kind's id to its own route, the query kept.
// PRD 691 s3: the lists read the stored fix facts (the fake store of ../fixes/facts/store.fake.ts) and
// make no GitHub call, which a reader that throws on any call proves; a fix's page stores what it read.

const ADA = { id: '00000000-0000-4000-8000-0000000000a1', email: 'ada@vertuoza.com', name: 'ADA' };
const BOB = { id: '00000000-0000-4000-8000-0000000000b1', email: 'bob@vertuoza.com' };

const given = vi.hoisted(() => ({
  mode: 'supabase',
  token: null as string | null,
  /** The signed-in person's GitHub login, when they signed in with GitHub (issue 674). */
  login: null as string | null,
  fake: null as unknown as ReturnType<typeof import('../dossier/store.fake').fakeSupabase>,
  /** The stored fix facts (PRD 691). */
  facts: null as unknown as import('./facts/store.fake').FakeFixFactsStore,
  /** When set, the GitHub reader throws on any call: nothing may ask it. */
  githubDown: false,
  /** Every GitHub read, in order. */
  githubCalls: [] as string[],
  /** When set, GitHub could not read a fix's approvals this time. */
  approvalsUnread: false,
  /** The tasks the page left for after the response (Next's after()). */
  later: [] as (() => unknown)[],
  roster: null as import('../people/load').RosterRow[] | null,
}));

/** What GitHub says of every fix here (PRD 627, s5): asked by anna, its fix PR open with one approval. */
const summaryOf = (prd: number) => ({
  issue: {
    number: prd, url: `https://github.com/acme/widgets/issues/${prd}`, state: 'open' as const, author: 'anna', createdAt: '2026-09-29T08:00:00Z',
    risk: prd === 571 ? 'omni:risk-high' : null, regression: prd === 571,
  },
  pull: { number: 600, url: 'https://github.com/acme/widgets/pull/600', state: 'open' as const, mergedAt: null, mergedBy: null },
  approvals: [{ login: 'carla', at: '2026-09-29T11:00:00Z' }],
  release: null,
});

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', async (original) => ({
  ...(await original<typeof import('next/navigation')>()),
  useRouter: () => ({ refresh: () => {} }),
  usePathname: () => '/visual',
}));
vi.mock('next/server', async (original) => ({
  ...(await original<typeof import('next/server')>()),
  after: (task: () => unknown) => { given.later.push(task); },
}));
const githubRead = (what: string) => {
  given.githubCalls.push(what);
  if (given.githubDown) throw new Error(`GitHub was asked: ${what}`);
};
vi.mock('../dossier/github/server', () => ({
  dossierGithub: () => ({
    summary: vi.fn(() => answering(() => { githubRead('summary'); return null; })),
    fix: vi.fn(({ prd }: { prd: number }) => answering(() => { githubRead(`fix ${prd}`);
      return given.approvalsUnread ? { ...summaryOf(prd), approvals: 'unread' } : summaryOf(prd);
    })),
  }),
}));
vi.mock('./facts/store', async (original) => ({
  ...(await original<typeof import('./facts/store')>()),
  fixFactsStore: () => given.facts,
}));
vi.mock('../data/sign-in-live', () => ({ serviceDb: () => ({}) }));
// PRD 652, s6: the people directory, read for real (the fake has no roster, so it falls back to GitHub
// photos) unless a test hands one in.
vi.mock('../people/load', async (original) => {
  const real = await original<typeof import('../people/load')>();
  return { ...real, loadPeople: vi.fn(async (db: never, workspace: string) => (given.roster ? real.peopleOf(given.roster, []) : real.loadPeople(db, workspace))) };
});
vi.mock('../data/mode', () => ({ arcadeMode: () => given.mode }));
vi.mock('../data/supabase-server', () => ({
  supabaseEnv: () => (given.mode === 'supabase' ? { url: 'http://127.0.0.1:54321', key: 'anon' } : null),
  supabaseServer: async () => {
    const client = given.fake.client(given.token ?? 'signed-out');
    const user = given.token ? await client.auth.getUser(given.token) : { data: { user: null } };
    const github = given.login ? [{ provider: 'github', identity_data: { user_name: given.login } }] : undefined;
    const signedIn = user.data.user ? { data: { user: { ...user.data.user, identities: github } } } : user;
    // The claims a GitHub sign-in carries: its login in user_metadata, the provider in app_metadata.
    const meta = given.login ? { user_metadata: { user_name: given.login }, app_metadata: { provider: 'github', providers: ['github'] } } : {};
    const claims = user.data.user ? { claims: { sub: user.data.user.id, email: user.data.user.email, ...meta } } : null;
    return { ...client, auth: { getUser: () => Promise.resolve(signedIn), getClaims: () => Promise.resolve({ data: claims, error: null }) } };
  },
}));

const { default: VisualList } = await import('../../app/visual/page.tsx');
const { default: BugList } = await import('../../app/bugs/page.tsx');
const { default: PrdList } = await import('../../app/prd/page.tsx');
const { default: VisualPage } = await import('../../app/visual/[id]/page.tsx');
const { default: BugPage } = await import('../../app/bugs/[id]/page.tsx');
const { default: PrdPage } = await import('../../app/prd/[id]/page.tsx');
const { GET: roundRoute } = await import('../../app/visual/[id]/r/[round]/page/route.ts');
const { settledPage } = await import('../dossier/page/stream/settled');
const { fakeFixFactsStore } = await import('./facts/store.fake');

let prd = '';
let visual = '';
let bug = '';

const push = async (who: string, args: Record<string, unknown>) =>
  ((await given.fake.client(who).rpc('dossier_push', { p_repo: 'acme/widgets', p_draft: null, ...args })).data as { id: string }).id;

beforeEach(async () => {
  given.mode = 'supabase';
  given.token = 'bob';
  given.roster = null;
  given.login = null;
  given.fake = fakeSupabase({ ada: ADA, bob: BOB }, { [FAKE_WORKSPACE]: 'acme' });
  given.facts = fakeFixFactsStore(() => '2026-09-29T12:00:00Z');
  given.githubDown = false;
  given.githubCalls = [];
  given.approvalsUnread = false;
  given.later = [];
  prd = await push('ada', { p_prd: 7, p_title: 'Team inbox', p_artifacts: [{ kind: 'spec', content: '# Team inbox\n' }] });
  visual = await push('bob', {
    p_prd: 548, p_kind: 'visual', p_title: 'Darker sidebar',
    p_artifacts: [{ kind: 'before-after', content: '<title>after</title>' }, { kind: 'variations', content: '<title>round one</title>' }],
  });
  bug = await push('ada', { p_prd: 571, p_kind: 'bug', p_title: 'Ask page crash', p_artifacts: [{ kind: 'bug-record', content: '# Crash\n' }] });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); });

const query = (q: Record<string, string> = {}) => Promise.resolve(q);
const list = async (route: (p: { searchParams: Promise<Record<string, string>> }) => unknown, q: Record<string, string> = {}) =>
  renderToStaticMarkup(await settledPage(await route({ searchParams: query(q) }) as ReactElement));
const page = async (route: (p: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) => unknown, id: string, q: Record<string, string> = {}) =>
  renderToStaticMarkup(await settledPage(await route({ params: Promise.resolve({ id }), searchParams: query(q) }) as ReactElement));
const redirectTo = (path: string) => {
  const digest: unknown = expect.stringContaining(`;${path};`);
  return { digest };
};

/** Stores what GitHub says of each fix, as the stages sync would have. */
const stored = (...fixes: [string, number][]) => given.facts.writeFacts(fixes.map(([id, n]) => ({ dossier_id: id, workspace_id: FAKE_WORKSPACE, facts: summaryOf(n) })));

describe('the lists', () => {
  beforeEach(async () => {
    await stored([visual, 548], [bug, 571]);
    given.githubDown = true;
  });
  afterEach(() => { expect(given.githubCalls).toEqual([]); });

  it('/visual lists the visual fixes only, Mine by default', async () => {
    const mine = await list(VisualList);
    expect(mine).toContain('<h1 class="dossier-title">Visual Updates</h1>');
    expect(mine).toContain(`href="/visual/${visual}"`);
    expect(mine).toContain('#548');
    expect(mine).not.toContain('Ask page crash');
    expect(mine).not.toContain('Team inbox');
    expect(mine).toContain('<span class="fix-state fix-state-in-review">In review</span>');
    // PRD 652, s6: who asked wears a face; with no roster to read, the GitHub photo.
    expect(mine).toContain('asked by <span class="person-chip is-inline"><img class="person-face is-photo" src="https://github.com/anna.png?size=48" alt=""');
    expect(mine.replace(/<[^>]+>/g, '')).toContain('asked by @anna');
    expect(mine).not.toContain('regression');
  });

  it('draws who asked from the directory of the fix\'s workspace (PRD 652, s6)', async () => {
    const { loadPeople } = await import('../people/load');
    given.roster = [{ user_id: 'u-anna', name: 'Anna', github_login: 'anna', avatar_url: null, fleet: null, hero: { v: 1, body: 'girl', skin: 2, hair: 3, suit: 0, cape: 8 } }];
    const mine = await list(VisualList);
    expect(mine).toMatch(/asked by <span class="person-chip is-inline"><span class="person-face is-hero" aria-hidden="true"><svg /);
    expect(loadPeople).toHaveBeenLastCalledWith(expect.anything(), FAKE_WORKSPACE);
  });

  it('keeps under Mine a fix someone else pushed whose issue the viewer opened on GitHub (issue 674)', async () => {
    given.token = 'ada';
    expect(await list(VisualList)).toContain('You have not asked for a visual update yet.');
    given.login = 'Anna';
    expect(await list(VisualList)).toContain(`href="/visual/${visual}"`);
  });

  it('shows a bug fix\'s risk label and regression badge, and filters by state', async () => {
    const all = await list(BugList, { who: 'all' });
    expect(all).toContain('<span class="fix-badge">omni:risk-high</span>');
    expect(all).toContain('<span class="fix-badge fix-badge-regression">regression</span>');
    expect(await list(BugList, { who: 'all', state: 'merged' })).toContain('No bug fix matches');
    expect(await list(BugList, { who: 'all', state: 'in-review' })).toContain(`href="/bugs/${bug}"`);
  });

  it('/bugs lists the bug fixes only, under All when the viewer pushed none', async () => {
    expect(await list(BugList)).toContain('You have not asked for a bug fix yet.');
    const all = await list(BugList, { who: 'all' });
    expect(all).toContain(`href="/bugs/${bug}"`);
    expect(all).not.toContain('Darker sidebar');
  });

  it('/prd lists the PRDs only', async () => {
    const all = await list(PrdList, { who: 'all' });
    expect(all).toContain(`href="/prd/${prd}"`);
    expect(all).not.toContain('Darker sidebar');
    expect(all).not.toContain('Ask page crash');
  });

  describe('one person\'s rows, who=<login> (PRD 698)', () => {
    beforeEach(() => {
      given.fake.seedPlayer(ADA.id, { login: 'Ada-GH' });
      given.fake.seedPlayer(BOB.id, { login: 'bob-gh' });
    });

    it('/prd keeps the PRDs that person opened, read through their account in the viewer\'s workspace', async () => {
      const ada = await list(PrdList, { who: 'ada-gh' });
      expect(ada).toContain(`href="/prd/${prd}"`);
      expect(ada).toContain('Opened by <a href="/app/people/ada-gh">@ada-gh</a>');
      expect(ada).not.toContain('aria-current="page"');
      expect(await list(PrdList, { who: 'bob-gh' })).toContain('@bob-gh has not opened a PRD here.');
      expect(await list(PrdList, { who: 'stranger' })).toContain('@stranger has not opened a PRD here.');
    });

    it('/bugs keeps the fixes that person pushed, or whose issue they opened', async () => {
      const ada = await list(BugList, { who: 'ada-gh' });
      expect(ada).toContain(`href="/bugs/${bug}"`);
      expect(ada).toContain('Asked by <a href="/app/people/ada-gh">@ada-gh</a>');
      expect(await list(BugList, { who: 'bob-gh' })).toContain('@bob-gh has not asked for a bug fix here.');
      // Every issue here was opened by @anna, who holds no account: her issues still count.
      expect(await list(BugList, { who: 'anna' })).toContain(`href="/bugs/${bug}"`);
    });

    it('/visual keeps the fixes that person asked for, whoever reads it', async () => {
      const bob = await list(VisualList, { who: 'bob-gh' });
      expect(bob).toContain(`href="/visual/${visual}"`);
      expect(bob).toContain('Asked by <a href="/app/people/bob-gh">@bob-gh</a>');
      given.token = 'ada';
      expect(await list(VisualList, { who: 'bob-gh' })).toContain(`href="/visual/${visual}"`);
      expect(await list(VisualList, { who: 'ada-gh' })).toContain('@ada-gh has not asked for a visual update here.');
    });

    it('keeps who=mine and who=all as they were', async () => {
      expect(await list(VisualList, { who: 'mine' })).toContain(`href="/visual/${visual}"`);
      expect(await list(BugList, { who: 'mine' })).toContain('You have not asked for a bug fix yet.');
      expect(await list(PrdList, { who: 'all' })).toContain(`href="/prd/${prd}"`);
      expect(await list(PrdList, { who: 'mine' })).toContain('You have not opened a PRD yet.');
    });
  });

  it('asks someone signed out to sign in, coming back to the list', async () => {
    given.token = null;
    expect(await list(VisualList)).toContain('Sign in to see your workspace&#x27;s visual updates');
  });

  it('reads the stored facts of the workspace\'s fixes in one read (PRD 691)', async () => {
    given.facts.reads = [];
    await list(BugList, { who: 'all' });
    expect(given.facts.reads).toEqual([`${FAKE_WORKSPACE} 1`]);
  });

  it('shows `—` for a fix with no stored facts yet, and keeps it under Mine for who pushed it (PRD 691)', async () => {
    given.facts.rows = [];
    const mine = await list(VisualList);
    expect(mine).toContain(`href="/visual/${visual}"`);
    expect(mine).toContain('<span class="fix-state fix-state-unknown">—</span>');
    expect(mine).not.toContain('asked by @anna');
    given.token = 'ada';
    given.login = 'Anna';
    expect(await list(VisualList)).toContain('You have not asked for a visual update yet.');
  });

  it('shows the lists as the database has them when the stored facts cannot be read (PRD 691)', async () => {
    given.facts.fail = 'down';
    const all = await list(BugList, { who: 'all' });
    expect(all).toContain(`href="/bugs/${bug}"`);
    expect(all).toContain('<span class="fix-state fix-state-unknown">—</span>');
  });
});

describe('the lists\' frame (PRD 691)', () => {
  const GALAXY = join(import.meta.dirname, '..', '..');
  const source = (path: string) => readFileSync(join(GALAXY, path), 'utf8');

  it.each(['app/bugs', 'app/visual'])('%s has a loading.tsx that draws the list\'s skeleton', (route) => {
    const file = join(GALAXY, route, 'loading.tsx');
    expect(existsSync(file), `${route}/loading.tsx`).toBe(true);
    expect(source(`${route}/loading.tsx`)).toMatch(/export default function/);
    expect(source(`${route}/loading.tsx`)).toMatch(/src\/skeleton\//);
  });

  it('draws each list\'s own heading while it starts', async () => {
    const { default: BugsLoading } = await import('../../app/bugs/loading.tsx');
    const { default: VisualLoading } = await import('../../app/visual/loading.tsx');
    const bugs = renderToStaticMarkup(createElement(BugsLoading));
    expect(bugs).toContain('<h1 class="dossier-title">Bug Fixes</h1>');
    expect(bugs).toContain('Loading bug fixes…');
    expect(bugs).toContain('aria-busy="true"');
    expect(renderToStaticMarkup(createElement(VisualLoading))).toContain('<h1 class="dossier-title">Visual Updates</h1>');
  });

  it('reads the user through viewer(), never auth.getUser', () => {
    const route = source('src/fixes/FixListRoute.tsx');
    expect(route).not.toMatch(/getUser/);
    expect(route).toMatch(/dossierSession|viewer\(\)/);
  });
});

describe('a fix\'s page', () => {
  it('opens a visual fix on /visual/<id>, and a bug fix on /bugs/<id>', async () => {
    expect(await page(VisualPage, visual)).toContain('<span class="dossier-kind">Visual</span>');
    const record = await page(BugPage, bug);
    expect(record).toContain('<span class="dossier-kind">Bug</span>');
    expect(await page(BugPage, bug, { tab: 'bug-record' })).toContain('<h1>Crash</h1>');
  });

  it('opens a fix on its Timeline, with its state and its issue and PR in the header', async () => {
    const html = await page(VisualPage, visual);
    expect(html).toContain('<ol class="fix-timeline" aria-label="Timeline">');
    expect(html).toContain('<dt>State</dt><dd><span class="fix-state fix-state-in-review">In review</span></dd>');
    expect(html).toContain('href="https://github.com/acme/widgets/pull/600"');
    expect(html).toContain('<span>by <span class="person-chip is-inline"><img class="person-face is-photo" src="https://github.com/anna.png?size=48" alt=""');
    expect(html.replace(/<[^>]+>/g, '')).toContain('by @anna');
    // The two before/after pages already merged carry no pick line.
    expect(html).toMatch(/<span class="fix-moment-label">Picked<\/span> <span class="ask-hint">not recorded<\/span>/);
    expect(await page(BugPage, bug)).not.toContain('Picked');
  });

  it('sends a fix opened on /prd/<id> to its own route, the query kept', async () => {
    await expect(page(PrdPage, visual, { tab: 'variations' })).rejects.toMatchObject(redirectTo(`/visual/${visual}?tab=variations`));
    await expect(page(PrdPage, bug)).rejects.toMatchObject(redirectTo(`/bugs/${bug}`));
  });

  it('sends a PRD opened on a fix route to /prd/<id>, and a fix on the other fix route to its own', async () => {
    await expect(page(VisualPage, prd)).rejects.toMatchObject(redirectTo(`/prd/${prd}`));
    await expect(page(BugPage, prd, { tab: 'spec' })).rejects.toMatchObject(redirectTo(`/prd/${prd}?tab=spec`));
    await expect(page(BugPage, visual)).rejects.toMatchObject(redirectTo(`/visual/${visual}`));
  });

  it('stores what it read of the fix, after the response (PRD 691)', async () => {
    const html = await page(BugPage, bug);
    expect(html).toContain('<dt>State</dt>');
    expect(given.facts.rows).toEqual([]);
    expect(given.later).toHaveLength(1);
    await sure(given.later[0], 'given.later[0]')();
    expect(given.facts.rows).toEqual([{ dossier_id: bug, workspace_id: FAKE_WORKSPACE, facts: summaryOf(571), synced_at: '2026-09-29T12:00:00Z' }]);
  });

  it('keeps a stored part GitHub could not read this time (PRD 691)', async () => {
    await stored([visual, 548]);
    given.approvalsUnread = true;
    await page(VisualPage, visual);
    await sure(given.later[0], 'given.later[0]')();
    expect(sure(given.facts.rows[0], 'given.facts.rows[0]').facts.approvals).toEqual(summaryOf(548).approvals);
  });

  it('only logs a write it could not make (PRD 691)', async () => {
    given.facts.fail = 'down';
    await page(VisualPage, visual);
    await expect(Promise.resolve(sure(given.later[0], 'given.later[0]')())).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });

  it('stores nothing when GitHub could not be read (PRD 691)', async () => {
    given.githubDown = true;
    await page(VisualPage, visual);
    expect(given.later).toEqual([]);
  });

  it('serves a round of variations sandboxed, to a member only', async () => {
    const served = await roundRoute(new Request('http://x') as never, { params: Promise.resolve({ id: visual, round: '1' }) });
    expect(served.status).toBe(200);
    expect(await served.text()).toBe('<title>round one</title>');
    expect(served.headers.get('content-security-policy')).toContain('sandbox allow-scripts');
    given.token = null;
    expect((await roundRoute(new Request('http://x') as never, { params: Promise.resolve({ id: visual, round: '1' }) })).status).toBe(404);
  });
});
