import { describe, expect, it, vi } from 'vitest';
import { peopleOf } from '../people/load';
import type { ProductFilterReads } from '../product-filter/product-filter.service';
import { loadWaitingBoard, type BoardReads } from './waiting-board.service';

// The Waiting board's rules around its reads (PRD 2377 s3), on fakes: no test calls Supabase.

const NOW = new Date('2026-10-19T12:00:00Z');
const PEOPLE = peopleOf([{ user_id: 'u-ada', name: 'Ada', github_login: 'ada', avatar_url: null, fleet: null, hero: null }], []);
const wait = (id: string, over: Record<string, unknown> = {}) => ({ id, repo: 'Acme/Widgets', prd: 7, pr: 100, kind: 'review' as const, turn: ['ada'], since: '2026-10-19T08:00:00Z', ...over });

function reads(over: Partial<BoardReads> = {}): BoardReads {
  return {
    tracked: () => Promise.resolve(['acme/widgets']),
    openWaits: () => Promise.resolve([] as never),
    dossiers: () => Promise.resolve([]),
    openQuestions: () => Promise.resolve([]),
    lastSynced: () => Promise.resolve('2026-10-19T11:50:00Z'),
    ...over,
  };
}

const noProducts = (): Pick<ProductFilterReads, 'products' | 'dossierProducts' | 'dossierNumbers'> => ({
  products: () => Promise.resolve([]), dossierProducts: () => Promise.resolve(new Map()), dossierNumbers: () => Promise.resolve(new Map()),
});

const request = (query: Record<string, string> = {}) => ({ workspace: 'ws-1', viewerId: 'u-ada', people: PEOPLE, query, now: NOW });

describe('the Waiting board\'s service', () => {
  it('joins each wait with its PRD page, its open questions and the repositories\' last sync', async () => {
    const lastSynced = vi.fn(() => Promise.resolve('2026-10-19T09:00:00Z'));
    const data = await loadWaitingBoard(reads({
      openWaits: () => Promise.resolve([wait('w-1'), wait('w-2', { kind: 'outbox', pr: 101 })] as never),
      dossiers: () => Promise.resolve([{ id: 'd-7', home_repo: 'acme/widgets', prd: 7, title: 'Seven', opened_by: 'u-ada' }] as never),
      openQuestions: () => Promise.resolve([{ repository: 'acme/widgets', prd: 7, open_questions: 2 }] as never),
      lastSynced,
    }), noProducts(), request());
    expect(data.board.rows.map((r) => [r.id, r.what, r.prd?.href])).toEqual([['w-1', 'review', '/prd/d-7'], ['w-2', 'outbox · 2 questions', '/prd/d-7']]);
    expect(data.board.stale).toEqual(['acme/widgets']);
    expect(lastSynced).toHaveBeenCalledWith('ws-1', 'acme/widgets');
    expect(data.productsUnreadable).toBe(false);
  });

  it('reads the dossiers and questions of the PRDs the waits name only, and none when no wait names one', async () => {
    const dossiers = vi.fn(() => Promise.resolve([]));
    const openQuestions = vi.fn(() => Promise.resolve([]));
    await loadWaitingBoard(reads({ openWaits: () => Promise.resolve([wait('w-1', { prd: null }), wait('w-2', { prd: 9, kind: 'outbox' })] as never), dossiers, openQuestions }), noProducts(), request());
    expect(dossiers).toHaveBeenCalledWith('ws-1', [9]);
    expect(openQuestions).toHaveBeenCalledWith('ws-1', [9]);
  });

  it('narrows by product: a PRD\'s waits go with its PRD, a bug fix belongs to no product', async () => {
    const filterReads = {
      products: () => Promise.resolve([{ id: 'p-1', name: 'Mobile', workspace_id: 'ws-1', key: 'mobile' }]),
      dossierProducts: () => Promise.resolve(new Map([['d-7', 'p-1']])),
      dossierNumbers: () => Promise.resolve(new Map()),
    };
    const waits = [wait('w-1'), wait('w-2', { prd: 8, pr: 101 }), wait('w-3', { prd: null, pr: 102 })] as never;
    const dossiers = [{ id: 'd-7', home_repo: 'acme/widgets', prd: 7, title: 'Seven', opened_by: null }, { id: 'd-8', home_repo: 'acme/widgets', prd: 8, title: 'Eight', opened_by: null }] as never;
    const ids = async (query: Record<string, string>) => (await loadWaitingBoard(
      reads({ openWaits: () => Promise.resolve(waits), dossiers: () => Promise.resolve(dossiers) }), filterReads, request(query),
    )).board.rows.map((r) => r.id);
    expect(await ids({})).toEqual(['w-1', 'w-2', 'w-3']);
    expect(await ids({ product: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' })).toEqual([]);
    expect(await ids({ product: 'none' })).toEqual(['w-2', 'w-3']);
    const mobile = await loadWaitingBoard(reads({ openWaits: () => Promise.resolve(waits), dossiers: () => Promise.resolve(dossiers) }), filterReads, request({ product: 'p-1' }));
    expect(mobile.filter?.options.map((o) => o.label)).toEqual(['All', 'Mobile', 'No product']);
  });

  it('draws the tab the query asks for as the viewer: their PRDs on My PRDs, their login on My reviews', async () => {
    const data = (query: Record<string, string>) => loadWaitingBoard(reads({
      openWaits: () => Promise.resolve([wait('w-1', { turn: ['bob'] }), wait('w-2', { prd: 8, pr: 101 }), wait('w-3', { prd: null, pr: 102, turn: ['ADA'] })] as never),
      dossiers: () => Promise.resolve([
        { id: 'd-7', home_repo: 'acme/widgets', prd: 7, title: 'Seven', opened_by: 'u-ada' },
        { id: 'd-8', home_repo: 'acme/widgets', prd: 8, title: 'Eight', opened_by: 'u-bob' },
      ] as never),
    }), noProducts(), request(query));
    expect((await data({ tab: 'mine' })).board.rows.map((r) => r.id)).toEqual(['w-1']);
    const reviews = await data({ tab: 'reviews' });
    expect(reviews.board.rows.map((r) => r.id)).toEqual(['w-2', 'w-3']);
    expect(reviews.board.reviews).toBe(2);
  });

  it('keeps the list whole and says so when the products cannot be read', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const data = await loadWaitingBoard(reads({ openWaits: () => Promise.resolve([wait('w-1')] as never) }), { ...noProducts(), products: () => Promise.reject(new Error('down')) }, request());
    expect(data.board.rows).toHaveLength(1);
    expect(data.productsUnreadable).toBe(true);
    log.mockRestore();
  });

  it('throws when a read fails, for the controller to say so', async () => {
    await expect(loadWaitingBoard(reads({ openWaits: () => Promise.reject(new Error('refused')) }), noProducts(), request())).rejects.toThrow('refused');
  });
});
