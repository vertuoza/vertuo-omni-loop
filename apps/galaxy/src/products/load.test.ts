import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const read = vi.hoisted(() => ({
  workspace: (): Promise<unknown> => Promise.resolve({ id: 'ws-1', slug: 'vertuoza', name: 'Vertuoza', theme: {} }),
}));
vi.mock('../data/workspace', () => ({ memberWorkspace: () => read.workspace() }));

import type { User } from '@supabase/supabase-js';
import { defaultPitchSettings } from 'vertuo-omni-plan/kit/lib/pitch/settings.ts';
import { loadProduct, loadProducts } from './load';

// Settings › Products's reads (PRD 859 s1), as the signed-in person (stubbed: no test calls
// Supabase): the workspace's products, first first, each with its look; and one product by its id, with
// its Pitch settings filled (PRD 1108 s2).

const USER = { id: 'u-1' } as User;
const STORED = [
  { id: 'p-1', name: 'Vertuoza', pitch_look: 'arcade' },
  { id: 'p-2', name: 'Omni Loop', pitch_look: 'keynote', pitch: { look: { preset: 'keynote' }, intro: { eyebrow: 'Fresh' } } },
];

type Answer = { data?: unknown; error?: unknown };

function db(products: Answer = { data: STORED }) {
  const calls: unknown[] = [];
  const answer = () => Promise.resolve({ data: products.data ?? null, error: products.error ?? null });
  const q = {
    select: (...a: unknown[]) => { calls.push(['select', ...a]); return q; },
    eq: (...a: unknown[]) => { calls.push(['eq', ...a]); return q; },
    order: (...a: unknown[]) => { calls.push(['order', ...a]); return q; },
    then: (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => answer().then(ok, ko),
  };
  return { calls, from: (table: string) => { calls.push(['from', table]); return q; } };
}

const asDb = (d: ReturnType<typeof db>) => d as unknown as Parameters<typeof loadProducts>[0];

beforeEach(() => {
  read.workspace = () => Promise.resolve({ id: 'ws-1', slug: 'vertuoza', name: 'Vertuoza', theme: {} });
});

describe('the products list', () => {
  it('reads the workspace\'s products first first, each with its look, for a member who may change them', async () => {
    const d = db();
    expect(await loadProducts(asDb(d), USER)).toEqual({
      kind: 'products',
      workspace: { id: 'ws-1', name: 'Vertuoza' },
      editable: true,
      products: [{ id: 'p-1', name: 'Vertuoza', look: 'arcade' }, { id: 'p-2', name: 'Omni Loop', look: 'keynote' }],
    });
    expect(d.calls).toEqual([['from', 'products'], ['select', 'id, name, pitch_look, pitch'], ['eq', 'workspace_id', 'ws-1'], ['order', 'ordinal']]);
  });

  it('reads none while the business holds none', async () => {
    expect(await loadProducts(asDb(db({ data: [] })), USER)).toMatchObject({ kind: 'products', products: [] });
  });

  it('says so for an account in no workspace, and for products that cannot be read', async () => {
    read.workspace = () => Promise.resolve(null);
    expect(await loadProducts(asDb(db()), USER)).toEqual({ kind: 'no-workspace' });
    read.workspace = () => Promise.resolve({ id: 'ws-1', slug: 'vertuoza', name: 'Vertuoza', theme: {} });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await loadProducts(asDb(db({ error: { message: 'down' } })), USER)).toEqual({ kind: 'unreadable' });
  });
});

describe('one product', () => {
  it('reads the product of its id, with its look and its Pitch settings, filled', async () => {
    expect(await loadProduct(asDb(db()), USER, 'p-2')).toEqual({
      kind: 'product',
      workspace: { id: 'ws-1', name: 'Vertuoza' },
      editable: true,
      product: { id: 'p-2', name: 'Omni Loop', look: 'keynote', pitch: { ...defaultPitchSettings('keynote'), intro: { eyebrow: 'Fresh' } } },
    });
  });

  it('reads a product with no stored settings as its look\'s preset', async () => {
    expect(await loadProduct(asDb(db()), USER, 'p-1')).toMatchObject({ kind: 'product', product: { pitch: defaultPitchSettings('arcade') } });
  });

  it('says so for an account in no workspace, and for products that cannot be read', async () => {
    read.workspace = () => Promise.resolve(null);
    expect(await loadProduct(asDb(db()), USER, 'p-1')).toEqual({ kind: 'no-workspace' });
    read.workspace = () => Promise.resolve({ id: 'ws-1', slug: 'vertuoza', name: 'Vertuoza', theme: {} });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await loadProduct(asDb(db({ error: { message: 'down' } })), USER, 'p-1')).toEqual({ kind: 'unreadable' });
  });

  it('says a product the workspace does not hold is not found', async () => {
    expect(await loadProduct(asDb(db()), USER, 'p-9')).toEqual({ kind: 'not-found' });
  });
});
