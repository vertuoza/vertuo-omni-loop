import { readFileSync } from 'node:fs';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeStageStore } from '../../stages/store.fake';
import { FAKE_WORKSPACE, fakeSupabase } from '../store.fake';
import { signature } from './live';
import { LiveRefresh } from './live-refresh';
import { SANDBOX_CSP } from './sandbox';

// /prd/<id> and its sandboxed route (PRD 216), called as the server calls them, reading as the viewer
// through the stubbed client of ../store.fake.ts (the migration's access rules): a member reads the
// dossier, anyone else — another workspace, signed out after signing in — gets not found.

const ADA = { id: '00000000-0000-4000-8000-0000000000a1', email: 'ada@vertuoza.com', name: 'ADA' };
const BOB = { id: '00000000-0000-4000-8000-0000000000b1', email: 'bob@vertuoza.com' };
const OTHER = '00000000-0000-4000-8000-00000000aced';
const CARL = { id: '00000000-0000-4000-8000-0000000000c1', email: 'carl@vertuoza.com', workspaces: [OTHER] };
const SPEC = '---\nprd: 7\ntitle: Team inbox\n---\n\n# Team inbox\n\n<b>raw</b>\n';
const PAGE = '<!doctype html><title>After</title><script>document.title = "ran"</script>';

const given = vi.hoisted(() => ({
  mode: 'supabase' as 'demo' | 'closed' | 'supabase',
  token: null as string | null,
  fake: null as unknown as ReturnType<typeof import('../store.fake').fakeSupabase>,
  path: '/prd',
  // The GitHub reader (PRD 426), stubbed: the tests never call GitHub.
  summary: null as unknown as import('vitest').Mock,
  // The stored stages (PRD 587), in memory.
  stages: null as unknown as import('../../stages/store.fake').FakeStageStore,
}));

vi.mock('server-only', () => ({}));
// The page's change check (PRD 384) refreshes through the app router, which a static render has none of.
vi.mock('next/navigation', async (original) => ({
  ...(await original<typeof import('next/navigation')>()),
  useRouter: () => ({ refresh: () => {} }),
  usePathname: () => given.path,
}));
vi.mock('../github/server', () => ({ dossierGithub: () => ({ summary: given.summary }) }));
vi.mock('../../stages/store', async (original) => ({
  ...(await original<typeof import('../../stages/store')>()),
  stageStore: () => given.stages,
}));
vi.mock('../../data/mode', () => ({ arcadeMode: () => given.mode }));
vi.mock('../../data/supabase-server', () => ({
  supabaseEnv: () => (given.mode === 'supabase' ? { url: 'http://127.0.0.1:54321', key: 'anon' } : null),
  supabaseServer: async () => {
    const client = given.fake.client(given.token ?? 'signed-out');
    const user = given.token ? await client.auth.getUser(given.token) : { data: { user: null } };
    const claims = user.data.user ? { claims: { sub: user.data.user.id, email: user.data.user.email } } : null;
    return { ...client, auth: { getUser: async () => user, getClaims: async () => ({ data: claims, error: null }) } };
  },
}));

const { default: Page } = await import('../../../app/prd/[id]/page.tsx');
const { default: HistoryPage } = await import('../../../app/prd/page.tsx');
const { default: Layout } = await import('../../../app/prd/layout.tsx');
const { GET: sandboxRoute } = await import('../../../app/prd/[id]/v/[version]/page/route.ts');

let numbered = '';
let draft = '';

beforeEach(async () => {
  given.mode = 'supabase';
  given.token = null;
  given.fake = fakeSupabase({ ada: ADA, bob: BOB, carl: CARL }, { [FAKE_WORKSPACE]: 'acme', [OTHER]: 'other' });
  draft = (await given.fake.client('ada').rpc('dossier_open', { p_title: 'An idea', p_repo: 'acme/widgets', p_claude_session_id: null })).data as string;
  const pushed = await given.fake.client('ada').rpc('dossier_push', {
    p_repo: 'acme/widgets', p_prd: 7, p_title: 'Team inbox', p_draft: null,
    p_artifacts: [{ kind: 'spec', content: SPEC }, { kind: 'before-after', content: PAGE }],
  });
  numbered = (pushed.data as { id: string }).id;
  given.summary = vi.fn(async () => null);
  given.stages = fakeStageStore();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); });

const open = async (id: string, query: Record<string, string> = {}) =>
  (await Page({ params: Promise.resolve({ id }), searchParams: Promise.resolve(query) })) as ReactElement;
const html = async (id: string, query: Record<string, string> = {}) => renderToStaticMarkup(await open(id, query));
const notFound = { digest: expect.stringContaining('404') };

describe('the page to share', () => {
  it('shows a member of the workspace the dossier', async () => {
    given.token = 'bob';
    const page = await html(numbered);
    expect(page).toContain('<a class="dossier-number" href="https://github.com/acme/widgets/issues/7" target="_blank" rel="noopener noreferrer">PRD #7 ↗</a>');
    expect(page).toContain('Team inbox');
    expect(page).toContain('<li class="dossier-repo">acme/widgets</li>');
    expect(page).toContain('opened by ADA · ');
    expect(page).toContain(`src="/prd/${numbered}/v/1/page"`);
    expect(page).toContain('sandbox="allow-scripts"');
  });

  it('chips every repository of the dossier: its home, and for a PRD of the plan repository its planet\'s regions', async () => {
    given.fake.seedPlanet({ planRepo: 'widgets', prd: 7, regions: ['core', 'web'] });
    given.token = 'bob';
    expect(await html(numbered)).toContain(
      '<ul class="dossier-repos" aria-label="Repositories"><li class="dossier-repo">acme/widgets</li><li class="dossier-repo">acme/core</li><li class="dossier-repo">acme/web</li></ul>',
    );
  });

  it('renders the Spec tab\'s markdown, raw HTML as text, the front matter above', async () => {
    given.token = 'bob';
    const page = await html(numbered, { tab: 'spec' });
    expect(page).toContain('<p class="dossier-front">prd: 7 · title: Team inbox</p>');
    expect(page).toContain('<h1>Team inbox</h1>');
    expect(page).toContain('&lt;b&gt;raw&lt;/b&gt;');
  });

  it('shows a member the questions asked while the PRD was delivered, answered out of asked in the tab', async () => {
    const later = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();
    given.fake.seedAsk({ owner: ADA.id, repo: 'Acme/Widgets', branch: 'feat/team-inbox--s2' }, [
      { created_at: later(1), prd: 7, status: 'answered', answers: { 'A question?': 'Yes' }, answered_via: 'terminal', answered_by: ADA.id, answered_at: later(3) },
      { created_at: later(4), prd: 7 },
      { created_at: later(5), prd: 8 },
    ]);
    given.token = 'bob';
    const page = await html(numbered, { tab: 'questions' });
    expect(page).toContain('Questions<small>1/2</small><span class="dossier-left">1 to answer</span>');
    expect([...page.matchAll(/<span class="dossier-rule">([a-z]+)<\/span>/g)].map((m) => m[1])).toEqual(['delivery', 'delivery']);
    expect(page).toContain('answered by ADA after 2 min 0 s, in the terminal');
    expect(page).toContain('not answered yet');
    given.token = 'carl';
    await expect(open(numbered, { tab: 'questions' })).rejects.toMatchObject(notFound);
  });

  it('decides on the server who may answer a quick round on the list: its owner and a member it is shared with (PRD 384)', async () => {
    const quick = [{ question: 'Ship it?', header: '', multiSelect: false, options: [{ label: 'Yes', description: '' }, { label: 'No', description: '' }] }];
    const { rounds: [round] } = given.fake.seedAsk({ owner: ADA.id, repo: 'acme/widgets' }, [
      { created_at: new Date(Date.now() - 60_000).toISOString(), prd: 7, questions: quick },
    ]);
    const buttons = (page: string) => [...page.matchAll(/class="dossier-quick-choice"[^>]*><span class="dossier-option-label">([^<]+)/g)].map((m) => m[1]);

    given.token = 'ada';
    const owner = await html(numbered, { tab: 'questions' });
    expect(buttons(owner)).toEqual(['Yes', 'No']);
    expect(owner).toContain(`<li id="${round.id}" class="dossier-round"`);

    given.token = 'bob';
    const other = await html(numbered, { tab: 'questions' });
    expect(buttons(other)).toEqual([]);
    expect(other).toContain('Waiting for ADA');

    given.fake.seedShare(round.id, BOB.id, ADA.id);
    expect(buttons(await html(numbered, { tab: 'questions' }))).toEqual(['Yes', 'No']);
  });

  it('shows the questions of the brainstorm that opened a draft, in its Claude session', async () => {
    const opened = (await given.fake.client('ada').rpc('dossier_open', { p_title: 'Offline quotes', p_repo: 'acme/widgets', p_claude_session_id: 'sess-a' })).data as string;
    given.fake.seedAsk({ owner: ADA.id, repo: 'acme/widgets', claudeSessionId: 'sess-a' }, [{ created_at: new Date(Date.now() + 60_000).toISOString() }]);
    given.token = 'bob';
    const page = await html(opened, { tab: 'questions' });
    expect(page).toContain('<span class="dossier-rule">brainstorm</span>');
    expect(page).toContain('Questions<small>0/1</small><span class="dossier-left">1 to answer</span>');
    expect(await html(draft, { tab: 'questions' })).toContain('No question yet.');
  });

  it('still shows the dossier when its questions cannot be read', async () => {
    const client = given.fake.client('bob');
    given.fake = { ...given.fake, client: () => ({ ...client, rpc: (name: string, args: Record<string, unknown>) =>
      name === 'dossier_rounds' ? Promise.resolve({ data: null, error: { message: 'down' } }) : client.rpc(name, args) }) } as never;
    given.token = 'bob';
    const page = await html(numbered, { tab: 'questions' });
    expect(page).toContain('PRD #7');
    expect(page).toContain('The questions could not be read.');
  });

  it('refreshes itself: a member\'s page carries the change check, starting from the signature it was rendered with', async () => {
    given.fake.seedAsk({ owner: ADA.id, repo: 'acme/widgets' }, [
      { created_at: new Date(Date.now() + 60_000).toISOString(), prd: 7, status: 'answered', answered_at: new Date(Date.now() + 120_000).toISOString() },
      { created_at: new Date(Date.now() + 180_000).toISOString(), prd: 7 },
    ]);
    given.token = 'bob';
    const page = await open(numbered, { tab: 'spec', v: '1' });
    const live = (page.props as { live?: ReactElement }).live;
    expect(live?.type).toBe(LiveRefresh);
    expect(live?.props).toEqual({
      supabase: { url: 'http://127.0.0.1:54321', key: 'anon' },
      id: numbered,
      // The GitHub part the page was rendered with (no reader here: unknown) is part of the start.
      signature: signature({ asked: 2, answered: 1, latest: { spec: 1, 'before-after': 1 }, github: { stage: 'unknown', open: null, answers: null } }),
    });
    const markup = renderToStaticMarkup(page);
    expect(markup).not.toContain('Cannot reach the server');
  });

  it('starts the change check with no signature when the questions could not be read: its first read sets it', async () => {
    const client = given.fake.client('bob');
    given.fake = { ...given.fake, client: () => ({ ...client, rpc: (name: string, args: Record<string, unknown>) =>
      name === 'dossier_rounds' ? Promise.resolve({ data: null, error: { message: 'down' } }) : client.rpc(name, args) }) } as never;
    given.token = 'bob';
    const live = ((await open(numbered)).props as { live?: ReactElement<{ signature: string | null }> }).live;
    expect(live?.props.signature).toBeNull();
  });

  it('says an artifact with no version yet has none', async () => {
    given.token = 'bob';
    expect(await html(numbered, { tab: 'plan' })).toContain('The plan has no version yet.');
  });

  it('offers the opener of a draft Delete draft, and nobody else', async () => {
    given.token = 'ada';
    const mine = await html(draft);
    expect(mine).toContain('<span class="dossier-draft">DRAFT</span>');
    expect(mine).toContain('Delete draft');
    given.token = 'bob';
    expect(await html(draft)).not.toContain('Delete draft');
    given.token = 'ada';
    expect(await html(numbered)).not.toContain('Delete draft');
  });

  it('is not found for a member of another workspace', async () => {
    given.token = 'carl';
    await expect(open(numbered)).rejects.toMatchObject(notFound);
    await expect(open(draft)).rejects.toMatchObject(notFound);
  });

  it('is not found for a dossier that never was, or an id that is none', async () => {
    given.token = 'bob';
    await expect(open('00000000-0000-4000-8000-00000000ffff')).rejects.toMatchObject(notFound);
    await expect(open('not-a-dossier')).rejects.toMatchObject(notFound);
  });

  it('asks someone signed out to sign in, coming back to the same dossier', async () => {
    const page = await html(numbered, { signin_error: 'Not allowed' });
    expect(page).toContain('Sign in to read this PRD');
    expect(page).toContain('Not allowed');
    expect(page).not.toContain('Team inbox');
  });

  it('says a draft its opener deleted is gone, and a dossier still there is still shown', async () => {
    given.token = 'ada';
    await given.fake.client('ada').from('dossiers').delete().eq('id', draft).select('id');
    expect(await html(draft, { deleted: '1' })).toContain('Draft deleted');
    await expect(open(draft)).rejects.toMatchObject(notFound);
    expect(await html(numbered, { deleted: '1' })).toContain('PRD #7');
  });

  it('says the database could not answer when it fails, turning nobody away as an outsider', async () => {
    given.token = 'bob';
    given.fake.state.fail = { message: 'down' };
    expect(await html(numbered)).toContain('The dossier database could not answer');
  });

  it('says dossiers are not open in a build without a database', async () => {
    given.mode = 'closed';
    expect(await html(numbered)).toContain('PRD dossiers are not open here');
  });

  it('plays the demo dossier in development, without a database', async () => {
    given.mode = 'demo';
    const page = await html('anything');
    expect(page).toContain('PRD #71');
    expect(page).not.toContain('Delete draft');
    expect(await html('anything', { tab: 'spec' })).toContain('<p class="dossier-front">');
    const questions = await html('anything', { tab: 'questions' });
    expect(questions).toContain('<span class="dossier-rule">brainstorm</span>');
    expect(questions).toContain('<span class="dossier-rule">delivery</span>');
    expect(questions).toMatch(/Questions<small>\d+\/\d+( answered)?<\/small>/);
    expect(((await open('anything')).props as { live?: unknown }).live).toBeUndefined();
  });
});

describe('the stage, stored (PRD 587), with its button read from GitHub (PRD 426)', () => {
  const inbox = {
    repo: 'acme/widgets', prd: 7, folder: '0007-team-inbox', topic: 'team-inbox',
    issue: { number: 7, url: 'https://github.com/acme/widgets/issues/7', state: 'open' },
    phase0: { number: 12, url: 'https://github.com/acme/widgets/pull/12', state: 'merged', draft: false },
    feature: null, retro: null, mergedSlices: 0,
  };

  const stored = (stage: 'inbox' | 'shipped') =>
    given.stages.recordStages([{ workspace_id: FAKE_WORKSPACE, repository: 'acme/widgets', prd: 7, stage, reached_at: '2026-09-28T10:00:00Z' }], '2026-09-29T09:15:00Z');

  it('reads the stored stage and GitHub for a signed-in member on a numbered dossier, and shows its stage and button', async () => {
    given.summary.mockResolvedValue(inbox);
    await stored('inbox');
    given.token = 'bob';
    const page = await html(numbered);
    expect(given.summary).toHaveBeenCalledWith({ id: numbered, home_repo: 'acme/widgets', prd: 7 });
    expect(page).toContain('<strong>Stage: inbox</strong>');
    expect(page).toContain('title="/omni:yolo 7">Build it</button>');
    expect(page).toContain('>phase-0 #12</a> <span class="ask-hint">✓</span>');
  });

  it('shows the stored stage when GitHub did not answer, and still shows the dossier', async () => {
    given.summary.mockRejectedValue(new Error('GitHub is down'));
    await stored('shipped');
    given.token = 'bob';
    const page = await html(numbered);
    expect(page).toContain('<strong>Stage: shipped</strong>');
    expect(page).toContain('title="last synced 29 Sep 2026, 09:15 UTC"');
    expect(page).toContain(`src="/prd/${numbered}/v/1/page"`);
  });

  it('says Syncing… for a PRD with no stored stage yet, or whose stages could not be read', async () => {
    given.summary.mockResolvedValue(inbox);
    given.token = 'bob';
    expect(await html(numbered)).toContain('<strong>Syncing…</strong>');
    given.stages.fail = 'down';
    const page = await html(numbered);
    expect(page).toContain('<strong>Syncing…</strong>');
    expect(page).toContain('PRD #7 ↗');
  });

  it('makes no GitHub call for a signed-out visitor, a draft, or demo mode', async () => {
    await html(numbered);
    given.token = 'ada';
    const page = await html(draft);
    expect(page).toContain('<strong>Brainstorming</strong></p>');
    given.mode = 'demo';
    await html('anything');
    expect(given.summary).not.toHaveBeenCalled();
  });
});

describe('the history', () => {
  const list = async (query: Record<string, string> = {}) =>
    renderToStaticMarkup((await HistoryPage({ searchParams: Promise.resolve(query) })) as ReactElement);
  const rows = (page: string) => [...page.matchAll(/<a class="dossier-history-row" href="\/prd\/([^"]+)">/g)].map((m) => m[1]);

  it('lists every dossier of a member\'s workspace under All, newest activity first, each opening its page', async () => {
    given.token = 'bob';
    const page = await list({ who: 'all' });
    expect(rows(page)).toEqual([numbered, draft]);
    expect(page).toContain('<span class="dossier-number">#7</span> <span>Team inbox</span>');
    expect(page).toContain('<span class="dossier-draft">DRAFT</span> <span>An idea</span>');
    expect(page).toContain('<span class="dossier-history-artifact">Before/after <small>v1</small></span><span class="dossier-history-artifact">Spec <small>v1</small></span>');
  });

  it('filters by a repository: a dossier with three shows under each', async () => {
    given.fake.seedPlanet({ planRepo: 'widgets', prd: 7, regions: ['core', 'web'] });
    given.token = 'bob';
    for (const repo of ['acme/core', 'acme/web']) expect(rows(await list({ repo, who: 'all' })), repo).toEqual([numbered]);
    expect(rows(await list({ repo: 'acme/widgets', who: 'all' }))).toEqual([numbered, draft]);
    expect(rows(await list({ repo: 'acme/gadgets', who: 'all' }))).toEqual([]);
    expect(await list({ repo: 'acme/gadgets', who: 'all' })).toContain('No PRD matches');
  });

  it('filters by draft or PRD, and finds a dossier by a word of its title', async () => {
    given.token = 'bob';
    expect(rows(await list({ state: 'draft', who: 'all' }))).toEqual([draft]);
    expect(rows(await list({ state: 'prd', who: 'all' }))).toEqual([numbered]);
    expect(rows(await list({ q: 'INBOX', who: 'all' }))).toEqual([numbered]);
    expect(rows(await list({ q: 'idea', state: 'prd', who: 'all' }))).toEqual([]);
  });

  it('starts on Mine: the dossiers the signed-in person opened, drafts and numbered alike (PRD 413)', async () => {
    given.token = 'ada';
    expect(rows(await list())).toEqual([numbered, draft]);
    expect(rows(await list({ state: 'draft' }))).toEqual([draft]);
  });

  it('an empty Mine says so and links to All, which lists the workspace (PRD 413)', async () => {
    given.token = 'bob';
    const page = await list();
    expect(rows(page)).toEqual([]);
    expect(page).toContain('You have not opened a PRD yet.');
    expect(page).toContain('href="/prd?who=all"');
  });

  it('lists nothing of a workspace to a member of another', async () => {
    given.token = 'carl';
    const page = await list({ who: 'all' });
    expect(rows(page)).toEqual([]);
    expect(page).toContain('No PRD yet');
    expect(page).not.toContain('Team inbox');
  });

  it('asks someone signed out to sign in, coming back to the history', async () => {
    const page = await list({ signin_error: 'Not allowed' });
    expect(page).toContain('Sign in to see your workspace&#x27;s PRDs');
    expect(page).toContain('Not allowed');
    expect(page).not.toContain('Team inbox');
  });

  it('says the database could not answer when it fails', async () => {
    given.token = 'bob';
    given.fake.state.fail = { message: 'down' };
    expect(await list()).toContain('The dossier database could not answer');
  });

  it('says dossiers are not open in a build without a database', async () => {
    given.mode = 'closed';
    expect(await list()).toContain('PRD dossiers are not open here');
  });

  it('plays the demo history in development, without a database', async () => {
    given.mode = 'demo';
    const page = await list();
    expect(page).toContain('<span class="dossier-number">#71</span>');
    expect(page).toContain('<span class="dossier-draft">DRAFT</span>');
    expect(rows(await list({ repo: 'vertuoza/vertuo-web' }))).toHaveLength(1);
    expect(rows(await list({ repo: 'vertuoza/vertuo-omni-loop' }))).toHaveLength(2);
    expect(rows(await list({ repo: 'vertuoza/vertuo-omni-loop', who: 'all' }))).toHaveLength(3);
  });
});

describe('the sandboxed route', () => {
  const serve = (id: string, version: string) =>
    sandboxRoute(new Request(`https://omni.example/prd/${id}/v/${version}/page`) as never, { params: Promise.resolve({ id, version }) });

  it('serves a member the page, under the sandbox policy and nosniff', async () => {
    given.token = 'bob';
    const response = await serve(numbered, '1');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-security-policy')).toBe(SANDBOX_CSP);
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(await response.text()).toBe(PAGE);
  });

  it('is not found for a member of another workspace, someone signed out, or a version that is not one', async () => {
    given.token = 'carl';
    expect((await serve(numbered, '1')).status).toBe(404);
    given.token = null;
    expect((await serve(numbered, '1')).status).toBe(404);
    given.token = 'bob';
    for (const version of ['2', '0', 'v1', '1.0', '-1']) expect((await serve(numbered, version)).status, version).toBe(404);
    const refused = await serve(numbered, '2');
    expect(refused.headers.get('content-security-policy')).toBe(SANDBOX_CSP);
  });

  it('serves the demo\'s page in development', async () => {
    given.mode = 'demo';
    const response = await serve('anything', '1');
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('<!doctype html>');
  });
});

describe('the layout', () => {
  it('is the ask pages\' reading surface: their tokens, their theme script first, their theme switch', async () => {
    const page = renderToStaticMarkup(await Layout({ children: createElement('p', null, 'inside') }));
    expect(page).toContain('--ask-ground');
    expect(page).toContain('.ask:not([data-ask-theme]) { color-scheme: dark;');
    expect(page).not.toContain('prefers-color-scheme');
    expect(page).toMatch(/<div class="ask app-shell"><script[^>]*>\(function\(\)\{/);
    expect(page).toContain('aria-label="Theme"');
    const choices = page.slice(page.indexOf('aria-label="Theme"'), page.indexOf('</div>', page.indexOf('aria-label="Theme"')));
    expect([...choices.matchAll(/>([^<]*)<\/button>/g)].map((m) => m[1])).toEqual(['Omni', 'Light', 'Dark']);
    expect(page).not.toContain('>System</button>');
    expect(page).toContain('<main class="ask-main"><p>inside</p></main>');
  });

  it('links to the history of every PRD through the sidebar\'s PRDs, marked current (PRD 438)', async () => {
    given.path = '/prd/3f2a';
    const page = renderToStaticMarkup(await Layout({ children: null }));
    expect(page).toMatch(/<a class="app-sidebar-item" href="\/prd" aria-current="page">PRDs<\/a>/);
    expect(page).toContain('<p class="app-bar-title">PRDs</p>');
    expect(page).not.toContain('All PRDs');
  });
});

describe('the stylesheet', () => {
  const css = readFileSync(new URL('./dossier.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

  it('names no colour of its own: every colour is a token, so Omni, light and dark follow the switch', () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).not.toMatch(/\b(?:rgba?|hsla?|oklch|color-mix)\(/i);
    const painted = /(?:^|[\s;{])((?:color|background(?:-color)?|border(?:-(?:top|right|bottom|left))?(?:-color)?|outline)\s*:\s*([^;]+));/g;
    const declarations = [...css.matchAll(painted)];
    expect(declarations.length).toBeGreaterThan(10);
    for (const [, declaration, value] of declarations) {
      expect(value.trim(), declaration).toMatch(/var\(--ask-|\btransparent\b|^none$|^inherit$|^0$/);
    }
  });
  /** Every rule of the stylesheet, with the media query it sits in ('' at the top level). */
  const rules = (() => {
    const found: { media: string; selectors: string[]; body: string }[] = [];
    const walk = (text: string, media: string) => {
      let at = 0;
      while (at < text.length) {
        const open = text.indexOf('{', at);
        if (open === -1) break;
        const head = text.slice(at, open).trim();
        let depth = 1;
        let end = open + 1;
        while (depth > 0 && end < text.length) {
          if (text[end] === '{') depth += 1;
          if (text[end] === '}') depth -= 1;
          end += 1;
        }
        const inner = text.slice(open + 1, end - 1);
        if (head.startsWith('@media')) walk(inner, head);
        else found.push({ media, selectors: head.split(',').map((s) => s.trim()), body: inner });
        at = end;
      }
    };
    walk(css, '');
    return found;
  })();
  /** The declarations of every rule naming `selector` exactly, joined. */
  const of = (selector: string, media = '') =>
    rules.filter((r) => r.media === media && r.selectors.includes(selector)).map((r) => r.body).join(';');
  const PINNED = '@media (min-width: 900px) and (min-height: 700px)';

  it('pins the header box only from 900 × 700 px, above the content and under the drawer (PRD 476)', () => {
    const pinned = of('.dossier-head', PINNED);
    expect(pinned).toMatch(/position:\s*sticky/);
    expect(pinned).toMatch(/top:\s*0/);
    expect(pinned).toMatch(/z-index:\s*(\d+)/);
    expect(Number(/z-index:\s*(\d+)/.exec(pinned)?.[1])).toBeLessThan(20);
    for (const rule of rules.filter((r) => r.media !== PINNED)) expect(rule.body, rule.selectors.join(', ')).not.toMatch(/sticky/);
  });

  it('draws the header on the surface with a strong bottom rule (PRD 476, edge to edge since PRD 498)', () => {
    const head = of('.dossier-head');
    expect(head).toMatch(/background:\s*var\(--ask-surface\)/);
    expect(head).toMatch(/border-bottom:\s*[^;]*var\(--ask-line-strong\)/);
  });

  it('lands a round and a markdown heading just under the pinned box (PRD 476)', () => {
    for (const selector of ['.dossier-round', '.dossier-md h2']) {
      expect(of(selector), selector).toMatch(/scroll-margin-top:\s*16px/);
      expect(of(selector, PINNED), selector).toMatch(/scroll-margin-top:\s*calc\(var\(--dossier-head-h, 0px\) \+ 16px\)/);
    }
  });

  it('spans the page, with a 900 px measure for prose only (PRD 476)', () => {
    for (const selector of ['.dossier', '.dossier-rounds', '.outbox-cards', '.dossier-frame']) {
      expect(of(selector), selector).not.toMatch(/max-width/);
    }
    for (const selector of ['.dossier-md', '.dossier-front']) expect(of(selector), selector).toMatch(/max-width:\s*900px/);
  });

  it('draws the rounds as one outlined list, not cards, an open round on --ask-sunk with a 4 px yellow edge, and no filled chosen option (PRD 498)', () => {
    expect(of('.dossier-round')).not.toMatch(/border(?:-left)?:/);
    expect(of('.dossier-round')).not.toMatch(/border-radius/);
    const open = of(".dossier-round[data-state='open']");
    expect(open).toMatch(/background:\s*var\(--ask-sunk\)/);
    expect(open).toMatch(/border-left:\s*4px solid var\(--ask-yellow\)/);
    expect(of('.dossier-rounds')).toMatch(/background:\s*var\(--ask-surface\)/);
    expect(of('.dossier-left')).toMatch(/background:\s*var\(--ask-yellow\)/);
    expect(of('.dossier-left')).toMatch(/color:\s*var\(--ask-on-yellow\)/);
    expect(of('.dossier-meter')).toMatch(/background:\s*var\(--ask-sunk\)/);
    expect(of('.dossier-meter > span')).toMatch(/background:\s*var\(--ask-green\)/);
    expect(of('.dossier-chosen')).not.toMatch(/background|border/);
    expect(of(".dossier-round[data-state='open'] .dossier-option")).toMatch(/border:\s*[^;]*var\(--ask-line-strong\)/);
    expect(of(".dossier-round[data-state='open'] .dossier-option")).not.toMatch(/background/);
  });

  it('dims no text with opacity: stages ahead and empty tabs read muted, a tab with content in ink (PRD 476)', () => {
    for (const rule of rules) {
      for (const [, value] of rule.body.matchAll(/opacity:\s*([\d.]+)/g)) expect(Number(value), rule.selectors.join(', ')).toBeGreaterThanOrEqual(1);
    }
    expect(of('.stage-ahead')).toMatch(/color:\s*var\(--ask-muted\)/);
    expect(of('.ask a.dossier-tab')).toMatch(/color:\s*var\(--ask-ink\)/);
    expect(of('.ask a.dossier-tab-empty')).toMatch(/color:\s*var\(--ask-muted\)/);
    expect(of(".ask a.dossier-tab[aria-current='page']")).toMatch(/color:\s*var\(--ask-ink\)/);
    expect(of(".ask a.dossier-tab[aria-current='page']")).toMatch(/border-bottom-color:\s*var\(--ask-plasma\)/);
  });

  it('outlines chips, badges, cards, controls and the tab bar with --ask-line-strong, and keeps --ask-line for dividers (PRD 476)', () => {
    const outlined = [
      '.dossier-head', '.stage-stop', '.dossier-repo', '.dossier-tabs', '.dossier-empty', '.dossier-frame iframe',
      '.dossier-rounds', '.dossier-category', '.dossier-option', '.outbox-card', '.outbox-option', '.outbox-settled', '.outbox-context',
      '.ask .dossier-quick-choice:disabled', '.dossier-history-filters', '.dossier-history-whos',
      '.ask a.dossier-history-row', '.dossier-history-artifact',
    ];
    for (const selector of outlined) {
      const body = of(selector);
      expect(body, selector).toMatch(/border(?:-top|-bottom)?(?:-color)?:\s*[^;]*var\(--ask-line-strong\)/);
      expect(body, selector).not.toMatch(/border(?:-top|-bottom)?(?:-color)?:\s*[^;]*var\(--ask-line\)/);
    }
    for (const selector of ['.dossier-md th', '.dossier-md hr', '.dossier-md h2', '.dossier-q + .dossier-q', '.dossier-round + .dossier-round']) {
      expect(of(selector), selector).toMatch(/border(?:-top|-bottom)?:\s*[^;]*var\(--ask-line\)/);
    }
  });
});
