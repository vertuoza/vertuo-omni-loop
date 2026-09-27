import { readFileSync } from 'node:fs';
import { NextRequest } from 'next/server';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FAKE_WORKSPACE, fakeSupabase } from '../store.fake';
import { outboxRow } from '../../outbox/fixtures';
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
}));

vi.mock('server-only', () => ({}));
vi.mock('../../data/mode', () => ({ arcadeMode: () => given.mode }));
vi.mock('../../data/supabase-server', () => ({
  supabaseEnv: () => (given.mode === 'supabase' ? { url: 'http://127.0.0.1:54321', key: 'anon' } : null),
  supabaseServer: async () => {
    const client = given.fake.client(given.token ?? 'signed-out');
    const user = given.token ? await client.auth.getUser(given.token) : { data: { user: null } };
    return { ...client, auth: { getUser: async () => user } };
  },
}));

const { default: Page } = await import('../../../app/prd/[id]/page.tsx');
const { default: HistoryPage } = await import('../../../app/prd/page.tsx');
const { default: Layout } = await import('../../../app/prd/layout.tsx');
const { GET: sandboxRoute } = await import('../../../app/prd/[id]/v/[version]/page/route.ts');
const { default: ShortPage } = await import('../../../app/prd/at/[owner]/[repo]/[n]/page.tsx');
const { GET: shortCallback } = await import('../../../app/prd/at/[owner]/[repo]/[n]/callback/route.ts');

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
    expect(page).toContain('<span class="dossier-number">PRD #7</span>');
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
    expect(page).toContain('Questions<small>1/2 answered</small>');
    expect([...page.matchAll(/<span class="dossier-rule">([a-z]+)<\/span>/g)].map((m) => m[1])).toEqual(['delivery', 'delivery']);
    expect(page).toContain('answered by ADA after 2 min 0 s, in the terminal');
    expect(page).toContain('not answered yet');
    given.token = 'carl';
    await expect(open(numbered, { tab: 'questions' })).rejects.toMatchObject(notFound);
  });

  it('shows the questions of the brainstorm that opened a draft, in its Claude session', async () => {
    const opened = (await given.fake.client('ada').rpc('dossier_open', { p_title: 'Offline quotes', p_repo: 'acme/widgets', p_claude_session_id: 'sess-a' })).data as string;
    given.fake.seedAsk({ owner: ADA.id, repo: 'acme/widgets', claudeSessionId: 'sess-a' }, [{ created_at: new Date(Date.now() + 60_000).toISOString() }]);
    given.token = 'bob';
    const page = await html(opened, { tab: 'questions' });
    expect(page).toContain('<span class="dossier-rule">brainstorm</span>');
    expect(page).toContain('Questions<small>0/1 answered</small>');
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
    expect(questions).toMatch(/Questions<small>\d+\/\d+ answered<\/small>/);
  });
});

describe('the history', () => {
  const list = async (query: Record<string, string> = {}) =>
    renderToStaticMarkup((await HistoryPage({ searchParams: Promise.resolve(query) })) as ReactElement);
  const rows = (page: string) => [...page.matchAll(/<a class="dossier-history-row" href="\/prd\/([^"]+)">/g)].map((m) => m[1]);

  it('lists every dossier of a member\'s workspace, newest activity first, each opening its page', async () => {
    given.token = 'bob';
    const page = await list();
    expect(rows(page)).toEqual([numbered, draft]);
    expect(page).toContain('<span class="dossier-number">#7</span> <span>Team inbox</span>');
    expect(page).toContain('<span class="dossier-draft">DRAFT</span> <span>An idea</span>');
    expect(page).toContain('<span class="dossier-history-artifact">Before/after <small>v1</small></span><span class="dossier-history-artifact">Spec <small>v1</small></span>');
  });

  it('filters by a repository: a dossier with three shows under each', async () => {
    given.fake.seedPlanet({ planRepo: 'widgets', prd: 7, regions: ['core', 'web'] });
    given.token = 'bob';
    for (const repo of ['acme/core', 'acme/web']) expect(rows(await list({ repo })), repo).toEqual([numbered]);
    expect(rows(await list({ repo: 'acme/widgets' }))).toEqual([numbered, draft]);
    expect(rows(await list({ repo: 'acme/gadgets' }))).toEqual([]);
    expect(await list({ repo: 'acme/gadgets' })).toContain('No PRD matches');
  });

  it('filters by draft or PRD, and finds a dossier by a word of its title', async () => {
    given.token = 'bob';
    expect(rows(await list({ state: 'draft' }))).toEqual([draft]);
    expect(rows(await list({ state: 'prd' }))).toEqual([numbered]);
    expect(rows(await list({ q: 'INBOX' }))).toEqual([numbered]);
    expect(rows(await list({ q: 'idea', state: 'prd' }))).toEqual([]);
  });

  it('lists nothing of a workspace to a member of another', async () => {
    given.token = 'carl';
    const page = await list();
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
    expect(rows(await list({ repo: 'vertuoza/vertuo-omni-loop' }))).toHaveLength(3);
  });
});

describe('the Outbox tab (PRD 251)', () => {
  const seed = (more: Parameters<typeof outboxRow>[0] = {}) => given.fake.seedOutbox(outboxRow({ dossier_id: numbered, ...more }));

  it('shows a member the outbox their feature pull request asks, n open in its label', async () => {
    seed();
    given.token = 'bob';
    const page = await html(numbered, { tab: 'outbox' });
    expect(page).toContain('Outbox<small>2 open</small>');
    expect(page).toContain('Question 1</h3>');
    expect(page).toContain('Question 2</h3>');
    expect(page).toContain('Sending from this page is not open yet: reply on the pull request.');
    expect(await html(numbered)).toContain('Outbox<small>2 open</small>');
  });

  it('says there is no outbox yet before the App sent one', async () => {
    given.token = 'bob';
    expect(await html(numbered, { tab: 'outbox' })).toContain('No outbox yet.');
  });

  it('is not found for a member of another workspace', async () => {
    seed();
    given.token = 'carl';
    await expect(open(numbered, { tab: 'outbox' })).rejects.toMatchObject(notFound);
  });

  it('frames the latest before/after page beside the questions, and renders the latest spec on Spec', async () => {
    seed();
    given.token = 'bob';
    expect(await html(numbered, { tab: 'outbox' })).toContain(`src="/prd/${numbered}/v/1/page"`);
    const spec = await html(numbered, { tab: 'outbox', context: 'spec' });
    expect(spec).toContain('<h1>Team inbox</h1>');
    expect(spec).toContain('&lt;b&gt;raw&lt;/b&gt;');
  });

  it('plays the demo outbox in development, Send off and saying so', async () => {
    given.mode = 'demo';
    const page = await html('anything', { tab: 'outbox' });
    expect(page).toContain('Outbox<small>2 open</small>');
    expect(page).toContain('A demo outbox: Send is off here.');
    expect(page).toContain('Adopted unless you object · 1');
    expect(await html('anything', { tab: 'outbox', context: 'spec' })).toContain('<h1>Ask mode</h1>');
  });

  it('shows n open in the history, and Needs an answer keeps only those', async () => {
    seed();
    given.token = 'bob';
    const list = async (query: Record<string, string> = {}) =>
      renderToStaticMarkup((await HistoryPage({ searchParams: Promise.resolve(query) })) as ReactElement);
    expect(await list()).toContain('<span class="dossier-history-open">2 open</span>');
    const needs = await list({ needs: 'answer' });
    expect(needs).toContain(`href="/prd/${numbered}"`);
    expect(needs).not.toContain(`href="/prd/${draft}"`);
    seed({ state: 'merged' });
    expect(await list()).not.toContain('dossier-history-open');
  });
});

describe('the short address, /prd/at/<owner>/<repo>/<n> (PRD 251)', () => {
  const at = async (owner: string, repo: string, n: string, query: Record<string, string> = {}) =>
    (await ShortPage({ params: Promise.resolve({ owner, repo, n }), searchParams: Promise.resolve(query) })) as ReactElement;
  const redirected = (to: string) => ({ digest: expect.stringContaining(to) });

  it('redirects a member to the dossier\'s Outbox tab, whatever the case of the repository', async () => {
    given.token = 'bob';
    await expect(at('acme', 'widgets', '7')).rejects.toMatchObject(redirected(`/prd/${numbered}?tab=outbox`));
    await expect(at('Acme', 'Widgets', '7')).rejects.toMatchObject(redirected(`/prd/${numbered}?tab=outbox`));
  });

  it('is not found for a member of another workspace, a PRD with no dossier, or an address that names none', async () => {
    given.token = 'carl';
    await expect(at('acme', 'widgets', '7')).rejects.toMatchObject(notFound);
    given.token = 'bob';
    await expect(at('acme', 'widgets', '8')).rejects.toMatchObject(notFound);
    await expect(at('acme', 'gadgets', '7')).rejects.toMatchObject(notFound);
    for (const [owner, repo, n] of [['acme', 'widgets', '0'], ['acme', 'widgets', 'seven'], ['..', 'widgets', '7'], ['a%2Fb', 'widgets', '7']]) {
      await expect(at(owner, repo, n), `${owner}/${repo}/${n}`).rejects.toMatchObject(notFound);
    }
  });

  it('asks someone signed out to sign in, coming back to the same address', async () => {
    const page = renderToStaticMarkup(await at('acme', 'widgets', '7', { signin_error: 'Not allowed' }));
    expect(page).toContain('Sign in to read this PRD');
    expect(page).toContain('Not allowed');
    const back = await shortCallback(
      new NextRequest('https://omni.example/prd/at/acme/widgets/7/callback?error=denied'),
      { params: Promise.resolve({ owner: 'acme', repo: 'widgets', n: '7' }) },
    );
    expect(back.headers.get('location')).toBe('https://omni.example/prd/at/acme/widgets/7?signin_error=denied');
  });

  it('says the database could not answer when it fails', async () => {
    given.token = 'bob';
    given.fake.state.fail = { message: 'down' };
    expect(renderToStaticMarkup(await at('acme', 'widgets', '7'))).toContain('The dossier database could not answer');
  });

  it('finds the demo dossier in development, and nothing else', async () => {
    given.mode = 'demo';
    await expect(at('vertuoza', 'vertuo-omni-loop', '71')).rejects.toMatchObject(redirected('?tab=outbox'));
    await expect(at('vertuoza', 'vertuo-omni-loop', '72')).rejects.toMatchObject(notFound);
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
  it('is the ask pages\' reading surface: their tokens, their theme script first, their theme switch', () => {
    const page = renderToStaticMarkup(createElement(Layout, null, createElement('p', null, 'inside')));
    expect(page).toContain('--ask-ground');
    expect(page).toContain('@media (prefers-color-scheme: dark)');
    expect(page).toMatch(/<div class="ask"><script[^>]*>\(function\(\)\{/);
    expect(page).toContain('aria-label="Theme"');
    for (const choice of ['System', 'Light', 'Dark']) expect(page).toContain(`>${choice}</button>`);
    expect(page).toContain('<main class="ask-main"><p>inside</p></main>');
  });

  it('links to the history of every PRD', () => {
    const page = renderToStaticMarkup(createElement(Layout, null, null));
    expect(page).toContain('<a class="ask-for-me-nav" href="/prd">All PRDs</a>');
  });
});

describe.each([
  ['dossier.css', new URL('./dossier.css', import.meta.url)],
  ['outbox.css (PRD 251)', new URL('../../outbox/outbox.css', import.meta.url)],
])('the stylesheet %s', (_, file) => {
  const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

  it('names no colour of its own: every colour is a token, so light, dark and system follow the switch', () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).not.toMatch(/\b(?:rgba?|hsla?|oklch|color-mix)\(/i);
    const painted = /(?:^|[\s;{])((?:color|background(?:-color)?|border(?:-(?:top|right|bottom|left))?(?:-color)?|outline)\s*:\s*([^;]+));/g;
    const declarations = [...css.matchAll(painted)];
    expect(declarations.length).toBeGreaterThan(10);
    for (const [, declaration, value] of declarations) {
      expect(value.trim(), declaration).toMatch(/var\(--ask-|\btransparent\b|^none$|^inherit$|^0$/);
    }
  });
});
