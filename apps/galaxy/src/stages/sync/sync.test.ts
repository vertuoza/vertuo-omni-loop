import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeStageStore } from '../store.fake';
import { syncConfig, type RepoSnapshot } from './core';
import { syncStages, type SyncDeps, type SyncWorkspace } from './sync';

// POST /api/stages/sync (PRD 587, s2), on the store's fake and a fake reader: never GitHub, never a
// database. Two workspaces; the reader answers from the snapshots each test gives.

const SECRET = 'sync-secret-0123456789';
const NOW = '2026-09-29T12:00:00.000Z';
const CONFIG = syncConfig('kit: 1\nrepo:\n  slug: acme/widgets\n', 'acme/widgets');

const ACME: SyncWorkspace = { id: 'w-acme', slug: 'acme', github_org: 'acme', github_installation_id: 11 };
const GLOBEX: SyncWorkspace = { id: 'w-globex', slug: 'globex', github_org: 'globex', github_installation_id: 22 };

const snap = (repository: string, more: Partial<RepoSnapshot> = {}): RepoSnapshot => ({
  repository, config: CONFIG, inbox: [], shipped: [], issues: [], pulls: [], ...more,
});

function deps(more: Partial<SyncDeps> = {}, repos: Record<string, string[]> = { acme: ['acme/widgets', 'acme/gears'], globex: ['globex/core'] }) {
  const store = fakeStageStore(() => NOW);
  const snapshots: Record<string, RepoSnapshot | Error> = {
    'acme/widgets': snap('acme/widgets', { shipped: ['0042-dark-mode'], issues: [{ number: 42, created_at: '2026-09-18T00:00:00Z' }] }),
    'acme/gears': snap('acme/gears', { inbox: ['0007-teeth'] }),
    'globex/core': snap('globex/core', { issues: [{ number: 3, created_at: '2026-09-27T00:00:00Z' }] }),
  };
  const lines: string[] = [];
  const d: SyncDeps = {
    secret: SECRET,
    workspaces: async () => [ACME, GLOBEX],
    repositories: async (w) => repos[w.slug] ?? [],
    snapshot: async (_w, repo) => {
      const s = snapshots[repo];
      if (s instanceof Error) throw s;
      return s;
    },
    store,
    now: () => NOW,
    log: (line) => lines.push(line),
    ...more,
  };
  return { d, store, snapshots, lines };
}

const post = (auth?: string) => new Request('http://galaxy.test/api/stages/sync', {
  method: 'POST', headers: auth === undefined ? {} : { authorization: auth },
});

beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { vi.restoreAllMocks(); });

describe('the stages sync route', () => {
  it('refuses a missing or wrong bearer with 401, and writes nothing', async () => {
    for (const auth of [undefined, 'Bearer nope', SECRET, `Basic ${SECRET}`, 'Bearer ']) {
      const { d, store } = deps();
      const res = await syncStages(post(auth), d);
      expect(res.status).toBe(401);
      expect(store.writes).toEqual([]);
    }
  });

  it('refuses every call with 401 while the deployment has no secret', async () => {
    const { d, store } = deps({ secret: undefined });
    expect((await syncStages(post('Bearer '), d)).status).toBe(401);
    expect((await syncStages(post('Bearer undefined'), d)).status).toBe(401);
    expect(store.writes).toEqual([]);
  });

  it('records every stage and topic of every workspace\'s repositories, and names the counts per repository', async () => {
    const { d, store } = deps();
    const res = await syncStages(post(`Bearer ${SECRET}`), d);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      synced_at: NOW,
      repositories: [
        { workspace: 'acme', repository: 'acme/widgets', stages: 2, topics: 1 },
        { workspace: 'acme', repository: 'acme/gears', stages: 1, topics: 1 },
        { workspace: 'globex', repository: 'globex/core', stages: 1, topics: 0 },
      ],
      skipped: [],
    });
    expect(store.stages.map((s) => `${s.workspace_id} ${s.repository}#${s.prd} ${s.stage} ${s.reached_at}`).sort()).toEqual([
      'w-acme acme/gears#7 inbox 2026-09-29T12:00:00.000Z',
      'w-acme acme/widgets#42 prd 2026-09-18T00:00:00Z',
      'w-acme acme/widgets#42 shipped 2026-09-29T12:00:00.000Z',
      'w-globex globex/core#3 prd 2026-09-27T00:00:00Z',
    ]);
    expect(store.topics).toEqual([
      { workspace_id: 'w-acme', repository: 'acme/widgets', prd: 42, topic: 'dark-mode' },
      { workspace_id: 'w-acme', repository: 'acme/gears', prd: 7, topic: 'teeth' },
    ]);
  });

  it('logs and skips a repository it cannot read, while the others land', async () => {
    const { d, store, snapshots, lines } = deps();
    snapshots['acme/widgets'] = new Error('GitHub answered 502 to /pulls');
    const body = await (await syncStages(post(`Bearer ${SECRET}`), d)).json();
    expect(body.skipped).toEqual([{ workspace: 'acme', repository: 'acme/widgets', reason: 'GitHub answered 502 to /pulls' }]);
    expect(body.repositories.map((r: { repository: string }) => r.repository)).toEqual(['acme/gears', 'globex/core']);
    expect(store.stages.some((s) => s.repository === 'acme/widgets')).toBe(false);
    expect(store.stages.some((s) => s.repository === 'acme/gears')).toBe(true);
    expect(lines.some((l) => l.includes('acme/widgets') && l.includes('502'))).toBe(true);
  });

  it('skips a workspace whose repositories cannot be listed, while the others land', async () => {
    const { d, store } = deps({
      repositories: async (w) => {
        if (w.slug === 'acme') throw new Error('the App is not installed');
        return ['globex/core'];
      },
    });
    const body = await (await syncStages(post(`Bearer ${SECRET}`), d)).json();
    expect(body.skipped).toEqual([{ workspace: 'acme', repository: null, reason: 'the App is not installed' }]);
    expect(store.stages.map((s) => s.repository)).toEqual(['globex/core']);
  });

  it('writes nothing new on a rerun', async () => {
    const { d, store } = deps();
    await syncStages(post(`Bearer ${SECRET}`), d);
    const first = [...store.writes];
    const later = { ...d, now: () => '2026-09-29T12:15:00.000Z' };
    expect((await syncStages(post(`Bearer ${SECRET}`), later)).status).toBe(200);
    expect(store.writes).toEqual(first);
    expect(store.stages.find((s) => s.repository === 'acme/gears')).toMatchObject({ reached_at: NOW, synced_at: '2026-09-29T12:15:00.000Z' });
  });

  it('skips a repository whose stages the database refuses, and logs why', async () => {
    const { d, store, lines } = deps();
    const record = store.recordStages.bind(store);
    store.recordStages = async (rows, at) => {
      if (rows.some((r) => r.repository === 'acme/gears')) throw new Error('Supabase refused: boom');
      return record(rows, at);
    };
    const body = await (await syncStages(post(`Bearer ${SECRET}`), d)).json();
    expect(body.skipped).toEqual([{ workspace: 'acme', repository: 'acme/gears', reason: 'Supabase refused: boom' }]);
    expect(lines.some((l) => l.includes('acme/gears'))).toBe(true);
  });

  it('counts a topic the database refuses as not learnt, and keeps the repository\'s stages', async () => {
    const { d, store, lines } = deps();
    store.topics.push({ workspace_id: 'w-acme', repository: 'acme/gears', prd: 99, topic: 'teeth' });
    const body = await (await syncStages(post(`Bearer ${SECRET}`), d)).json();
    expect(body.repositories[1]).toEqual({ workspace: 'acme', repository: 'acme/gears', stages: 1, topics: 0 });
    expect(lines.some((l) => l.includes('teeth'))).toBe(true);
  });

  it('answers 500 when the workspaces cannot be read, and writes nothing', async () => {
    const { d, store } = deps({ workspaces: async () => { throw new Error('Supabase is down'); } });
    const res = await syncStages(post(`Bearer ${SECRET}`), d);
    expect(res.status).toBe(500);
    expect(store.writes).toEqual([]);
  });
});
