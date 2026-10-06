import { describe, expect, it } from 'vitest';
import { defaultPitchSettings } from 'vertuo-omni-plan/kit/lib/pitch/settings.ts';
import type { MemberSession } from '../data/member-session';
import type { ProductLoad } from './load';
import { DEMO_PRODUCTS } from './ProductsScreen';
import { productViewOf } from './route-view';
import { sure } from '../arcade/test/sure';

// What one product's page draws (PRD 859 s1), for each kind of reader.

const PRODUCT = { id: 'p-1', name: 'Omni Loop', look: 'keynote' } as unknown as Extract<ProductLoad, { kind: 'product' }>['product'];
const SIGNED_IN = { kind: 'signed-in', db: {}, user: { id: 'u-1' }, env: { url: 'https://db', key: 'anon' } } as unknown as MemberSession;
const never = (): Promise<ProductLoad> => Promise.reject(new Error('read for a reader who is not signed in'));

describe('productViewOf', () => {
  it('draws the demo product by its id, its Pitch settings its look\'s preset, and no such product for another', async () => {
    const demo = sure(DEMO_PRODUCTS[1], 'the second demo product');
    expect(await productViewOf({ kind: 'demo' }, demo.id, never)).toEqual({
      kind: 'product', source: { kind: 'demo' }, editable: true, product: { ...demo, pitch: defaultPitchSettings('keynote') },
    });
    expect(await productViewOf({ kind: 'demo' }, 'nope', never)).toEqual({ kind: 'not-found' });
  });

  it('keeps a closed or signed-out reader in their situation, reading nothing', async () => {
    expect(await productViewOf({ kind: 'closed' }, 'p-1', never)).toEqual({ kind: 'closed' });
    expect(await productViewOf({ kind: 'sign-in' }, 'p-1', never)).toEqual({ kind: 'sign-in' });
  });

  it('passes on a read that found no product', async () => {
    for (const kind of ['no-workspace', 'unreadable', 'not-found'] as const) {
      expect(await productViewOf(SIGNED_IN, 'p-1', () => Promise.resolve({ kind }))).toEqual({ kind });
    }
  });

  it('draws the product from the database, as the reader may edit it', async () => {
    const view = await productViewOf(SIGNED_IN, 'p-1', (_s, id) => {
      expect(id).toBe('p-1');
      return Promise.resolve({ kind: 'product', workspace: { id: 'ws-1', name: 'Vertuoza' }, editable: false, product: PRODUCT });
    });
    expect(view).toEqual({
      kind: 'product',
      source: { kind: 'database', url: 'https://db', key: 'anon', workspace: 'ws-1' },
      editable: false,
      product: PRODUCT,
    });
  });
});
