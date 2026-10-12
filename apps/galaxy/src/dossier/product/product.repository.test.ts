import { describe, expect, it } from 'vitest';
import { parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { boundaries } from './product.boundary';
import { dossierProductRepository, ProductDossierRow, ProductRow, type ProductDb } from './product.repository';

// The Product picker's storage (PRD 1364 s7): the reads it sends, as the signed-in person, and the
// database's dossier_set_product(), each answer parsed where it comes in. A fake client records each
// query's chain and answers what the test gives it.

const DOSSIER = '11111111-1111-4111-8111-111111111111';
const MOBILE = { id: '22222222-2222-4222-8222-222222222221', name: 'Mobile' };
const APPROVAL = '33333333-3333-4333-8333-333333333333';

type Answer = { data: unknown; error: { code?: string; message?: string; hint?: string } | null };

/** A client whose every query chain is recorded as one line, answered by `answers` in order. */
function fakeDb(answers: Answer[]) {
  const lines: string[] = [];
  const next = () => answers.shift() ?? { data: null, error: { message: 'no answer left' } };
  const chain = (line: string[]): unknown => new Proxy({}, {
    get(_, key: string) {
      if (key === 'then') {
        const answer = next();
        lines.push(line.join('.'));
        return (resolve: (value: Answer) => unknown) => resolve(answer);
      }
      return (...args: unknown[]) => chain([...line, `${key}(${args.map((a) => JSON.stringify(a)).join(',')})`]);
    },
  });
  const db = {
    from: (table: string) => chain([`from(${JSON.stringify(table)})`]),
    rpc: (fn: string, args: Record<string, unknown>) => chain([`rpc(${JSON.stringify(fn)},${JSON.stringify(args)})`]),
  } as unknown as ProductDb;
  return { db, lines };
}

describe('the dossier, as the picker reads it', () => {
  it('reads its PRD, workspace and product by its id', async () => {
    const { db, lines } = fakeDb([{ data: { id: DOSSIER, prd: 7, workspace_id: 'w1', product_id: null }, error: null }]);
    expect(await dossierProductRepository(db).dossier(DOSSIER)).toEqual({ ok: true, value: { id: DOSSIER, prd: parsePrd(7), workspace_id: 'w1', product_id: null } });
    expect(lines).toEqual([`from("dossiers").select("id, prd, workspace_id, product_id").eq("id","${DOSSIER}").maybeSingle()`]);
  });

  it('answers null for a dossier the caller does not read, and the error otherwise', async () => {
    expect(await dossierProductRepository(fakeDb([{ data: null, error: null }]).db).dossier(DOSSIER)).toEqual({ ok: true, value: null });
    expect(await dossierProductRepository(fakeDb([{ data: null, error: { code: 'XX000', message: 'down' } }]).db).dossier(DOSSIER))
      .toEqual({ ok: false, code: 'XX000', message: 'down', hint: null });
    expect(await dossierProductRepository(fakeDb([{ data: { id: DOSSIER }, error: null }]).db).dossier(DOSSIER))
      .toEqual({ ok: false, code: 'shape', message: 'dossiers answered out of shape', hint: null });
  });

  it('parses a draft\'s null PRD and refuses a row out of shape', () => {
    expect(ProductDossierRow.parse({ id: DOSSIER, prd: null, workspace_id: 'w1', product_id: MOBILE.id }).prd).toBe(null);
    expect(ProductDossierRow.safeParse({ id: DOSSIER, prd: '7', workspace_id: 'w1', product_id: null }).success).toBe(false);
  });
});

describe('the workspace\'s products', () => {
  it('reads them by name', async () => {
    const { db, lines } = fakeDb([{ data: [MOBILE], error: null }]);
    expect(await dossierProductRepository(db).products('w1')).toEqual({ ok: true, value: [MOBILE] });
    expect(lines).toEqual(['from("products").select("id, name").eq("workspace_id","w1").order("name")']);
  });

  it('refuses a product row out of shape', () => {
    expect(ProductRow.safeParse({ id: MOBILE.id }).success).toBe(false);
  });
});

describe('the approval in force', () => {
  it('reads the latest approval\'s id, and whether a void follows it', async () => {
    const { db, lines } = fakeDb([{ data: { id: APPROVAL }, error: null }, { data: [{ id: 'v1' }], error: null }, { data: [], error: null }]);
    const repo = dossierProductRepository(db);
    expect(await repo.latestApproval(DOSSIER)).toEqual({ ok: true, value: APPROVAL });
    expect(await repo.voided(APPROVAL)).toEqual({ ok: true, value: true });
    expect(await repo.voided(APPROVAL)).toEqual({ ok: true, value: false });
    expect(lines).toEqual([
      `from("approvals").select("id").eq("dossier_id","${DOSSIER}").order("approved_at",{"ascending":false}).order("id",{"ascending":false}).limit(1).maybeSingle()`,
      `from("approval_voids").select("id").eq("approval_id","${APPROVAL}").limit(1)`,
      `from("approval_voids").select("id").eq("approval_id","${APPROVAL}").limit(1)`,
    ]);
  });

  it('answers null with no approval', async () => {
    expect(await dossierProductRepository(fakeDb([{ data: null, error: null }]).db).latestApproval(DOSSIER)).toEqual({ ok: true, value: null });
  });
});

describe('setting the product', () => {
  it('calls dossier_set_product() and answers the product it set', async () => {
    const { db, lines } = fakeDb([{ data: { id: DOSSIER, product: MOBILE }, error: null }, { data: { id: DOSSIER, product: null }, error: null }]);
    const repo = dossierProductRepository(db);
    expect(await repo.set(DOSSIER, MOBILE.id)).toEqual({ ok: true, value: MOBILE });
    expect(await repo.set(DOSSIER, null)).toEqual({ ok: true, value: null });
    expect(lines).toEqual([
      `rpc("dossier_set_product",{"p_dossier":"${DOSSIER}","p_product":"${MOBILE.id}"})`,
      `rpc("dossier_set_product",{"p_dossier":"${DOSSIER}","p_product":null})`,
    ]);
  });

  it('answers the database\'s refusal with its code, message and hint', async () => {
    const { db } = fakeDb([{ data: null, error: { code: '55000', message: 'product is locked: PRD 7 is approved', hint: 'product' } }]);
    expect(await dossierProductRepository(db).set(DOSSIER, MOBILE.id)).toEqual({ ok: false, code: '55000', message: 'product is locked: PRD 7 is approved', hint: 'product' });
  });
});

describe('the reads schemas:verify runs', () => {
  it('registers the dossier and the products reads with the schemas the repository parses with', () => {
    expect(boundaries.map((b) => [b.name, b.schema, b.shape])).toEqual([
      ['dossier/product: dossiers', ProductDossierRow, 'rows'],
      ['dossier/product: products', ProductRow, 'rows'],
    ]);
  });
});
