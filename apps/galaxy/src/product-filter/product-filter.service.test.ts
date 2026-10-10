import { describe, expect, it } from 'vitest';
import type { Board } from '../ideas/model';
import type { IdeasView } from '../ideas/source';
import {
  narrowByProduct, productFilterOf, readProductChoice, scopeBoard, scopeDossiers, type ProductFilterReads,
} from './product-filter.service';

// The product filter of /prd, /ideas, /bugs and /visual (PRD 1364 s12): `?product=` reads all, one
// product or no product; each list's rows are narrowed by the product its dossier or idea carries
// (dossiers.product_id, ideas.product_id); the filter's links keep the list's other filters. Every read
// is stubbed: no test calls Supabase.

const MOBILE = { id: '0b8e7c2e-3f1a-4d5b-9c6e-1a2b3c4d5e6f', name: 'Mobile', workspace_id: 'ws-1' };
const ESTIMATES = { id: '7d1f2a3b-4c5d-4e6f-8a9b-0c1d2e3f4a5b', name: 'Estimates', workspace_id: 'ws-1' };

/** A list's row as the list keeps it: its id and its workspace, and what the list itself reads. */
const row = (id: string, kind: 'prd' | 'bug' | 'visual') => ({ id, kind, workspace_id: 'ws-1', title: `${kind} ${id}` });

/** Stubbed reads: the workspaces' products, and which dossiers and ideas carry one. */
function reads(over: Partial<ProductFilterReads> = {}): ProductFilterReads & { asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    products: (workspaces) => { asked.push(`products ${workspaces.join(',')}`); return Promise.resolve([MOBILE, ESTIMATES]); },
    dossierProducts: (workspaces) => {
      asked.push(`dossiers ${workspaces.join(',')}`);
      return Promise.resolve(new Map([['d-mobile', MOBILE.id], ['d-estimates', ESTIMATES.id]]));
    },
    boardWorkspaces: (repo) => { asked.push(`workspaces ${repo}`); return Promise.resolve(['ws-1']); },
    ideaProducts: (repo) => { asked.push(`ideas ${repo}`); return Promise.resolve(new Map([['i-mobile', MOBILE.id]])); },
    ...over,
  };
}

describe('the product a list is filtered by', () => {
  it('reads all when the query names none, or an unknown word', () => {
    expect(readProductChoice({})).toEqual({ kind: 'all' });
    expect(readProductChoice({ product: '' })).toEqual({ kind: 'all' });
    expect(readProductChoice({ product: 'mobile; drop table' })).toEqual({ kind: 'all' });
  });

  it('reads no product, and one product by its id, the first of a repeated parameter', () => {
    expect(readProductChoice({ product: 'none' })).toEqual({ kind: 'none' });
    expect(readProductChoice({ product: MOBILE.id })).toEqual({ kind: 'product', id: MOBILE.id });
    expect(readProductChoice({ product: [ESTIMATES.id, MOBILE.id] })).toEqual({ kind: 'product', id: ESTIMATES.id });
  });
});

describe('narrowing a list by product', () => {
  const carriers = new Map([['a', MOBILE.id], ['b', ESTIMATES.id]]);
  const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  it('keeps every row for all, the product\'s rows for one product, and the rows with none for no product', () => {
    expect(narrowByProduct(rows, carriers, { kind: 'all' })).toEqual(rows);
    expect(narrowByProduct(rows, carriers, { kind: 'product', id: MOBILE.id })).toEqual([{ id: 'a' }]);
    expect(narrowByProduct(rows, carriers, { kind: 'none' })).toEqual([{ id: 'c' }]);
  });
});

describe('the filter\'s links', () => {
  it('offers All, each product and No product, the current one marked, keeping the list\'s other filters', () => {
    const view = productFilterOf([MOBILE, ESTIMATES], { kind: 'product', id: MOBILE.id }, '/prd', { who: 'all', q: 'login', product: MOBILE.id });
    expect(view.options).toEqual([
      { label: 'All', href: '/prd?who=all&q=login', current: false },
      { label: 'Mobile', href: `/prd?who=all&q=login&product=${MOBILE.id}`, current: true },
      { label: 'Estimates', href: `/prd?who=all&q=login&product=${ESTIMATES.id}`, current: false },
      { label: 'No product', href: '/prd?who=all&q=login&product=none', current: false },
    ]);
  });

  it('is the bare path for All on a list with no other filter', () => {
    expect(productFilterOf([MOBILE], { kind: 'all' }, '/bugs', {}).options[0]).toEqual({ label: 'All', href: '/bugs', current: true });
  });
});

// One test per list (the plan's "done when"): each choice narrows it.
for (const [kind, path] of [['prd', '/prd'], ['bug', '/bugs'], ['visual', '/visual']] as const) {
  describe(`${path}, filtered by product`, () => {
    const rows = [row('d-mobile', kind), row('d-estimates', kind), row('d-none', kind)];
    const ids = async (query: Record<string, string>) => (await scopeDossiers(reads(), rows, query, path)).rows.map((r) => r.id);

    it('keeps every one for all, one product\'s for that product, and those with none for no product', async () => {
      expect(await ids({})).toEqual(['d-mobile', 'd-estimates', 'd-none']);
      expect(await ids({ product: MOBILE.id })).toEqual(['d-mobile']);
      expect(await ids({ product: ESTIMATES.id })).toEqual(['d-estimates']);
      expect(await ids({ product: 'none' })).toEqual(['d-none']);
    });

    it('reads the products and the carriers of the listed rows\' workspaces once each, and draws the filter', async () => {
      const stub = reads();
      const scope = await scopeDossiers(stub, [...rows, { ...row('d-other', kind), workspace_id: 'ws-2' }], {}, path);
      expect(stub.asked).toEqual(['products ws-1,ws-2', 'dossiers ws-1,ws-2']);
      expect(scope.filter?.options.map((o) => o.label)).toEqual(['All', 'Mobile', 'Estimates', 'No product']);
    });
  });
}

describe('a list in workspaces with no product', () => {
  it('draws no filter and keeps every row', async () => {
    const stub = reads({ products: () => Promise.resolve([]) });
    const scope = await scopeDossiers(stub, [row('d-none', 'prd')], {}, '/prd');
    expect(scope).toEqual({ rows: [row('d-none', 'prd')], filter: null, unreadable: false });
  });

  it('reads nothing for an empty list', async () => {
    const stub = reads();
    expect(await scopeDossiers(stub, [], {}, '/prd')).toEqual({ rows: [], filter: null, unreadable: false });
    expect(stub.asked).toEqual([]);
  });
});

describe('a list whose products cannot be read', () => {
  it('keeps every row and says the list is not narrowed', async () => {
    const stub = reads({ products: () => Promise.reject(new Error('down')) });
    const rows = [row('d-mobile', 'bug')];
    const scope = await scopeDossiers(stub, rows, { product: MOBILE.id }, '/bugs', () => undefined);
    expect(scope).toEqual({ rows, filter: null, unreadable: true });
  });
});

describe('/ideas/<owner>/<repo>, filtered by product', () => {
  const idea = (id: string) => ({
    id, title: id, pitch: '', lane: 'now' as const, prd: null, created_at: '2026-10-01T00:00:00Z', votes: 0, voted: false, archived: false,
  });
  const board = (member: boolean): Board => ({ repo: 'vertuo/app', public: true, member, ideas: [idea('i-mobile'), idea('i-none')] });
  const view = (member: boolean): IdeasView => ({ kind: 'board', board: board(member), lanes: [] });
  const titles = (shown: IdeasView) => (shown.kind === 'board' ? shown.lanes.flatMap((l) => l.ideas.map((i) => i.id)) : null);

  it('narrows a member\'s board, its lanes with it: all, one product, no product', async () => {
    expect(titles((await scopeBoard(reads(), view(true), {}, '/ideas/vertuo/app')).view)).toEqual(['i-mobile', 'i-none']);
    expect(titles((await scopeBoard(reads(), view(true), { product: MOBILE.id }, '/ideas/vertuo/app')).view)).toEqual(['i-mobile']);
    expect(titles((await scopeBoard(reads(), view(true), { product: ESTIMATES.id }, '/ideas/vertuo/app')).view)).toEqual([]);
    expect(titles((await scopeBoard(reads(), view(true), { product: 'none' }, '/ideas/vertuo/app')).view)).toEqual(['i-none']);
  });

  it('reads the products of the board\'s workspace and draws the filter for a member', async () => {
    const stub = reads();
    const scope = await scopeBoard(stub, view(true), {}, '/ideas/vertuo/app');
    expect(stub.asked).toEqual(['workspaces vertuo/app', 'products ws-1', 'ideas vertuo/app']);
    expect(scope.filter?.options.map((o) => o.href)).toEqual([
      '/ideas/vertuo/app', `/ideas/vertuo/app?product=${MOBILE.id}`, `/ideas/vertuo/app?product=${ESTIMATES.id}`, '/ideas/vertuo/app?product=none',
    ]);
  });

  it('reads nothing and narrows nothing for a visitor, who never sees the workspace\'s products', async () => {
    const stub = reads();
    const scope = await scopeBoard(stub, view(false), { product: MOBILE.id }, '/ideas/vertuo/app');
    expect(stub.asked).toEqual([]);
    expect(scope.filter).toBeNull();
    expect(scope.view).toEqual(view(false));
  });

  it('leaves a board that is none or unavailable as it is', async () => {
    expect((await scopeBoard(reads(), { kind: 'none' }, {}, '/ideas/a/b')).view).toEqual({ kind: 'none' });
  });
});
