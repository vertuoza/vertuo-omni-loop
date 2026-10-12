import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import type { MemberSession } from '../data/member-session';
import { productsHomeViewOf, type ProductsHomeDeps } from './products.controller';
import { DEMO_PRODUCTS_LIST } from './ProductsHome';
import type { ProductsList } from './products.service';

// /app/products's controller (PRD 1364 s8): the session first (signed out, no read runs), then the
// workspace, then the list read as the person; a failed read is the unreadable notice.

const SIGNED_IN = { kind: 'signed-in', db: {}, user: { id: 'u-1' }, env: { url: 'u', key: 'k' } } as unknown as MemberSession;
const LIST: ProductsList = { products: [{ id: 'p-1', name: 'Mobile', repositories: [], prds: 0, waiting: 0 }], unlinked: [] };

function deps(over: Partial<ProductsHomeDeps> = {}) {
  const reads: string[] = [];
  const d: ProductsHomeDeps = {
    workspace: () => { reads.push('workspace'); return Promise.resolve({ id: 'ws-1' }); },
    list: (_s, workspace) => { reads.push(`list ${workspace}`); return Promise.resolve(LIST); },
    ...over,
  };
  return { reads, d };
}

describe('the products list\'s controller', () => {
  it('reads nothing for a signed-out person, a deployment with no database, and draws the demo\'s list in the demo', async () => {
    for (const kind of ['sign-in', 'closed'] as const) {
      const { reads, d } = deps();
      expect(await productsHomeViewOf({ kind }, d)).toEqual({ kind });
      expect(reads).toEqual([]);
    }
    const { reads, d } = deps();
    expect(await productsHomeViewOf({ kind: 'demo' }, d)).toEqual({ kind: 'products', list: DEMO_PRODUCTS_LIST });
    expect(reads).toEqual([]);
  });

  it('reads the person\'s workspace, then its list', async () => {
    const { reads, d } = deps();
    expect(await productsHomeViewOf(SIGNED_IN, d)).toEqual({ kind: 'products', list: LIST });
    expect(reads).toEqual(['workspace', 'list ws-1']);
  });

  it('says so for an account in no workspace', async () => {
    const { reads, d } = deps({ workspace: () => Promise.resolve(null) });
    expect(await productsHomeViewOf(SIGNED_IN, d)).toEqual({ kind: 'no-workspace' });
    expect(reads).toEqual([]);
  });

  it('draws the unreadable notice when a read fails, and logs it', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { d } = deps({ list: () => Promise.reject(new Error('down')) });
    expect(await productsHomeViewOf(SIGNED_IN, d)).toEqual({ kind: 'unreadable' });
    expect(log).toHaveBeenCalledWith('products: the list could not be read (down)');
    log.mockRestore();
  });
});
