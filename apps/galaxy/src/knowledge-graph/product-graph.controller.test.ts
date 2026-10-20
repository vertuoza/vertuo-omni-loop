import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { RepositoryGraph } from 'vertuo-omni-plan/kit/lib/knowledge/graph-schema.ts';
import { ProductNeighbourhoodSchema } from 'vertuo-omni-plan/kit/lib/knowledge/product-graph.ts';
import { readProductGraph, type ProductGraphDeps } from './product-graph.controller';
import type { ProductGraphRepository } from './product-graph.repository';
import { productGraphService } from './product-graph.service';

// GET /api/products/<key>/knowledge/graph?id=…&depth=… (PRD 1798 s3): the sign-in first, then the query,
// then the read as the caller, through the real service over a repository answering as row-level
// security would: a member of the product's workspace reads it, anyone else reads no such product.
// No test calls Supabase.

const SHA = '9086e70'.padEnd(40, 'a');
const ADA = 'token-ada';
const EVE = 'token-eve';

const MEMBERS: Record<string, string[]> = { [ADA]: ['w-acme'], [EVE]: ['w-other'] };
const PRODUCTS = [
  { id: 'p-omni', key: 'omni-loop', name: 'Omni Loop', workspace: 'w-acme' },
  { id: 'p-which', key: 'which', name: 'Which', workspace: 'w-acme' },
];

/** The front-end: a law serving a Legal entry and a principle, the principle served by another rule, its test, an unheld Legal id. */
const FRONT: RepositoryGraph = {
  version: 1,
  shape: 'repository',
  nodes: [
    { id: 'P-PRODUCT-1', kind: 'principle', label: 'Quotes stay readable.', status: null, file: '.omni-loop/knowledge/product/principles.md', origin: 'repository' },
    { id: 'BR-PRODUCT-3', kind: 'rule', label: 'A quote shows its total.', status: 'law', file: '.omni-loop/knowledge/product/rules.md', origin: 'repository' },
    { id: 'BR-PRODUCT-4', kind: 'rule', label: 'A quote names its client.', status: 'rule', file: '.omni-loop/knowledge/product/rules.md', origin: 'repository' },
  ],
  edges: [
    { from: 'BR-PRODUCT-3', to: 'L-INVOICING-1', kind: 'serves' },
    { from: 'BR-PRODUCT-3', to: 'P-PRODUCT-1', kind: 'serves' },
    { from: 'BR-PRODUCT-4', to: 'P-PRODUCT-1', kind: 'serves' },
    { from: 'BR-PRODUCT-4', to: 'L-TAX-7', kind: 'serves' },
  ],
};

/** A repository answering as row-level security would for `token`'s member, or failing as told. */
function repositoryAs(token: string, fail: boolean): ProductGraphRepository {
  const readable = PRODUCTS.filter((product) => (MEMBERS[token] ?? []).includes(product.workspace)).map(({ id, key, name }) => ({ id, key, name }));
  const failing = () => Promise.reject(new Error('socket hang up'));
  return {
    productByKey: (key) => (fail ? failing() : Promise.resolve(readable.find((product) => product.key === key) ?? null)),
    productById: (id) => Promise.resolve(readable.find((product) => product.id === id) ?? null),
    links: () => Promise.resolve([{ repository: 'vertuoza/vertuo-omni-loop', knowledge: 'own' as const }, { repository: 'vertuoza/back-end', knowledge: 'own' as const }]),
    legal: () => Promise.resolve([{ code: 'INVOICING', number: 1, statement: 'An invoice keeps its number.', retired_at: null }]),
    glossary: () => Promise.resolve([]),
    never: () => Promise.resolve([{ seq: 3, body: 'Never sell the data.', removed_at: null }]),
    latestGraph: (name) => Promise.resolve(name === 'vertuoza/vertuo-omni-loop'
      ? { sha: SHA, graph: FRONT, pushed_at: '2026-10-13T14:02:00+00:00', pushed_by_login: 'pierrederval' }
      : null),
  };
}

function deps({ database = true, fail = false }: { database?: boolean; fail?: boolean } = {}) {
  const lines: string[] = [];
  const connect = (token: string) => ({
    auth: {
      getUser: (jwt: string) => Promise.resolve(MEMBERS[jwt] ? { data: { user: { id: jwt, email: null } }, error: null } : { data: { user: null }, error: { status: 401 } }),
    },
    service: productGraphService(repositoryAs(token, fail)),
  });
  const given: ProductGraphDeps = { connect: database ? connect : null, log: (line) => lines.push(line) };
  return { deps: given, lines };
}

/** The read of product `key`'s graph with the query `query`, as `token`. */
async function read(key: string, query: string, { token = ADA, given = deps().deps }: { token?: string | null; given?: ProductGraphDeps } = {}) {
  const headers: Record<string, string> = token === null ? {} : { authorization: `Bearer ${token}` };
  const response = await readProductGraph(new Request(`https://omni.test/api/products/${key}/knowledge/graph${query}`, { headers }), key, given);
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

describe('GET /api/products/<key>/knowledge/graph', () => {
  it('answers P5’s neighbourhood at version 2, with its unresolved and its repositories', async () => {
    const { status, body } = await read('omni-loop', '?id=L-INVOICING-1');
    expect(status).toBe(200);
    expect(ProductNeighbourhoodSchema.parse(body)).toEqual(body);
    expect(body).toMatchObject({
      version: 2,
      shape: 'neighbourhood',
      repo: null,
      start: ['L-INVOICING-1'],
      depth: 1,
      product: { state: 'server', key: 'omni-loop', cachedOn: null },
      edges: [{ from: 'vertuo-omni-loop/BR-PRODUCT-3', to: 'L-INVOICING-1', kind: 'serves' }],
      unresolved: [{ repo: 'vertuo-omni-loop', node: 'vertuo-omni-loop/BR-PRODUCT-4', id: 'L-TAX-7' }],
      repositories: [
        { repo: 'vertuo-omni-loop', commit: SHA, pushedAt: '2026-10-13T14:02:00.000Z', pushedBy: 'pierrederval', graph: 'own' },
        { repo: 'back-end', commit: null, pushedAt: null, pushedBy: null, graph: 'own' },
      ],
    });
    expect((body.nodes as Array<{ id: string; repo: string | null }>).map(({ id, repo }) => [id, repo])).toEqual([
      ['L-INVOICING-1', null],
      ['vertuo-omni-loop/BR-PRODUCT-3', 'vertuo-omni-loop'],
    ]);
  });

  it('walks only the nodes within the depth asked', async () => {
    const hops = async (query: string) => ((await read('omni-loop', query)).body.nodes as Array<{ id: string; hop: number }>).map(({ id, hop }) => `${id}@${String(hop)}`);
    expect(await hops('?id=L-INVOICING-1&depth=2')).toEqual(['L-INVOICING-1@0', 'vertuo-omni-loop/BR-PRODUCT-3@1', 'vertuo-omni-loop/P-PRODUCT-1@2']);
    expect(await hops('?id=L-INVOICING-1&depth=3')).toContain('vertuo-omni-loop/BR-PRODUCT-4@3');
    expect(await hops('?id=never%233')).toEqual(['never#3@0']);
  });

  it('refuses a query with no id, or a depth outside 1 to 3, with 400', async () => {
    for (const query of ['', '?id=', '?depth=2']) expect(await read('omni-loop', query)).toEqual({ status: 400, body: { error: expect.stringContaining('`id=<id>`') as string } });
    for (const depth of ['0', '4', '1.5', 'two', '']) {
      expect(await read('omni-loop', `?id=L-INVOICING-1&depth=${depth}`)).toEqual({ status: 400, body: { error: 'The depth is a whole number from 1 to 3.' } });
    }
  });

  it('refuses no sign-in, or one no longer valid, with 401, reading nothing', async () => {
    expect((await read('omni-loop', '?id=L-INVOICING-1', { token: null })).status).toBe(401);
    expect((await read('omni-loop', '?id=L-INVOICING-1', { token: 'token-gone' })).status).toBe(401);
  });

  it('answers 404 for a product the caller cannot read, the same as for one that does not exist', async () => {
    const stranger = await read('omni-loop', '?id=L-INVOICING-1', { token: EVE });
    const none = await read('no-such', '?id=L-INVOICING-1');
    expect(stranger.status).toBe(404);
    expect(stranger.body).toEqual({ error: 'No product omni-loop that you can read.' });
    expect(none).toEqual({ status: 404, body: { error: 'No product no-such that you can read.' } });
    expect(await read('Not A Key', '?id=L-INVOICING-1')).toEqual({ status: 404, body: { error: 'No product Not A Key that you can read.' } });
  });

  it('answers 404 for an id the joined graph does not hold', async () => {
    expect(await read('omni-loop', '?id=BR-PRODUCT-99')).toEqual({ status: 404, body: { error: 'No node BR-PRODUCT-99 in the knowledge graph of omni-loop.' } });
  });

  it('answers 404 for a bare repository id, naming the prefixed id it matches (#2221)', async () => {
    expect(await read('omni-loop', '?id=BR-PRODUCT-3')).toEqual({
      status: 404,
      body: { error: 'No node BR-PRODUCT-3 in the knowledge graph of omni-loop. Did you mean vertuo-omni-loop/BR-PRODUCT-3?' },
    });
  });

  it('reaches the graph of a product keyed `which`, beside the fixed segment', async () => {
    const { status, body } = await read('which', '?id=L-INVOICING-1');
    expect(status).toBe(200);
    expect(body.product).toEqual({ state: 'server', key: 'which', cachedOn: null });
    const products = fileURLToPath(new URL('../../app/api/products/', import.meta.url));
    expect(existsSync(join(products, '[key]', 'knowledge', 'graph', 'route.ts'))).toBe(true);
    const fixed = readdirSync(products).filter((segment) => !segment.startsWith('['));
    expect(fixed).toEqual(expect.arrayContaining(['which', 'targets', 'import']));
    for (const segment of fixed) expect(existsSync(join(products, segment, 'knowledge')), segment).toBe(false);
  });

  it('answers 503 with no database here, and 500, logged, when a read fails', async () => {
    expect(await read('omni-loop', '?id=L-INVOICING-1', { given: deps({ database: false }).deps })).toEqual({
      status: 503, body: { error: 'Knowledge graphs are not available here: this deployment has no database.' },
    });
    const failing = deps({ fail: true });
    expect(await read('omni-loop', '?id=L-INVOICING-1', { given: failing.deps })).toEqual({ status: 500, body: { error: 'The knowledge graph could not be read. Try again.' } });
    expect(failing.lines).toEqual(['knowledge-graphs: omni-loop: socket hang up']);
  });
});
