import { type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FAKE_WORKSPACE, fakeSupabase } from '../dossier/store.fake';

// The routes of PRD 627, called as the server calls them, reading as the viewer through the stubbed
// client of ../dossier/store.fake.ts: /visual and /bugs list only their kind, /prd only PRDs; a fix's
// page opens on its own route, and each page sends another kind's id to its own route, the query kept.

const ADA = { id: '00000000-0000-4000-8000-0000000000a1', email: 'ada@vertuoza.com', name: 'ADA' };
const BOB = { id: '00000000-0000-4000-8000-0000000000b1', email: 'bob@vertuoza.com' };

const given = vi.hoisted(() => ({
  mode: 'supabase' as 'demo' | 'closed' | 'supabase',
  token: null as string | null,
  fake: null as unknown as ReturnType<typeof import('../dossier/store.fake').fakeSupabase>,
}));

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', async (original) => ({
  ...(await original<typeof import('next/navigation')>()),
  useRouter: () => ({ refresh: () => {} }),
  usePathname: () => '/visual',
}));
// What GitHub says of every fix here (PRD 627, s5): asked by anna, its fix PR open with one approval.
vi.mock('../dossier/github/server', () => ({
  dossierGithub: () => ({
    summary: vi.fn(async () => null),
    fix: vi.fn(async ({ prd }: { prd: number }) => ({
      issue: {
        number: prd, url: `https://github.com/acme/widgets/issues/${prd}`, state: 'open', author: 'anna', createdAt: '2026-09-29T08:00:00Z',
        risk: prd === 571 ? 'omni:risk-high' : null, regression: prd === 571,
      },
      pull: { number: 600, url: 'https://github.com/acme/widgets/pull/600', state: 'open', mergedAt: null, mergedBy: null },
      approvals: [{ login: 'carla', at: '2026-09-29T11:00:00Z' }],
      release: null,
    })),
  }),
}));
vi.mock('../data/mode', () => ({ arcadeMode: () => given.mode }));
vi.mock('../data/supabase-server', () => ({
  supabaseEnv: () => (given.mode === 'supabase' ? { url: 'http://127.0.0.1:54321', key: 'anon' } : null),
  supabaseServer: async () => {
    const client = given.fake.client(given.token ?? 'signed-out');
    const user = given.token ? await client.auth.getUser(given.token) : { data: { user: null } };
    return { ...client, auth: { getUser: async () => user } };
  },
}));

const { default: VisualList } = await import('../../app/visual/page.tsx');
const { default: BugList } = await import('../../app/bugs/page.tsx');
const { default: PrdList } = await import('../../app/prd/page.tsx');
const { default: VisualPage } = await import('../../app/visual/[id]/page.tsx');
const { default: BugPage } = await import('../../app/bugs/[id]/page.tsx');
const { default: PrdPage } = await import('../../app/prd/[id]/page.tsx');
const { GET: roundRoute } = await import('../../app/visual/[id]/r/[round]/page/route.ts');

let prd = '';
let visual = '';
let bug = '';

const push = async (who: string, args: Record<string, unknown>) =>
  ((await given.fake.client(who).rpc('dossier_push', { p_repo: 'acme/widgets', p_draft: null, ...args })).data as { id: string }).id;

beforeEach(async () => {
  given.mode = 'supabase';
  given.token = 'bob';
  given.fake = fakeSupabase({ ada: ADA, bob: BOB }, { [FAKE_WORKSPACE]: 'acme' });
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
  renderToStaticMarkup((await route({ searchParams: query(q) })) as ReactElement);
const page = async (route: (p: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) => unknown, id: string, q: Record<string, string> = {}) =>
  renderToStaticMarkup((await route({ params: Promise.resolve({ id }), searchParams: query(q) })) as ReactElement);
const redirectTo = (path: string) => ({ digest: expect.stringContaining(`;${path};`) });

describe('the lists', () => {
  it('/visual lists the visual fixes only, Mine by default', async () => {
    const mine = await list(VisualList);
    expect(mine).toContain('<h1 class="dossier-title">Visual Updates</h1>');
    expect(mine).toContain(`href="/visual/${visual}"`);
    expect(mine).toContain('#548');
    expect(mine).not.toContain('Ask page crash');
    expect(mine).not.toContain('Team inbox');
    expect(mine).toContain('<span class="fix-state fix-state-in-review">In review</span>');
    expect(mine).toContain('asked by @anna');
    expect(mine).not.toContain('regression');
  });

  it('shows a bug fix\'s risk label and regression badge, and filters by state', async () => {
    const all = await list(BugList, { who: 'all' });
    expect(all).toContain('<span class="fix-badge">omni:risk-high</span>');
    expect(all).toContain('<span class="fix-badge fix-badge-regression">regression</span>');
    expect(await list(BugList, { who: 'all', state: 'merged' })).toContain('No bug fix matches');
    expect(await list(BugList, { who: 'all', state: 'in-review' })).toContain(`href="/bugs/${bug}"`);
  });

  it('/bugs lists the bug fixes only, under All when the viewer pushed none', async () => {
    expect(await list(BugList)).toContain('You have not pushed a bug fix yet.');
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

  it('asks someone signed out to sign in, coming back to the list', async () => {
    given.token = null;
    expect(await list(VisualList)).toContain('Sign in to see your workspace&#x27;s visual updates');
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
    expect(html).toContain('<span>by @anna</span>');
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

  it('serves a round of variations sandboxed, to a member only', async () => {
    const served = await roundRoute(new Request('http://x') as never, { params: Promise.resolve({ id: visual, round: '1' }) });
    expect(served.status).toBe(200);
    expect(await served.text()).toBe('<title>round one</title>');
    expect(served.headers.get('content-security-policy')).toContain('sandbox allow-scripts');
    given.token = null;
    expect((await roundRoute(new Request('http://x') as never, { params: Promise.resolve({ id: visual, round: '1' }) })).status).toBe(404);
  });
});
