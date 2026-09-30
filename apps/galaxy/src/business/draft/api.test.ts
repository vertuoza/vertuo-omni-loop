import { describe, expect, it } from 'vitest';
import { addSourceRoute, draftRoute, removeSourceRoute, type SourcesStore, type WebPage } from './api';
import { PageRefused } from './page';
import { DraftStoreError, type DraftRow, type DraftStore } from './run';

// The draft's routes with fakes (PRD 774, s2): a non-member is refused; a call starts a draft and runs
// it after the answer; a second call while one runs answers the running one; the sources route adds a
// web page only when it may be read, and refuses a fourth.

const NOW = Date.parse('2026-09-30T12:00:00Z');

const row = (over: Partial<DraftRow> = {}): DraftRow => ({
  id: 'd-1', kind: 'draft', state: 'running', started_at: new Date(NOW - 60_000).toISOString(), finished_at: null, counts: {}, scanned: [], reason: null, ...over,
});

function draftStore({ running = null, refuse }: { running?: DraftRow | null; refuse?: string } = {}) {
  const started: string[] = [];
  const store = {
    async running() {
      return running;
    },
    async start(workspace: string) {
      if (refuse) throw new DraftStoreError('start a draft', refuse, 'no');
      started.push(workspace);
      return running && Date.parse(running.started_at) > NOW - 15 * 60_000 ? running : row({ id: 'd-new', started_at: new Date(NOW).toISOString() });
    },
  } as unknown as DraftStore;
  return { store, started };
}

const post = (body: unknown, method = 'POST') =>
  new Request('https://galaxy.test/api/business/draft', { method, headers: { 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) });

function routeDeps(store: DraftStore | null) {
  const ran: Array<[string, string]> = [];
  return { deps: { store: async () => store, later: (_s: DraftStore, ws: string, d: DraftRow) => { ran.push([ws, d.id]); }, now: () => NOW }, ran };
}

describe('POST /api/business/draft', () => {
  it('starts a draft and runs it after the answer', async () => {
    const { store, started } = draftStore();
    const { deps, ran } = routeDeps(store);
    const res = await draftRoute(post({ workspace: 'ws-1' }), deps);
    expect(res.status).toBe(202);
    expect(await res.json()).toMatchObject({ draft: { id: 'd-new', state: 'running' }, running: false });
    expect(started).toEqual(['ws-1']);
    expect(ran).toEqual([['ws-1', 'd-new']]);
  });

  it('answers the running draft on a second call, and starts nothing', async () => {
    const { store, started } = draftStore({ running: row() });
    const { deps, ran } = routeDeps(store);
    const res = await draftRoute(post({ workspace: 'ws-1' }), deps);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ draft: { id: 'd-1' }, running: true });
    expect(started).toEqual([]);
    expect(ran).toEqual([]);
  });

  it('starts a new draft past a stuck one', async () => {
    const { store } = draftStore({ running: row({ started_at: new Date(NOW - 16 * 60_000).toISOString() }) });
    const { deps, ran } = routeDeps(store);
    const res = await draftRoute(post({ workspace: 'ws-1' }), deps);
    expect(res.status).toBe(202);
    expect(ran).toEqual([['ws-1', 'd-new']]);
  });

  it('refuses a non-member, and runs nothing', async () => {
    const { store } = draftStore({ refuse: '42501' });
    const { deps, ran } = routeDeps(store);
    const res = await draftRoute(post({ workspace: 'ws-2' }), deps);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Only a member of the workspace can change its business.' });
    expect(ran).toEqual([]);
  });

  it('refuses a workspace with no business, a database failure, a signed-out caller and a bad body', async () => {
    expect((await draftRoute(post({ workspace: 'ws-1' }), routeDeps(draftStore({ refuse: 'P0002' }).store).deps)).status).toBe(404);
    expect((await draftRoute(post({ workspace: 'ws-1' }), routeDeps(draftStore({ refuse: 'XX000' }).store).deps)).status).toBe(500);
    expect((await draftRoute(post({ workspace: 'ws-1' }), routeDeps(null).deps)).status).toBe(401);
    expect((await draftRoute(post('nope'), routeDeps(draftStore().store).deps)).status).toBe(400);
    expect((await draftRoute(post({}), routeDeps(draftStore().store).deps)).status).toBe(400);
  });
});

function sourcesStore(pages: WebPage[] = []) {
  const store: SourcesStore = {
    async add(workspace, url) {
      if (workspace !== 'ws-1') throw new DraftStoreError('add a web page', '42501', 'no');
      if (pages.length >= 3) throw new DraftStoreError('add a web page', '22023', 'Web page: three at most. Remove one first.');
      const page = { id: `s-${pages.length + 1}`, url, added_at: new Date(NOW).toISOString() };
      pages.push(page);
      return page;
    },
    async remove(_workspace, source) {
      const at = pages.findIndex((p) => p.id === source);
      if (at < 0) throw new DraftStoreError('remove a web page', 'P0002', 'gone');
      pages.splice(at, 1);
    },
  };
  return { store, pages };
}

const check = async (url: string) => {
  if (!url.startsWith('https://')) throw new PageRefused('Only https:// pages can be read.');
  if (url.includes('intranet')) throw new PageRefused('That address is not on the public internet.');
};

describe('/api/business/sources', () => {
  it('adds a web page that may be read', async () => {
    const { store, pages } = sourcesStore();
    const res = await addSourceRoute(post({ workspace: 'ws-1', url: ' https://acme.com/pricing ' }), { store: async () => store, check });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ source: { id: 's-1', url: 'https://acme.com/pricing' } });
    expect(pages).toHaveLength(1);
  });

  it('refuses http: and a private host before storing anything', async () => {
    const { store, pages } = sourcesStore();
    const http = await addSourceRoute(post({ workspace: 'ws-1', url: 'http://acme.com' }), { store: async () => store, check });
    expect(http.status).toBe(400);
    expect(await http.json()).toEqual({ error: 'Only https:// pages can be read.' });
    const inside = await addSourceRoute(post({ workspace: 'ws-1', url: 'https://intranet.acme.com' }), { store: async () => store, check });
    expect(await inside.json()).toEqual({ error: 'That address is not on the public internet.' });
    expect(pages).toEqual([]);
  });

  it('refuses a fourth web page, and a non-member', async () => {
    const three = ['a', 'b', 'c'].map((n) => ({ id: n, url: `https://acme.com/${n}`, added_at: '' }));
    const { store } = sourcesStore(three);
    const fourth = await addSourceRoute(post({ workspace: 'ws-1', url: 'https://acme.com/d' }), { store: async () => store, check });
    expect(fourth.status).toBe(400);
    expect(await fourth.json()).toEqual({ error: 'Web page: three at most. Remove one first.' });
    expect((await addSourceRoute(post({ workspace: 'ws-2', url: 'https://acme.com/d' }), { store: async () => sourcesStore().store, check })).status).toBe(403);
  });

  it('removes a web page, and says when it is gone', async () => {
    const { store, pages } = sourcesStore([{ id: 's-1', url: 'https://acme.com', added_at: '' }]);
    const res = await removeSourceRoute(post({ workspace: 'ws-1', source: 's-1' }, 'DELETE'), { store: async () => store, check });
    expect(res.status).toBe(200);
    expect(pages).toEqual([]);
    expect((await removeSourceRoute(post({ workspace: 'ws-1', source: 's-1' }, 'DELETE'), { store: async () => store, check })).status).toBe(404);
  });

  it('refuses a signed-out caller', async () => {
    expect((await addSourceRoute(post({ workspace: 'ws-1', url: 'https://acme.com' }), { store: async () => null, check })).status).toBe(401);
    expect((await removeSourceRoute(post({ workspace: 'ws-1', source: 's-1' }, 'DELETE'), { store: async () => null, check })).status).toBe(401);
  });
});
