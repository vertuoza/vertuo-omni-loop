import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseIssue, parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';
import type { RoadmapHumanWorkRow, RoadmapPrdRow, RoadmapRow } from '../store';
import { loadRoadmapPage, productOf, roadmapIdOf, type RoadmapPageReads } from './load';

// The Roadmaps pages' read (PRD 1162) on fake reads: the workspace first, then the list of its
// roadmaps (another workspace's left out, one product's when asked) or one roadmap, the products
// failing soft.

const NOW = new Date('2026-10-20T12:00:00Z');
const OURS = 'w-1';
const ID = '7d3c2b1a-0f9e-4d8c-8b7a-6f5e4d3c2b1a';
const OTHER = '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d';

const roadmap = (id: string, workspace: string, product: string | null): RoadmapRow => ({
  id, workspace_id: workspace, repo: 'acme/widgets', number: parseIssue(880), title: `Roadmap ${id.slice(0, 4)}`, milestone: 'A milestone.',
  product_id: product, target_date: null, source: null, questions: [], document: '', pushed_by: null, created_at: NOW.toISOString(), pushed_at: NOW.toISOString(),
});
const prd = (roadmapId: string, state: RoadmapPrdRow['state']): RoadmapPrdRow => ({
  roadmap_id: roadmapId, position: 1, row_id: 'P1', prd: parsePrd(881), title: 'Invoice links', repos: [], blockers: [], wave: 1, state,
  waits_on: null, waits_on_url: null, started_at: null, ended_at: null,
});
const work = (roadmapId: string, key: string, kind: RoadmapHumanWorkRow['kind'], state: RoadmapHumanWorkRow['state']): RoadmapHumanWorkRow => ({
  roadmap_id: roadmapId, key, prd: parsePrd(881), repo: 'acme/widgets', source: 'outbox', text: `Work ${key}`, act: null, url: null,
  kind, kind_by: 'rule', state, first_seen_at: NOW.toISOString(), done_at: state === 'done' ? NOW.toISOString() : null,
});

function reads(over: Partial<RoadmapPageReads> = {}): RoadmapPageReads {
  const rows = [roadmap(ID, OURS, 'p-1'), roadmap(OTHER, OURS, null), roadmap('9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d', 'w-2', null)];
  return {
    workspace: () => Promise.resolve({ id: OURS, slug: 'acme', name: 'Acme', theme: {} }),
    roadmaps: () => Promise.resolve(rows),
    roadmap: (id) => Promise.resolve(rows.find((r) => r.id === id) ?? null),
    prds: (id) => Promise.resolve(id === ID ? [prd(ID, 'merged')] : [prd(id, 'building')]),
    products: () => Promise.resolve([{ id: 'p-1', name: 'Crew' }]),
    humanWork: (id) => Promise.resolve(id === ID ? [work(ID, 'outbox:881/s1-01', 'dev-ops', 'open'), work(ID, 'park:881', 'business', 'done')] : []),
    ...over,
  };
}

afterEach(() => { vi.restoreAllMocks(); });

describe('loadRoadmapPage', () => {
  it('lists the workspace\'s roadmaps only, each with its product and progress', async () => {
    const view = await loadRoadmapPage(reads(), { id: null, product: null }, NOW);
    expect(view.kind).toBe('list');
    if (view.kind !== 'list') return;
    expect(view.name).toBe('Acme');
    expect(view.roadmaps.map((r) => [r.id, r.product, r.merged, r.total])).toEqual([[ID, 'Crew', 1, 1], [OTHER, null, 0, 1]]);
    expect(view.products.map((p) => [p.label, p.count])).toEqual([['Every product', 2], ['Crew', 1]]);
  });

  it('lists one product\'s roadmaps when asked', async () => {
    const view = await loadRoadmapPage(reads(), { id: null, product: 'p-1' }, NOW);
    expect(view.kind === 'list' ? view.roadmaps.map((r) => r.id) : view.kind).toEqual([ID]);
  });

  it('names no product when the products cannot be read, and logs it once', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const view = await loadRoadmapPage(reads({ products: () => Promise.reject(new Error('down')) }), { id: null, product: null }, NOW);
    expect(view.kind === 'list' ? view.roadmaps.map((r) => r.product) : view.kind).toEqual([null, null]);
    expect(logged).toHaveBeenCalledTimes(1);
  });

  it('opens one of the workspace\'s roadmaps with its Gantt', async () => {
    const view = await loadRoadmapPage(reads(), { id: ID, product: null }, NOW);
    expect(view.kind === 'roadmap' ? view.roadmap.gantt.rows.map((r) => r.id) : view.kind).toEqual(['P1']);
  });

  it('reads each roadmap\'s human work: the open counts on its card, the open and the done on its page', async () => {
    const list = await loadRoadmapPage(reads(), { id: null, product: null }, NOW);
    expect(list.kind === 'list' ? list.roadmaps.map((r) => r.openWork.map((c) => [c.kind, c.open])) : list.kind).toEqual([[['dev-ops', 1]], []]);
    const view = await loadRoadmapPage(reads(), { id: ID, product: null }, NOW);
    if (view.kind !== 'roadmap') throw new Error(view.kind);
    expect(view.roadmap.humanWork.open.map((g) => [g.kind, g.entries.map((e) => e.key)])).toEqual([['dev-ops', ['outbox:881/s1-01']]]);
    expect(view.roadmap.humanWork.done.map((e) => e.key)).toEqual(['park:881']);
  });

  it('finds no roadmap of another workspace, nor one that does not exist', async () => {
    expect(await loadRoadmapPage(reads(), { id: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d', product: null }, NOW)).toEqual({ kind: 'not-found' });
    expect(await loadRoadmapPage(reads(), { id: '00000000-0000-4000-8000-000000000000', product: null }, NOW)).toEqual({ kind: 'not-found' });
  });

  it('says no workspace, and unreadable when the workspace cannot be read', async () => {
    expect(await loadRoadmapPage(reads({ workspace: () => Promise.resolve(null) }), { id: null, product: null }, NOW)).toEqual({ kind: 'no-workspace' });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await loadRoadmapPage(reads({ workspace: () => Promise.reject(new Error('down')) }), { id: null, product: null }, NOW)).toEqual({ kind: 'unreadable' });
  });
});

describe('the path\'s and the query\'s ids', () => {
  it('reads a roadmap\'s id, and a product\'s, only as an id', () => {
    expect(roadmapIdOf(ID.toUpperCase())).toBe(ID);
    expect(roadmapIdOf('nope')).toBeNull();
    expect(productOf(ID)).toBe(ID);
    expect(productOf('x')).toBeNull();
    expect(productOf(null)).toBeNull();
  });
});
