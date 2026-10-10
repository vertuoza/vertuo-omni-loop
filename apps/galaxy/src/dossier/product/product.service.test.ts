import { describe, expect, it } from 'vitest';
import { parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';
import type { DossierProductRepository, ProductDossier, Stored } from './product.repository';
import { lockedLine } from './product.contract';
import { productService } from './product.service';

// The PRD page's Product picker, its rules (PRD 1364 s7), on a fake repository: what the picker reads
// (the dossier's product, its workspace's products, and the lock while an approval is in force), and
// what a change answers, each refusal of the database (supabase/migrations/20261129100000_prd_product.sql,
// dossier_set_product()) read as the picker shows it.

const DOSSIER = '11111111-1111-4111-8111-111111111111';
const MOBILE = { id: '22222222-2222-4222-8222-222222222221', name: 'Mobile' };
const ESTIMATES = { id: '22222222-2222-4222-8222-222222222222', name: 'Estimates' };
const APPROVAL = '33333333-3333-4333-8333-333333333333';

const dossier = (more: Partial<ProductDossier> = {}): ProductDossier => ({
  id: DOSSIER, prd: parsePrd(7), workspace_id: 'w1', product_id: MOBILE.id, ...more,
});

type World = {
  dossier?: Stored<ProductDossier | null>;
  products?: Stored<Array<{ id: string; name: string }>>;
  approval?: Stored<string | null>;
  voided?: Stored<boolean>;
  set?: Stored<{ id: string; name: string } | null>;
};

const ok = <T>(value: T): Stored<T> => ({ ok: true, value });
const no = <T>(code: string | null, message: string | null, hint: string | null = null): Stored<T> => ({ ok: false, code, message, hint });

function world({ dossier: row = ok(dossier()), products = ok([ESTIMATES, MOBILE]), approval = ok(null), voided = ok(false), set = ok(ESTIMATES) }: World = {}) {
  const calls: string[] = [];
  const repo: DossierProductRepository = {
    dossier: (id) => { calls.push(`dossier ${id}`); return Promise.resolve(row); },
    products: (workspace) => { calls.push(`products ${workspace}`); return Promise.resolve(products); },
    latestApproval: (id) => { calls.push(`approval ${id}`); return Promise.resolve(approval); },
    voided: (id) => { calls.push(`voided ${id}`); return Promise.resolve(voided); },
    set: (id, product) => { calls.push(`set ${id} ${product ?? 'none'}`); return Promise.resolve(set); },
  };
  return { service: productService(repo), calls };
}

describe('what the picker reads', () => {
  it('answers the dossier\'s product, the workspace\'s products, and no lock with no approval', async () => {
    const { service, calls } = world();
    expect(await service.read(DOSSIER)).toEqual({ ok: true, value: { product: MOBILE, products: [ESTIMATES, MOBILE], locked: null } });
    expect(calls).toEqual([`dossier ${DOSSIER}`, 'products w1', `approval ${DOSSIER}`]);
  });

  it('answers no product for a dossier with none', async () => {
    const { service } = world({ dossier: ok(dossier({ product_id: null })) });
    expect(await service.read(DOSSIER)).toEqual({ ok: true, value: { product: null, products: [ESTIMATES, MOBILE], locked: null } });
  });

  it('is locked while an approval is in force, naming the PRD', async () => {
    const { service, calls } = world({ approval: ok(APPROVAL) });
    expect(await service.read(DOSSIER)).toEqual({
      ok: true, value: { product: MOBILE, products: [ESTIMATES, MOBILE], locked: 'product is locked: PRD 7 is approved' },
    });
    expect(calls).toContain(`voided ${APPROVAL}`);
  });

  it('is unlocked again once that approval is voided', async () => {
    const { service } = world({ approval: ok(APPROVAL), voided: ok(true) });
    const read = await service.read(DOSSIER);
    expect(read.ok && read.value.locked).toBe(null);
  });

  it('answers missing for a dossier the caller does not read', async () => {
    const { service, calls } = world({ dossier: ok(null) });
    expect(await service.read(DOSSIER)).toEqual({ ok: false, kind: 'missing', error: 'No such PRD.' });
    expect(calls).toEqual([`dossier ${DOSSIER}`]);
  });

  it('answers a database failure of any read as database', async () => {
    for (const fail of [{ dossier: no<ProductDossier | null>('XX000', 'down') }, { products: no<Array<{ id: string; name: string }>>('XX000', 'down') }, { approval: no<string | null>('XX000', 'down') }, { approval: ok(APPROVAL), voided: no<boolean>('shape', 'out of shape') }]) {
      const read = await world(fail).service.read(DOSSIER);
      expect(read).toEqual({ ok: false, kind: 'database', error: 'The PRD\'s product could not be read. Try again.' });
    }
  });

  it('falls back to no product when the product is not one of the workspace\'s it read', async () => {
    const { service } = world({ products: ok([ESTIMATES]) });
    const read = await service.read(DOSSIER);
    expect(read.ok && read.value.product).toBe(null);
  });
});

describe('a change of product', () => {
  it('answers the product the database set', async () => {
    const { service, calls } = world();
    expect(await service.change(DOSSIER, ESTIMATES.id)).toEqual({ ok: true, value: { product: ESTIMATES } });
    expect(calls).toEqual([`set ${DOSSIER} ${ESTIMATES.id}`]);
  });

  it('sets no product', async () => {
    const { service, calls } = world({ set: ok(null) });
    expect(await service.change(DOSSIER, null)).toEqual({ ok: true, value: { product: null } });
    expect(calls).toEqual([`set ${DOSSIER} none`]);
  });

  it('refuses while an approval is in force, in the database\'s own words', async () => {
    const { service } = world({ set: no('55000', 'product is locked: PRD 7 is approved', 'product') });
    expect(await service.change(DOSSIER, ESTIMATES.id)).toEqual({ ok: false, kind: 'locked', error: 'product is locked: PRD 7 is approved' });
  });

  it('refuses a product of another workspace', async () => {
    const { service } = world({ set: no('P0002', 'Product: no such product in this workspace.', 'product') });
    expect(await service.change(DOSSIER, ESTIMATES.id)).toEqual({ ok: false, kind: 'foreign-product', error: 'Product: no such product in this workspace.' });
  });

  it('answers missing for a dossier the caller does not read, and signed-out when the database says so', async () => {
    expect(await world({ set: no('P0002', 'No such dossier.') }).service.change(DOSSIER, null)).toEqual({ ok: false, kind: 'missing', error: 'No such PRD.' });
    expect(await world({ set: no('42501', 'Sign in first.') }).service.change(DOSSIER, null)).toEqual({ ok: false, kind: 'signed-out', error: 'Sign in first to change the PRD\'s product.' });
  });

  it('answers anything else as database, never a guess', async () => {
    expect(await world({ set: no('XX000', 'boom') }).service.change(DOSSIER, null)).toEqual({ ok: false, kind: 'database', error: 'The PRD\'s product was not changed. Try again.' });
    expect(await world({ set: no('55000', null) }).service.change(DOSSIER, null)).toEqual({ ok: false, kind: 'locked', error: 'The PRD\'s product is locked: it is approved.' });
  });
});

describe('the lock line', () => {
  it('reads as the database raises it', () => {
    expect(lockedLine(parsePrd(1364))).toBe('product is locked: PRD 1364 is approved');
  });
});
