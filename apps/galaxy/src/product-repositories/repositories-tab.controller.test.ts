import { describe, expect, it, vi } from 'vitest';
import type { MemberSession } from '../data/member-session';
import { ApproverRemovedSchema, ApproverSavedSchema, LinkRemovedSchema, LinkSavedSchema, TabErrorSchema } from './repositories-tab.contract';
import { repositoriesTabHandlers, repositoriesTabViewOf, type RepositoriesTabDeps } from './repositories-tab.controller';
import type { RepositoriesTab, RepositoriesTabService } from './repositories-tab.service';

vi.mock('server-only', () => ({}));

// The Repositories & approvers tab's controller (PRD 1364 s11), on fake services: the page's view in each
// situation, and the four routes that change it. The session is checked first: signed out, 401 and no
// service runs. Each refusal is `{error}` in plain words, its status by its kind.

const PRODUCT = '22222222-2222-4222-8222-222222222221';
const LINK = { repo: 'acme/api', role: 'api', knowledge: 'own' as const, readAt: null, readOnly: false, consumes: [], addedBy: 'person' as const };
const TAB: RepositoriesTab = { product: { id: PRODUCT, name: 'Mobile' }, owner: true, links: [LINK], addable: ['acme/web'], approvers: null };

describe('the page\'s view', () => {
  const signedIn = { kind: 'signed-in', db: {}, env: { url: 'u', key: 'k' }, user: { id: 'u-1' } } as unknown as MemberSession;
  const deps = (over: Partial<RepositoriesTabDeps> = {}): RepositoriesTabDeps => ({
    workspace: () => Promise.resolve({ id: 'w-1' }),
    tab: (_s, workspace, product) => Promise.resolve(workspace === 'w-1' && product === PRODUCT ? TAB : null),
    ...over,
  });

  it('draws the tab for a product of the reader\'s workspace, read live', async () => {
    expect(await repositoriesTabViewOf(signedIn, PRODUCT, deps())).toEqual({ kind: 'tab', source: { kind: 'live' }, tab: TAB });
  });

  it('is not found for a product the workspace does not hold', async () => {
    expect(await repositoriesTabViewOf(signedIn, 'p-other', deps())).toEqual({ kind: 'not-found' });
  });

  it('answers the session\'s own situation without reading, and the demo\'s product in the demo', async () => {
    const tab = vi.fn();
    for (const kind of ['closed', 'sign-in'] as const) {
      expect(await repositoriesTabViewOf({ kind } as MemberSession, PRODUCT, deps({ tab }))).toEqual({ kind });
    }
    expect(tab).not.toHaveBeenCalled();
    expect(await repositoriesTabViewOf({ kind: 'demo' }, 'demo-product-1', deps())).toMatchObject({ kind: 'tab', source: { kind: 'demo' }, tab: { product: { name: 'Widgets' } } });
    expect(await repositoriesTabViewOf({ kind: 'demo' }, 'demo-product-9', deps())).toEqual({ kind: 'not-found' });
  });

  it('says an account in no workspace, and a failed read, as such', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await repositoriesTabViewOf(signedIn, PRODUCT, deps({ workspace: () => Promise.resolve(null) }))).toEqual({ kind: 'no-workspace' });
    expect(await repositoriesTabViewOf(signedIn, PRODUCT, deps({ tab: () => Promise.reject(new Error('down')) }))).toEqual({ kind: 'unreadable' });
  });
});

describe('the routes', () => {
  function handlers(service: Partial<RepositoriesTabService> | null) {
    const calls: string[] = [];
    const logs: string[] = [];
    const full: RepositoriesTabService = {
      tab: () => Promise.resolve(TAB),
      saveLink: (product, write) => { calls.push(`save ${product} ${write.repo}`); return Promise.resolve({ ok: true, value: { link: LINK } }); },
      removeLink: (product, repo) => { calls.push(`remove ${product} ${repo}`); return Promise.resolve({ ok: true, value: { repo, removed: true } }); },
      setApprover: (product, member, state) => { calls.push(`set ${product} ${member} ${state}`); return Promise.resolve({ ok: true, value: { member, state } }); },
      removeApprover: (product, member) => { calls.push(`unset ${product} ${member}`); return Promise.resolve({ ok: true, value: { member, removed: true } }); },
      ...service,
    };
    const h = repositoriesTabHandlers({ signedIn: () => Promise.resolve(service === null ? null : full), log: (line) => { logs.push(line); } });
    return { ...h, calls, logs };
  }
  const BASE = `https://omni.test/app/products/${PRODUCT}/repositories`;
  const post = (path: string, body: unknown) => new Request(`${BASE}/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) });
  const del = (path: string, query: string) => new Request(`${BASE}/${path}?${query}`, { method: 'DELETE' });
  const answer = async (response: Response) => ({ status: response.status, body: (await response.json()) as unknown, cache: response.headers.get('cache-control') });
  const WRITE = { repo: 'acme/api', role: 'api', knowledge: 'own', readAt: null, readOnly: false, consumes: [] };

  it('saves a link, never cached', async () => {
    const h = handlers({});
    const a = await answer(await h.saveLink(post('links', WRITE), PRODUCT));
    expect(a).toMatchObject({ status: 200, cache: 'no-store' });
    expect(LinkSavedSchema.parse(a.body)).toEqual({ link: LINK });
    expect(h.calls).toEqual([`save ${PRODUCT} acme/api`]);
  });

  it('removes a link, sets and removes an approver', async () => {
    const h = handlers({});
    expect(LinkRemovedSchema.parse((await answer(await h.removeLink(del('links', 'repo=acme/api'), PRODUCT))).body)).toEqual({ repo: 'acme/api', removed: true });
    expect(ApproverSavedSchema.parse((await answer(await h.setApprover(post('approvers', { member: 'u-1', state: 'asked' }), PRODUCT))).body)).toEqual({ member: 'u-1', state: 'asked' });
    expect(ApproverRemovedSchema.parse((await answer(await h.removeApprover(del('approvers', 'member=u-1'), PRODUCT))).body)).toEqual({ member: 'u-1', removed: true });
    expect(h.calls).toEqual([`remove ${PRODUCT} acme/api`, `set ${PRODUCT} u-1 asked`, `unset ${PRODUCT} u-1`]);
  });

  it('answers 401 signed out, before anything runs', async () => {
    const h = handlers(null);
    for (const response of [
      await h.saveLink(post('links', WRITE), PRODUCT), await h.removeLink(del('links', 'repo=acme/api'), PRODUCT),
      await h.setApprover(post('approvers', { member: 'u-1', state: 'asked' }), PRODUCT), await h.removeApprover(del('approvers', 'member=u-1'), PRODUCT),
    ]) {
      const a = await answer(response);
      expect(a.status).toBe(401);
      expect(TabErrorSchema.parse(a.body).error).toMatch(/sign in/i);
    }
  });

  it('answers 400 to a malformed body or query, and 404 to a product id that is not one', async () => {
    const h = handlers({});
    expect((await h.saveLink(post('links', '{'), PRODUCT)).status).toBe(400);
    expect((await h.saveLink(post('links', { ...WRITE, knowledge: 'some' }), PRODUCT)).status).toBe(400);
    expect((await h.saveLink(post('links', { ...WRITE, extra: 1 }), PRODUCT)).status).toBe(400);
    expect((await h.removeLink(del('links', 'repo=nope'), PRODUCT)).status).toBe(400);
    expect((await h.setApprover(post('approvers', { member: 'u-1', state: 'maybe' }), PRODUCT)).status).toBe(400);
    expect((await h.removeApprover(del('approvers', 'member='), PRODUCT)).status).toBe(400);
    expect((await h.saveLink(post('links', WRITE), 'demo-product-1')).status).toBe(404);
    expect(h.calls).toEqual([]);
  });

  it('answers a refusal by its kind, in plain words; a database failure 500, logged', async () => {
    const refusing = (kind: 'not-owner' | 'refused' | 'missing' | 'database', error: string) =>
      handlers({ saveLink: () => Promise.resolve({ ok: false, kind, error }) });
    expect(await answer(await refusing('not-owner', 'Only an owner.').saveLink(post('links', WRITE), PRODUCT))).toMatchObject({ status: 403, body: { error: 'Only an owner.' } });
    expect(await answer(await refusing('refused', 'Role: X is not one kebab-case word.').saveLink(post('links', WRITE), PRODUCT))).toMatchObject({ status: 422, body: { error: 'Role: X is not one kebab-case word.' } });
    expect(await answer(await refusing('missing', 'Gone.').saveLink(post('links', WRITE), PRODUCT))).toMatchObject({ status: 404 });
    const broken = refusing('database', 'boom');
    const a = await answer(await broken.saveLink(post('links', WRITE), PRODUCT));
    expect(a).toMatchObject({ status: 500, body: { error: 'Couldn’t save this. Try again in a moment.' } });
    expect(broken.logs).toEqual([`product repositories: boom (${PRODUCT})`]);
  });

  it('answers 500, logged, when the service throws', async () => {
    const h = handlers({ removeLink: () => Promise.reject(new Error('down')) });
    expect((await h.removeLink(del('links', 'repo=acme/api'), PRODUCT)).status).toBe(500);
    expect(h.logs).toEqual([`product repositories: down (${PRODUCT})`]);
  });
});
