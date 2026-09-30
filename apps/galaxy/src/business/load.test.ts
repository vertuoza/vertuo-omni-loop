import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const read = vi.hoisted(() => ({
  workspace: (async () => ({ id: 'ws-1', slug: 'vertuoza', name: 'Vertuoza', theme: {} })) as () => Promise<unknown>,
}));
vi.mock('../data/workspace', () => ({ memberWorkspace: () => read.workspace() }));

import type { User } from '@supabase/supabase-js';
import { loadBusinessPage } from './load';

// Settings → Business's read (PRD 748 s2): the business opened with business_open(), its first
// product, the claims of the region and of that product, and the citation log counted per claim, all
// as the signed-in person (stubbed: no test calls Supabase).

const USER = { id: 'u-1' } as User;

type Answer = { data?: unknown; error?: unknown };

const CLAIMS = [
  { id: 'c-2', seq: 2, kind: 'rival', value: 'Acme Build', source: 'pick', state: 'confirmed', product_id: 'p-1' },
  { id: 'c-1', seq: 1, kind: 'region', value: 'Belgium', source: 'pick', state: 'confirmed', product_id: null },
  { id: 'c-3', seq: 3, kind: 'offering', value: 'developer tool', source: 'pick', state: 'confirmed', product_id: 'p-2' },
];
const CITATIONS = [
  { claim_id: 'c-2', cited_by: 'think-big', ref: 'concept #9', cited_at: '2026-10-02T10:00:00Z' },
  { claim_id: 'c-2', cited_by: 'think-big', ref: 'concept #7', cited_at: '2026-10-01T10:00:00Z' },
];

function db({
  open = { data: { id: 'b-1', workspace_id: 'ws-1', name: 'Vertuoza' } } as Answer,
  products = { data: [{ id: 'p-1', name: 'Vertuoza' }] } as Answer,
  claims = { data: CLAIMS } as Answer,
  citations = { data: CITATIONS } as Answer,
} = {}) {
  const calls: unknown[] = [];
  const query = (answer: Answer) => {
    const q = {
      select: (...a: unknown[]) => { calls.push(['select', ...a]); return q; },
      eq: (...a: unknown[]) => { calls.push(['eq', ...a]); return q; },
      order: (...a: unknown[]) => { calls.push(['order', ...a]); return q; },
      limit: (...a: unknown[]) => { calls.push(['limit', ...a]); return q; },
      then: (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve({ data: answer.data ?? null, error: answer.error ?? null }).then(ok, ko),
    };
    return q;
  };
  const tables: Record<string, Answer> = { products, claims, claim_citations: citations };
  return {
    calls,
    rpc: async (fn: string, args: unknown) => {
      calls.push(['rpc', fn, args]);
      return { data: open.data ?? null, error: open.error ?? null };
    },
    from: (table: string) => { calls.push(['from', table]); return query(tables[table]); },
  };
}

describe('the business page\'s read', () => {
  beforeEach(() => {
    read.workspace = async () => ({ id: 'ws-1', slug: 'vertuoza', name: 'Vertuoza', theme: {} });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('opens the business, and reads its products and every claim with its citations (PRD 748 s4)', async () => {
    const d = db({ products: { data: [{ id: 'p-1', name: 'Vertuoza' }, { id: 'p-2', name: 'Omni Loop' }] } });
    expect(await loadBusinessPage(d as never, USER)).toEqual({
      kind: 'business',
      workspace: { id: 'ws-1', name: 'Vertuoza' },
      product: { id: 'p-1', name: 'Vertuoza' },
      products: [{ id: 'p-1', name: 'Vertuoza' }, { id: 'p-2', name: 'Omni Loop' }],
      claims: [
        { id: 'c-1', seq: 1, kind: 'region', value: 'Belgium', source: 'pick', state: 'confirmed', product: null, cited: 0, lastBy: null },
        { id: 'c-2', seq: 2, kind: 'rival', value: 'Acme Build', source: 'pick', state: 'confirmed', product: 'p-1', cited: 2, lastBy: 'think-big concept #9' },
        { id: 'c-3', seq: 3, kind: 'offering', value: 'developer tool', source: 'pick', state: 'confirmed', product: 'p-2', cited: 0, lastBy: null },
      ],
    });
    expect(d.calls).toContainEqual(['rpc', 'business_open', { p_workspace: 'ws-1' }]);
    expect(d.calls).toContainEqual(['eq', 'business_id', 'b-1']);
    expect(d.calls).toContainEqual(['order', 'ordinal']);
    expect(d.calls).toContainEqual(['eq', 'workspace_id', 'ws-1']);
  });

  it('reads an empty business as no claim', async () => {
    expect(await loadBusinessPage(db({ claims: { data: [] }, citations: { data: [] } }) as never, USER)).toMatchObject({ kind: 'business', claims: [] });
  });

  it('answers no-workspace for an account in none', async () => {
    read.workspace = async () => null;
    expect(await loadBusinessPage(db() as never, USER)).toEqual({ kind: 'no-workspace' });
  });

  it('answers unreadable when the business cannot be opened, or a list cannot be read', async () => {
    expect(await loadBusinessPage(db({ open: { error: { code: '42501', message: 'no' } } }) as never, USER)).toEqual({ kind: 'unreadable' });
    expect(await loadBusinessPage(db({ products: { data: [] } }) as never, USER)).toEqual({ kind: 'unreadable' });
    expect(await loadBusinessPage(db({ claims: { error: { message: 'down' } } }) as never, USER)).toEqual({ kind: 'unreadable' });
    expect(await loadBusinessPage(db({ citations: { error: { message: 'down' } } }) as never, USER)).toEqual({ kind: 'unreadable' });
  });
});
