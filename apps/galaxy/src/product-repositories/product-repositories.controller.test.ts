import { describe, expect, it } from 'vitest';
import { ProductTargetsSchema } from './product-repositories.contract';
import { readProductTargets, type ProductTargetsDeps } from './product-repositories.controller';
import { productRepositoriesService } from './product-repositories.service';
import type { StoredLinkRow, StoredProductRow } from './product-repositories.repository';

// GET /api/products/targets (PRD 1364, s4), with fake reads behind the real service: a signed-out
// request is refused before any read, a product's links answer in the kit's own shape, and each
// refusal is in plain words.

const ADA = { id: '00000000-0000-4000-8000-0000000000a1', email: 'ada@acme.test' };
const SHA = '3f2a9c1e0b7d4c5a8e6f1d2c3b4a5968778695a4';
const ACME = 'w-acme';
const MOBILE: StoredProductRow = { id: 'p-mobile', workspace_id: ACME, name: 'Mobile' };
const ESTIMATES: StoredProductRow = { id: 'p-estimates', workspace_id: ACME, name: 'Estimates' };
const LINKS: Record<string, StoredLinkRow[]> = {
  'p-mobile': [
    { repository: 'acme/api', role: 'api', knowledge: 'imported', read_at: SHA, read_only: false, consumes: [] },
    { repository: 'acme/app', role: null, knowledge: 'own', read_at: null, read_only: true, consumes: ['acme/api'] },
  ],
  'p-estimates': [],
};

type World = { listings?: Record<string, string[]>; products?: StoredProductRow[]; failing?: boolean };

function world({ listings = { 'acme/plan': [ACME] }, products = [MOBILE, ESTIMATES], failing = false }: World = {}, database = true) {
  const reads: string[] = [];
  const logged: string[] = [];
  const store = {
    workspacesListing: (repo: string) => {
      reads.push(`listing ${repo}`);
      return failing ? Promise.reject(new Error('read the workspaces of acme/plan: boom')) : Promise.resolve(listings[repo] ?? []);
    },
    products: (workspaces: string[]) => {
      reads.push(`products ${workspaces.join(',')}`);
      return Promise.resolve(products.filter((p) => workspaces.includes(p.workspace_id)));
    },
    links: (product: string) => {
      reads.push(`links ${product}`);
      return Promise.resolve(LINKS[product] ?? []);
    },
  };
  const client = () => ({
    auth: { getUser: (jwt: string) => Promise.resolve(jwt === 'ada-token' ? { data: { user: ADA }, error: null } : { data: { user: null }, error: { status: 401 } }) },
    service: productRepositoriesService(store),
  });
  const deps: ProductTargetsDeps = { connect: database ? client : null, log: (line) => logged.push(line) };
  const get = async (query: string, token: string | null = 'ada-token') => {
    const response = await readProductTargets(
      new Request(`https://omni.example/api/products/targets${query}`, { headers: token ? { authorization: `Bearer ${token}` } : {} }),
      deps,
    );
    return { status: response.status, body: (await response.json()) as unknown, cache: response.headers.get('cache-control') };
  };
  return { reads, logged, get };
}

describe('GET /api/products/targets', () => {
  it("answers the product's links as the kit's targets, never cached", async () => {
    const w = world();
    const answer = await w.get('?repo=acme/plan&product=Mobile');
    expect(answer).toEqual({
      status: 200,
      cache: 'no-store',
      body: {
        product: { name: 'Mobile' },
        targets: [
          { repo: 'acme/api', role: 'api', knowledge: 'imported', readAt: SHA, readOnly: false, consumes: [] },
          { repo: 'acme/app', role: null, knowledge: 'own', readAt: null, readOnly: true, consumes: ['acme/api'] },
        ],
      },
    });
    expect(ProductTargetsSchema.safeParse(answer.body).success).toBe(true);
    expect(w.reads).toEqual(['listing acme/plan', `products ${ACME}`, 'links p-mobile']);
  });

  it('matches the product name without case, the repository in lower case, and answers an empty product', async () => {
    const w = world();
    expect((await w.get('?repo=Acme/Plan&product=%20estimates%20')).body).toEqual({ product: { name: 'Estimates' }, targets: [] });
    expect(w.reads[0]).toBe('listing acme/plan');
  });

  it('refuses a signed-out request with 401, before any read', async () => {
    const w = world();
    expect((await w.get('?repo=acme/plan&product=Mobile', null)).status).toBe(401);
    expect((await w.get('?repo=acme/plan&product=Mobile', 'stale-token')).status).toBe(401);
    expect(w.reads).toEqual([]);
  });

  it('refuses a malformed query with 400, before any read', async () => {
    const w = world();
    for (const query of ['?product=Mobile', '?repo=plan&product=Mobile', '?repo=acme/plan', '?repo=acme/plan&product=%20', `?repo=acme/plan&product=${'x'.repeat(201)}`]) {
      expect(await w.get(query), query).toMatchObject({ status: 400, body: { error: 'Name the plan repository as `repo=owner/name` and the product as `product=<name>`.' } });
    }
    expect(w.reads).toEqual([]);
  });

  it('refuses a repository no workspace of the caller lists, and a product it does not hold, with 404', async () => {
    expect(await world().get('?repo=acme/other&product=Mobile')).toMatchObject({ status: 404, body: { error: 'No workspace of yours lists acme/other.' } });
    expect(await world().get('?repo=acme/plan&product=Web')).toMatchObject({ status: 404, body: { error: 'No product Web in the workspace of acme/plan.' } });
  });

  it('refuses a name two products share, in two workspaces that list the repository, with 409', async () => {
    const w = world({ listings: { 'acme/plan': [ACME, 'w-beta'] }, products: [MOBILE, { ...MOBILE, id: 'p-beta', workspace_id: 'w-beta' }] });
    expect(await w.get('?repo=acme/plan&product=Mobile')).toMatchObject({
      status: 409,
      body: { error: '2 products are named Mobile in the workspaces that list acme/plan.' },
    });
  });

  it('answers 500 when a read fails, logging why, and 503 with no database', async () => {
    const w = world({ failing: true });
    expect(await w.get('?repo=acme/plan&product=Mobile')).toMatchObject({ status: 500, body: { error: 'The targets could not be read. Try again.' } });
    expect(w.logged).toEqual(['product-repositories: read the workspaces of acme/plan: boom']);
    expect((await world({}, false).get('?repo=acme/plan&product=Mobile')).status).toBe(503);
  });
});
