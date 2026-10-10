import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import type { MemberSession } from '../data/member-session';
import { productHomeViewOf, type ProductHomeDeps } from './product-home.controller';
import { demoProductHome } from './ProductHome';
import type { ProductHome } from './product-home.service';

// /app/products/<id>'s controller (PRD 1364 s9): the session first (signed out, no read runs), then the
// workspace, then the product home read as the person; a product the workspace does not hold is not found,
// and a failed read is the unreadable notice.

const SIGNED_IN = { kind: 'signed-in', db: {}, user: { id: 'u-1' }, env: { url: 'u', key: 'k' } } as unknown as MemberSession;
const HOME: ProductHome = {
  product: { id: 'p-1', name: 'Mobile' },
  ledger: { lanes: { 'on-you': [], 'on-review': [], 'on-agent': [] }, summary: { building: 0, waitingOnPerson: 0, drifted: 0 } },
  prds: [],
};

function deps(over: Partial<ProductHomeDeps> = {}) {
  const reads: string[] = [];
  const d: ProductHomeDeps = {
    workspace: () => { reads.push('workspace'); return Promise.resolve({ id: 'ws-1' }); },
    home: (_s, workspace, product) => { reads.push(`home ${workspace} ${product}`); return Promise.resolve(HOME); },
    ...over,
  };
  return { reads, d };
}

describe('the product home\'s controller', () => {
  it('reads nothing for a signed-out person or a deployment with no database', async () => {
    for (const kind of ['sign-in', 'closed'] as const) {
      const { reads, d } = deps();
      expect(await productHomeViewOf({ kind }, 'p-1', d)).toEqual({ kind });
      expect(reads).toEqual([]);
    }
  });

  it('draws the demo\'s product in the demo, and no other', async () => {
    const { reads, d } = deps();
    expect(await productHomeViewOf({ kind: 'demo' }, 'demo-product-1', d)).toEqual({ kind: 'home', home: demoProductHome('demo-product-1') });
    expect(await productHomeViewOf({ kind: 'demo' }, 'p-x', d)).toEqual({ kind: 'not-found' });
    expect(reads).toEqual([]);
  });

  it('reads the person\'s workspace, then the product home in it', async () => {
    const { reads, d } = deps();
    expect(await productHomeViewOf(SIGNED_IN, 'p-1', d)).toEqual({ kind: 'home', home: HOME });
    expect(reads).toEqual(['workspace', 'home ws-1 p-1']);
  });

  it('says so for an account in no workspace, and for a product the workspace does not hold', async () => {
    expect(await productHomeViewOf(SIGNED_IN, 'p-1', deps({ workspace: () => Promise.resolve(null) }).d)).toEqual({ kind: 'no-workspace' });
    expect(await productHomeViewOf(SIGNED_IN, 'p-x', deps({ home: () => Promise.resolve(null) }).d)).toEqual({ kind: 'not-found' });
  });

  it('draws the unreadable notice when a read fails, and logs it', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { d } = deps({ home: () => Promise.reject(new Error('down')) });
    expect(await productHomeViewOf(SIGNED_IN, 'p-1', d)).toEqual({ kind: 'unreadable' });
    expect(log).toHaveBeenCalledWith('product home: p-1 could not be read (down)');
    log.mockRestore();
  });
});
