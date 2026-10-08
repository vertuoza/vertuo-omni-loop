import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import { FAKE_WORKSPACE, fakeSupabase } from '../dossier/store.fake';
import { SANDBOX_CSP } from '../dossier/page/sandbox';
import { CONCEPT_1269 } from './list.fixture';

// The routes of a concept (PRD 1272, s3), called as the server calls them, reading as the viewer through
// the stubbed client of ../dossier/store.fake.ts, which keeps the migration's access rules: the page and
// its two sandboxed frame routes open for a member of the concept's workspace, and are not found to anyone
// else and for a dossier of another kind; a concept opened on /prd/<id> is sent to /concepts/<id>.

const ADA = { id: '00000000-0000-4000-8000-0000000000a1', email: 'ada@vertuoza.com', name: 'ADA' };
const BOB = { id: '00000000-0000-4000-8000-0000000000b1', email: 'bob@vertuoza.com' };
const OTHER = '00000000-0000-4000-8000-00000000aced';
const CARL = { id: '00000000-0000-4000-8000-0000000000c1', email: 'carl@vertuoza.com', workspaces: [OTHER] };

const given = vi.hoisted(() => ({
  mode: 'supabase',
  token: null as string | null,
  fake: null as unknown as ReturnType<typeof import('../dossier/store.fake').fakeSupabase>,
}));

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', async (original) => ({
  ...(await original<typeof import('next/navigation')>()),
  useRouter: () => ({ refresh: () => {} }),
  usePathname: () => '/concepts',
}));
vi.mock('../env', async (actual) => {
  const env = await actual<typeof import('../env')>();
  return { ...env, serverEnv: () => ({ ...env.readEnv({}), mode: given.mode }) };
});
vi.mock('../data/supabase-server', () => ({
  supabaseEnv: () => (given.mode === 'supabase' ? { url: 'http://127.0.0.1:54321', key: 'anon' } : null),
  supabaseServer: async () => {
    const client = given.fake.client(given.token ?? 'signed-out');
    const user = given.token ? await client.auth.getUser(given.token) : { data: { user: null } };
    const claims = user.data.user ? { claims: { sub: user.data.user.id, email: user.data.user.email } } : null;
    return { ...client, auth: { getUser: () => Promise.resolve(user), getClaims: () => Promise.resolve({ data: claims, error: null }) } };
  },
}));

const { default: ConceptRoute } = await import('../../app/concepts/[id]/page.tsx');
const { default: PrdRoute } = await import('../../app/prd/[id]/page.tsx');
const { GET: visionRoute } = await import('../../app/concepts/[id]/v/[version]/page/route.ts');
const { GET: boardRoute } = await import('../../app/concepts/[id]/r/[round]/page/route.ts');
const { settledPage } = await import('../dossier/page/stream/settled');

let concept = '';
let prd = '';

const push = async (who: string, args: Record<string, unknown>) =>
  ((await given.fake.client(who).rpc('dossier_push', { p_repo: 'acme/widgets', p_draft: null, ...args })).data as { id: string }).id;

beforeEach(async () => {
  given.mode = 'supabase';
  given.token = 'bob';
  given.fake = fakeSupabase({ ada: ADA, bob: BOB, carl: CARL }, { [FAKE_WORKSPACE]: 'acme', [OTHER]: 'other' });
  concept = await push('ada', {
    p_prd: 1269, p_kind: 'concept', p_title: 'Products replace plan repositories, with phase 0 approved on the server',
    p_artifacts: [
      { kind: 'concept-record', content: CONCEPT_1269 }, { kind: 'vision', content: '<title>tour</title>' },
      { kind: 'board', content: '<title>round one</title>' }, { kind: 'board', content: '<title>round two</title>' },
      { kind: 'debate', content: '## The panel\n\nThe Skeptic objected.\n' },
    ],
  });
  prd = await push('ada', { p_prd: 7, p_title: 'Team inbox', p_artifacts: [{ kind: 'spec', content: '# Team inbox\n' }, { kind: 'before-after', content: '<title>after</title>' }] });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); });

const page = async (route: (p: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) => unknown, id: string, q: Record<string, string> = {}) =>
  renderToStaticMarkup(await settledPage(await route({ params: Promise.resolve({ id }), searchParams: Promise.resolve(q) }) as ReactElement));
type FrameRoute = (request: never, context: { params: Promise<{ id: string; version: string; round: string }> }) => Promise<Response>;
const frame = (route: FrameRoute, id: string, n: string) =>
  route(new Request('http://x') as never, { params: Promise.resolve({ id, version: n, round: n }) });
const notFound = { digest: expect.stringContaining('404') as unknown };
const redirectTo = (path: string) => ({ digest: expect.stringContaining(`;${path};`) as unknown });

describe('/concepts/<id>', () => {
  it('shows a member the concept: its title, its issue, the tabs, and Debate rendered', async () => {
    const html = await page(ConceptRoute, concept);
    expect(html).toContain('#1269 ↗');
    expect(html).toContain('Products replace plan repositories, with phase 0 approved on the server');
    expect(html).toContain('<h2>The brief</h2>');
    // PRD 1272, s4: no stored facts and no GitHub here, so the state is unknown and the page still renders.
    expect(html).toContain('<span class="fix-state fix-state-unknown">state unknown</span>');
    expect(await page(ConceptRoute, concept, { tab: 'debate' })).toContain('<h2>The panel</h2>');
    expect(await page(ConceptRoute, concept, { tab: 'boards', round: '1' })).toContain(`src="/concepts/${concept}/r/1/page"`);
  });

  it('is not found to a member of another workspace, for an id that is no dossier\'s, and for a dossier of another kind', async () => {
    given.token = 'carl';
    await expect(page(ConceptRoute, concept)).rejects.toMatchObject(notFound);
    given.token = 'bob';
    await expect(page(ConceptRoute, 'not-a-uuid')).rejects.toMatchObject(notFound);
    await expect(page(ConceptRoute, prd)).rejects.toMatchObject(notFound);
  });

  it('asks a signed-out person to sign in, coming back through the dossier\'s callback', async () => {
    given.token = null;
    expect(await page(ConceptRoute, concept)).toContain('Sign in with GitHub');
  });

  it('is not found in the demo, which holds no concept', async () => {
    given.mode = 'demo';
    await expect(page(ConceptRoute, concept)).rejects.toMatchObject(notFound);
  });

  it('sends a concept opened on /prd/<id> to /concepts/<id>, the query kept', async () => {
    await expect(page(PrdRoute, concept, { tab: 'areas' })).rejects.toMatchObject(redirectTo(`/concepts/${concept}?tab=areas`));
  });
});

describe('the sandboxed frame routes', () => {
  it('serve the vision tour and each board under the sandbox headers, to a member only', async () => {
    const vision = await frame(visionRoute, concept, '1');
    expect(vision.status).toBe(200);
    expect(await vision.text()).toBe('<title>tour</title>');
    expect(vision.headers.get('content-security-policy')).toBe(SANDBOX_CSP);
    expect(vision.headers.get('x-content-type-options')).toBe('nosniff');
    expect(vision.headers.get('cache-control')).toBe('private, no-store');
    const board = await frame(boardRoute, concept, '2');
    expect(board.status).toBe(200);
    expect(await board.text()).toBe('<title>round two</title>');
    expect(board.headers.get('content-security-policy')).toBe(SANDBOX_CSP);
  });

  it('are not found to a member of another workspace, signed out, for a round that is not there, and for another kind\'s dossier', async () => {
    expect((await frame(boardRoute, concept, '3')).status).toBe(404);
    expect((await frame(visionRoute, prd, '1')).status).toBe(404);
    expect((await frame(boardRoute, prd, '1')).status).toBe(404);
    given.token = 'carl';
    expect((await frame(visionRoute, concept, '1')).status).toBe(404);
    expect((await frame(boardRoute, concept, '1')).status).toBe(404);
    given.token = null;
    const signedOut = await frame(visionRoute, concept, '1');
    expect(signedOut.status).toBe(404);
    expect(signedOut.headers.get('content-security-policy')).toBe(SANDBOX_CSP);
  });
});
