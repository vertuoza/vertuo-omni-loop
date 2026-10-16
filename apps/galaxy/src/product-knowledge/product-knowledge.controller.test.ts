import { describe, expect, it, vi } from 'vitest';
import type { MemberSession } from '../data/member-session';
import { KnowledgeDoneSchema, KnowledgeErrorSchema } from './product-knowledge.contract';
import { knowledgeHandlers, knowledgeTabViewOf, type KnowledgeTabDeps } from './product-knowledge.controller';
import type { KnowledgeService, KnowledgeTab } from './product-knowledge.service';

vi.mock('server-only', () => ({}));

// The Knowledge tab's controller (PRD 1795 s2), on fake services: the page's view in each situation, and
// the route that changes it. The session is checked first: signed out, 401 and no service runs. Each
// refusal is `{error}` in plain words, its status by its kind.

const PRODUCT = '22222222-2222-4222-8222-222222222221';
const SECTION = { owner: null, delegate: null, decides: false, entries: [], proposals: [] };
const TAB: KnowledgeTab = { product: { id: PRODUCT, name: 'Mobile' }, canName: false, latestEventId: null, legal: SECTION, glossary: SECTION, members: [] };

describe('the page\'s view', () => {
  const signedIn = { kind: 'signed-in', db: {}, env: { url: 'u', key: 'k' }, user: { id: 'u-1' } } as unknown as MemberSession;
  const deps = (over: Partial<KnowledgeTabDeps> = {}): KnowledgeTabDeps => ({
    workspace: () => Promise.resolve({ id: 'w-1' }),
    tab: (_s, workspace, product) => Promise.resolve(workspace === 'w-1' && product === PRODUCT ? TAB : null),
    ...over,
  });

  it('draws the tab for a product of the reader\'s workspace, read live', async () => {
    expect(await knowledgeTabViewOf(signedIn, PRODUCT, deps())).toEqual({ kind: 'tab', source: { kind: 'live' }, tab: TAB });
  });

  it('is not found for a product the workspace does not hold', async () => {
    expect(await knowledgeTabViewOf(signedIn, 'p-other', deps())).toEqual({ kind: 'not-found' });
  });

  it('answers the session\'s own situation without reading, and the demo\'s product in the demo', async () => {
    const tab = vi.fn();
    for (const kind of ['closed', 'sign-in'] as const) {
      expect(await knowledgeTabViewOf({ kind }, PRODUCT, deps({ tab }))).toEqual({ kind });
    }
    expect(tab).not.toHaveBeenCalled();
    expect(await knowledgeTabViewOf({ kind: 'demo' }, 'demo-product-1', deps())).toMatchObject({ kind: 'tab', source: { kind: 'demo' }, tab: { product: { name: 'Widgets' } } });
    expect(await knowledgeTabViewOf({ kind: 'demo' }, 'demo-product-9', deps())).toEqual({ kind: 'not-found' });
  });

  it('says an account in no workspace, and a failed read, as such', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await knowledgeTabViewOf(signedIn, PRODUCT, deps({ workspace: () => Promise.resolve(null) }))).toEqual({ kind: 'no-workspace' });
    expect(await knowledgeTabViewOf(signedIn, PRODUCT, deps({ tab: () => Promise.reject(new Error('down')) }))).toEqual({ kind: 'unreadable' });
  });
});

describe('the route', () => {
  function handlers(service: Partial<KnowledgeService> | null) {
    const calls: string[] = [];
    const logs: string[] = [];
    const full: KnowledgeService = {
      tab: () => Promise.resolve(TAB),
      change: (product, write) => { calls.push(`${write.op} ${product}`); return Promise.resolve({ ok: true, value: { done: 'applied' } }); },
      ...service,
    };
    const h = knowledgeHandlers({ signedIn: () => Promise.resolve(service === null ? null : full), log: (line) => { logs.push(line); } });
    return { ...h, calls, logs };
  }
  const post = (body: unknown) => new Request(`https://omni.test/app/products/${PRODUCT}/knowledge/changes`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  const answer = async (response: Response) => ({ status: response.status, body: (await response.json()) as unknown, cache: response.headers.get('cache-control') });
  const CHANGE = { op: 'change', kind: 'legal', action: 'add', fields: { code: 'INVOICING', statement: 'No gaps.', source: 'VAT art. 53' } };

  it('changes as the signed-in person and answers what was done, never cached', async () => {
    const h = handlers({});
    const done = await answer(await h.change(post(CHANGE), PRODUCT));
    expect(done.status).toBe(200);
    expect(done.cache).toBe('no-store');
    expect(KnowledgeDoneSchema.parse(done.body)).toEqual({ done: 'applied' });
    expect(h.calls).toEqual([`change ${PRODUCT}`]);
  });

  it('is 401 and runs nothing when nobody is signed in', async () => {
    const h = handlers(null);
    expect((await answer(await h.change(post(CHANGE), PRODUCT))).status).toBe(401);
    expect(h.calls).toEqual([]);
  });

  it('is 404 for an id that is no product, and 400 for a body that is no change', async () => {
    const h = handlers({});
    expect((await answer(await h.change(post(CHANGE), 'not-a-uuid'))).status).toBe(404);
    for (const body of ['not json', { op: 'change', kind: 'legal', action: 'remove', entry: PRODUCT, fields: {} }, { op: 'change', kind: 'legal', action: 'edit', fields: {} }, { ...CHANGE, extra: 1 }, { op: 'other' }]) {
      const refused = await answer(await h.change(post(body), PRODUCT));
      expect(refused.status).toBe(400);
      expect(KnowledgeErrorSchema.safeParse(refused.body).success).toBe(true);
    }
    expect(h.calls).toEqual([]);
  });

  it('accepts a decision and a naming', async () => {
    const h = handlers({});
    const id = '33333333-3333-4333-8333-333333333331';
    expect((await answer(await h.change(post({ op: 'decide', proposal: id, verdict: 'approve' }), PRODUCT))).status).toBe(200);
    expect((await answer(await h.change(post({ op: 'name', kind: 'glossary', role: 'delegate', user: null }), PRODUCT))).status).toBe(200);
    expect(h.calls).toHaveLength(2);
  });

  it('answers each refusal in its words and status, and a database failure plainly, logged', async () => {
    const refusal = (kind: 'not-allowed' | 'missing' | 'refused' | 'database') => handlers({ change: () => Promise.resolve({ ok: false, kind, error: 'Statement: one line.' }) });
    expect(await answer(await refusal('not-allowed').change(post(CHANGE), PRODUCT))).toMatchObject({ status: 403, body: { error: 'Statement: one line.' } });
    expect((await answer(await refusal('missing').change(post(CHANGE), PRODUCT))).status).toBe(404);
    expect(await answer(await refusal('refused').change(post(CHANGE), PRODUCT))).toMatchObject({ status: 422, body: { error: 'Statement: one line.' } });
    const failing = refusal('database');
    expect(await answer(await failing.change(post(CHANGE), PRODUCT))).toMatchObject({ status: 500, body: { error: 'Couldn’t save this. Try again in a moment.' } });
    expect(failing.logs).toEqual([`product knowledge: Statement: one line. (${PRODUCT})`]);
    const throwing = handlers({ change: () => Promise.reject(new Error('down')) });
    expect((await answer(await throwing.change(post(CHANGE), PRODUCT))).status).toBe(500);
    expect(throwing.logs).toEqual([`product knowledge: down (${PRODUCT})`]);
  });
});
