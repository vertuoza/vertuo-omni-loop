import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseIssue, parsePrd } from 'omni-loop/kit/lib/ids.ts';
import type { RoadmapRecordRead } from '../../dossier/page/RoadmapRecord';
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
    prerequisites: (id) => Promise.resolve(id === ID ? [{
      roadmap_id: ID, position: 1, row_id: 'p1', category: 'local', need: 'Docker runs', check_with: 'base:docker', fix_with: null,
      blocks_all: true, blocks: [], who: 'check', repos: [], card: null, state: 'waits', detail: null,
    }] : []),
    products: () => Promise.resolve([{ id: 'p-1', name: 'Crew', key: 'crew' }]),
    seqs: () => Promise.resolve(new Map()),
    roadmapOfDossier: () => Promise.resolve(null),
    record: () => Promise.resolve(null),
    humanWork: (id) => Promise.resolve(id === ID ? [work(ID, 'outbox:881/s1-01', 'dev-ops', 'open'), work(ID, 'park:881', 'business', 'done')] : []),
    shipped: () => Promise.resolve(new Map()),
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

  it('opens a roadmap on Overview, and on the tab asked for with its prerequisites', async () => {
    const overview = await loadRoadmapPage(reads(), { id: ID, product: null }, NOW);
    expect(overview.kind === 'roadmap' ? overview.roadmap.tab : overview.kind).toBe('overview');
    const view = await loadRoadmapPage(reads(), { id: ID, product: null, tab: 'prerequisites' }, NOW);
    if (view.kind !== 'roadmap') throw new Error(view.kind);
    expect(view.roadmap.tab).toBe('prerequisites');
    expect(view.roadmap.prerequisites.count).toBe('0 ok · 0 fixed · 1 waits on you');
    expect(view.roadmap.tabs.map((t) => [t.label, t.current, t.badge])).toEqual([['Overview', false, null], ['Prerequisites', true, 1]]);
  });

  it('offers Mark as done on a person row where the route says marking is open, and shows the row just ticked (s7)', async () => {
    const person = reads({ prerequisites: () => Promise.resolve([{
      roadmap_id: ID, position: 1, row_id: 'p3', category: 'permissions', need: 'the preview has its secret', check_with: null, fix_with: null,
      blocks_all: false, blocks: [], who: 'person', repos: [], card: null, state: 'waits', detail: null,
    }]) });
    const rowOf = async (ask: Partial<Parameters<typeof loadRoadmapPage>[1]>) => {
      const view = await loadRoadmapPage(person, { id: ID, product: null, tab: 'prerequisites', ...ask }, NOW);
      if (view.kind !== 'roadmap') throw new Error(view.kind);
      return { row: view.roadmap.prerequisites.groups[0]?.rows[0], tickError: view.roadmap.prerequisites.tickError };
    };
    expect((await rowOf({})).row?.tickable).toBe(false);
    expect((await rowOf({ tickable: true })).row?.tickable).toBe(true);
    expect((await rowOf({ tickable: true, ticked: 'p3' })).row).toMatchObject({ state: 'ticked', tickable: false });
    expect((await rowOf({ tickable: true, tickError: 'down' })).tickError).toMatch(/GitHub did not answer/);
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

// Issue #2258: the rows are as the last `omni roadmap push` left them, and a person's merge after the
// drive stopped is never pushed. The PRD's shipped stage, which the app records from the merge itself,
// reads it as merged all the same.
describe('a PRD merged after the last push (#2258)', () => {
  const MERGED_AT = '2026-10-19T14:14:59Z';
  const pushed = (state: RoadmapPrdRow['state']): RoadmapPrdRow => ({ ...prd(ID, state), started_at: '2026-10-18T09:00:00Z' });
  const shippedRead = vi.fn<RoadmapPageReads['shipped']>(() => Promise.resolve(new Map([[parsePrd(881), MERGED_AT]])));
  const stale = (state: RoadmapPrdRow['state'], shipped = shippedRead) => reads({ prds: () => Promise.resolve([pushed(state)]), shipped });

  it('reads a PRD pushed as waiting for merge as merged once the app recorded it shipped, ended at its merge', async () => {
    const view = await loadRoadmapPage(stale('ready'), { id: ID, product: null }, NOW);
    if (view.kind !== 'roadmap') throw new Error(view.kind);
    expect(view.roadmap.gantt.rows.map((r) => [r.state, r.waitsOn])).toEqual([['merged', null]]);
    expect(view.roadmap.gantt.median).toBe(Date.parse(MERGED_AT) - Date.parse('2026-10-18T09:00:00Z'));
    expect(shippedRead).toHaveBeenCalledWith(OURS, 'acme/widgets', [parsePrd(881)]);
  });

  it('counts it merged in the list, with nothing left waiting on a merge', async () => {
    const view = await loadRoadmapPage(stale('ready'), { id: null, product: null }, NOW);
    expect(view.kind === 'list' ? view.roadmaps.filter((r) => r.id === ID).map((r) => [r.merged, r.ready, r.total]) : view.kind).toEqual([[1, 0, 1]]);
  });

  it('leaves a PRD closed unmerged as it was pushed', async () => {
    const view = await loadRoadmapPage(stale('closed'), { id: ID, product: null }, NOW);
    expect(view.kind === 'roadmap' ? view.roadmap.gantt.rows.map((r) => r.state) : view.kind).toEqual(['closed']);
  });

  it('keeps the pushed rows when the stages cannot be read, and logs it', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const view = await loadRoadmapPage(stale('ready', vi.fn(() => Promise.reject(new Error('down')))), { id: ID, product: null }, NOW);
    expect(view.kind === 'roadmap' ? view.roadmap.gantt.rows.map((r) => r.state) : view.kind).toEqual(['ready']);
    expect(logged).toHaveBeenCalledTimes(1);
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

describe('a roadmap born on the server (PRD 2011, s3)', () => {
  const DOSSIER = '00000000-0000-4000-8000-0000000000e1';
  const PRODUCT_ROW: RoadmapRow = { ...roadmap(ID, OURS, 'p-1'), repo: null, number: null, dossier_id: DOSSIER };
  const RECORD: RoadmapRecordRead = {
    dossier: DOSSIER, approval: null, voids: [], asked: [], text: '# Mobile',
    versions: [{ id: 'd1', kind: 'roadmap', bytes: 8, source: 'kit', created_at: '2026-10-15T08:00:00Z' }],
  };
  const MOBILE = { id: 'p-1', name: 'Mobile', key: 'mobile' };
  const product = (over: Partial<RoadmapPageReads> = {}) => reads({
    roadmaps: () => Promise.resolve([PRODUCT_ROW]),
    roadmap: (id) => Promise.resolve(id === ID ? PRODUCT_ROW : null),
    roadmapOfDossier: (id) => Promise.resolve(id === DOSSIER ? PRODUCT_ROW : null),
    products: () => Promise.resolve([MOBILE]),
    seqs: () => Promise.resolve(new Map([[DOSSIER, 3]])),
    record: () => Promise.resolve(RECORD),
    ...over,
  });

  it('lists it with its product id, `mobile-R3`, and its product', async () => {
    const view = await loadRoadmapPage(product(), { id: null, product: null }, NOW);
    expect(view.kind === 'list' ? view.roadmaps.map((r) => [r.ref, r.product, r.repo, r.number]) : view.kind).toEqual([['mobile-R3', 'Mobile', null, null]]);
  });

  it('opens it with its approval waiting, its status held, a Versions tab counting its versions and no issue', async () => {
    const view = await loadRoadmapPage(product(), { id: ID, product: null, me: 'u-ada' }, NOW);
    if (view.kind !== 'roadmap') throw new Error(view.kind);
    const { roadmap: opened } = view;
    expect(opened.issueUrl).toBeNull();
    expect(opened.record).toMatchObject({ status: 'held', count: 1, approval: { state: 'waiting', canApprove: true } });
    expect(opened.tabs.map((t) => [t.label, t.badge])).toEqual([['Overview', null], ['Prerequisites', 1], ['Versions', 1]]);
  });

  it('opens on its dossier\'s id too, which the approval route answers with', async () => {
    const view = await loadRoadmapPage(product(), { id: DOSSIER, product: null }, NOW);
    expect(view.kind === 'roadmap' ? view.roadmap.id : view.kind).toBe(ID);
  });

  it('shows the version asked for under the Versions tab, and reads versions it cannot read as such', async () => {
    const view = await loadRoadmapPage(product(), { id: ID, product: null, tab: 'versions', version: { part: 'roadmap', version: 1 } }, NOW);
    if (view.kind !== 'roadmap') throw new Error(view.kind);
    expect(view.roadmap.tab).toBe('versions');
    expect(view.roadmap.record?.shown).toEqual({ label: 'Document', number: 1, text: '# Mobile' });
    const down = await loadRoadmapPage(product({ record: () => Promise.resolve(null) }), { id: ID, product: null, tab: 'versions' }, NOW);
    if (down.kind !== 'roadmap') throw new Error(down.kind);
    expect(down.roadmap.record).toMatchObject({ parts: null, shown: null, approval: { state: 'unread', canApprove: false } });
  });

  it('offers no Mark as done: it has no issue to comment on', async () => {
    const person = product({ prerequisites: () => Promise.resolve([{
      roadmap_id: ID, position: 1, row_id: 'p3', category: 'permissions', need: 'the preview has its secret', check_with: null, fix_with: null,
      blocks_all: false, blocks: [], who: 'person', repos: [], card: null, state: 'waits', detail: null,
    }]) });
    const view = await loadRoadmapPage(person, { id: ID, product: null, tab: 'prerequisites', tickable: true }, NOW);
    if (view.kind !== 'roadmap') throw new Error(view.kind);
    expect(view.roadmap.prerequisites.groups[0]?.rows[0]?.tickable).toBe(false);
  });

  it('keeps a roadmap born in git on two tabs, Versions asked for or not', async () => {
    const view = await loadRoadmapPage(reads(), { id: ID, product: null, tab: 'versions' }, NOW);
    if (view.kind !== 'roadmap') throw new Error(view.kind);
    expect([view.roadmap.tab, view.roadmap.record, view.roadmap.tabs.map((t) => t.label)]).toEqual(['overview', null, ['Overview', 'Prerequisites']]);
  });

  it('names no id when its product has no key, or when its number could not be read', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const keyless = await loadRoadmapPage(product({ products: () => Promise.resolve([{ ...MOBILE, key: null }]) }), { id: null, product: null }, NOW);
    expect(keyless.kind === 'list' ? keyless.roadmaps.map((r) => r.ref) : keyless.kind).toEqual([null]);
    const down = await loadRoadmapPage(product({ seqs: () => Promise.reject(new Error('down')) }), { id: null, product: null }, NOW);
    expect(down.kind === 'list' ? down.roadmaps.map((r) => r.ref) : down.kind).toEqual([null]);
  });
});
