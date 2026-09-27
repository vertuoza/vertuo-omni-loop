import { readFileSync } from 'node:fs';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FAKE_WORKSPACE, fakeSupabase } from '../store.fake';
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
});

describe('the stylesheet', () => {
  const css = readFileSync(new URL('./dossier.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

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
