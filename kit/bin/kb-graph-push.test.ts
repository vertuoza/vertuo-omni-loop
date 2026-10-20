// PRD 1798, slice s2: `omni kb graph push` through `main()` on a fixture repository with a stubbed
// `fetch`, and the whole-repository builder it sends. No test calls the network.
import { describe, expect, it } from 'vitest';
import { RepositoryGraphSchema } from '../lib/knowledge/graph-schema.ts';
import { buildRepositoryGraph } from '../lib/knowledge/neighbourhood.ts';
import { readKnowledge } from '../lib/knowledge/registers.ts';
import { makeRepo, testContext } from '../test/fixture.ts';
import { main } from './omni.ts';

const HOST = 'omni.test';
const K = '.omni-loop/knowledge';
const CONFIG = 'kit: 1\nrepo:\n  slug: acme/widgets\nask:\n  url: https://omni.test\n';
const entry = (id: string, statement: string, fields: Record<string, string> = {}) =>
  `## ${id}\n\n${statement}\n\n${Object.entries(fields).map(([key, value]) => `${key}: ${value}`).join('\n')}\n\n`;
const FILES = {
  '.omni-loop/config.yml': CONFIG,
  [`${K}/product/principles.md`]: `# Principles\n\n${entry('P-PRODUCT-1', 'Quotes are honest.')}`,
  [`${K}/product/invariants.md`]: '# Invariants\n\n',
  [`${K}/product/rules.md`]: `# Rules\n\n${entry('BR-PRODUCT-1', 'A credit note shows its total.', { Serves: 'P-PRODUCT-1', Source: 'README.md', Governs: '^kit/a/', 'Enforced by': 'kit/a/a.test.ts' })}${entry('BR-PRODUCT-2', 'An invoice is kept.', { Serves: 'L-INVOICING-1', Source: 'README.md' })}`,
  [`${K}/design/screens/quote.md`]: '---\nscreen: quote\nstatus: draft\nimplements: [kit/a/page.ts]\n---\n\n## Regions\n\nx\n',
};
const BUSINESS = {
  state: 'ok',
  business: { name: 'Acme' },
  product: { name: 'Invoicing' },
  claims: [],
  personas: [],
  legal: [{ id: 'L-INVOICING-1', statement: 'An invoice is kept ten years.', source: 'Code de commerce', owner: 'jane' }],
  glossary: [{ term: 'Credit note', meaning: 'A document that cancels part of an invoice.', avoid: [] }],
};
const signedIn = { read: (host: string) => (host === HOST ? { access_token: 'a', refresh_token: 'r' } : null), write: () => {} };
const NOT_SIGNED_IN = { read: () => null, write: () => {} };

async function omni(root: string, argv: readonly string[], options = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(argv, { cwd: root, stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) }, env: {}, tokens: signedIn, ...options });
  return { code, out: out.join(''), err: err.join('') };
}

type Sent = { url: string; body: Record<string, unknown> | null };

/** A page: the business read answers `BUSINESS`; the push answers `push(body)`; every call is kept. */
function page(push: (sent: Sent) => Response = () => Response.json({ repo: 'acme/widgets', commit: 'x', nodes: 0, edges: 0, products: [] })) {
  const calls: Sent[] = [];
  return {
    calls,
    pushes: () => calls.filter(({ url }) => url.endsWith('/api/knowledge/graphs')),
    fetch: (url: string, init: RequestInit) => {
      const sent = { url, body: typeof init.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : null };
      calls.push(sent);
      return Promise.resolve(url.includes('/api/business') ? Response.json(BUSINESS) : push(sent));
    },
  };
}

const repo = (files: Record<string, string> = FILES) => makeRepo({ git: true, files });

describe('omni kb graph push (PRD 1798, s2)', () => {
  it('sends the whole repository graph at HEAD and prints the pushed line and the product links', async () => {
    const { root } = repo();
    const server = page(({ body }) => {
      const graph = body?.graph as { nodes: unknown[]; edges: unknown[] };
      return Response.json({ repo: 'acme/widgets', commit: body?.commit, nodes: graph.nodes.length, edges: graph.edges.length, products: [{ key: 'invoicing', href: 'https://omni.test/app/products/p1/knowledge' }] });
    });
    const run = await omni(root, ['kb', 'graph', 'push'], { fetch: server.fetch });
    const [push] = server.pushes();
    const body = push?.body as { repo: string; commit: string; graph: Record<string, unknown> };
    expect(body.repo).toBe('acme/widgets');
    expect(body.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(Object.keys(body.graph).sort()).toEqual(['edges', 'nodes', 'shape', 'version']);
    expect(body.graph).toMatchObject({ version: 1, shape: 'repository' });
    expect(RepositoryGraphSchema.safeParse(body.graph).success).toBe(true);
    const lines = run.out.trimEnd().split('\n');
    expect(lines).toEqual([
      expect.stringMatching(new RegExp(`^pushed acme/widgets@${body.commit.slice(0, 7)} · \\d+ nodes, \\d+ edges$`)),
      'in products: invoicing · see https://omni.test/app/products/p1/knowledge',
    ]);
    expect(run.code).toBe(0);
  });

  it('refreshes the product knowledge cache before it builds, so the term and the Legal edge are in the body', async () => {
    const { root, read } = repo();
    const server = page();
    await omni(root, ['kb', 'graph', 'push'], { fetch: server.fetch });
    expect(server.calls.map(({ url }) => new URL(url).pathname)).toEqual(['/api/business', '/api/knowledge/graphs']);
    expect(JSON.parse(read('.omni-loop/local/product-knowledge.json'))).toMatchObject({ product: 'Invoicing' });
    const graph = server.pushes()[0]?.body?.graph as { nodes: { id: string; origin: string }[]; edges: { from: string; to: string; kind: string }[] };
    expect(graph.edges).toContainEqual({ from: 'BR-PRODUCT-1', to: 'term:Credit note', kind: 'uses-term' });
    expect(graph.edges).toContainEqual({ from: 'BR-PRODUCT-2', to: 'L-INVOICING-1', kind: 'serves' });
    expect(graph.nodes.map(({ id }) => id)).toEqual(expect.arrayContaining(['BR-PRODUCT-1', 'P-PRODUCT-1', 'test:kit/a/a.test.ts', 'screen:quote']));
    expect(graph.nodes.every(({ origin }) => origin === 'repository')).toBe(true);
    expect(graph.nodes.some(({ id }) => id === 'L-INVOICING-1' || id.startsWith('term:'))).toBe(false);
  });

  it('prints in products: none for a repository in no product', async () => {
    const { root } = repo();
    const run = await omni(root, ['kb', 'graph', 'push'], { fetch: page().fetch });
    expect(run.out.split('\n')[1]).toBe('in products: none');
  });

  it('pushes even when the product knowledge cannot be refreshed', async () => {
    const { root } = repo();
    const fetch = (url: string) => Promise.resolve(url.includes('/api/business') ? Response.json({ error: 'no' }, { status: 404 }) : Response.json({ repo: 'acme/widgets', commit: 'x', nodes: 3, edges: 2, products: [] }));
    const run = await omni(root, ['kb', 'graph', 'push'], { fetch });
    expect(run.code).toBe(0);
    expect(run.out).toContain('· 3 nodes, 2 edges');
  });

  it('refuses a dirty knowledge folder in one line, exit 1, and sends nothing', async () => {
    const { root, write } = repo();
    write(`${K}/product/rules.md`, `# Rules\n\n${entry('BR-PRODUCT-9', 'New.')}`);
    const server = page();
    const run = await omni(root, ['kb', 'graph', 'push'], { fetch: server.fetch });
    expect(run.code).toBe(1);
    expect(run.out.trimEnd().split('\n')).toEqual([`kb graph push: ${K} has uncommitted changes — commit them first, the graph is pushed at a commit`]);
    expect(server.calls).toEqual([]);
  });

  it('says in one line why there is no Omni page or no sign-in, and sends nothing', async () => {
    const server = page();
    const none = repo({ ...FILES, '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\n' });
    expect(await omni(none.root, ['kb', 'graph', 'push'], { fetch: server.fetch })).toEqual({ code: 1, out: 'kb graph push: ask.url is not set, so there is no Omni page to push to\n', err: '' });
    const unsigned = repo();
    expect(await omni(unsigned.root, ['kb', 'graph', 'push'], { fetch: server.fetch, tokens: NOT_SIGNED_IN })).toEqual({ code: 1, out: 'kb graph push: no sign-in for the Omni page (omni signin)\n', err: '' });
    expect(server.calls).toEqual([]);
  });

  it('says in one line that the server is unreachable', async () => {
    const { root } = repo();
    const run = await omni(root, ['kb', 'graph', 'push'], { fetch: () => Promise.reject(new TypeError('fetch failed')) });
    expect(run).toEqual({ code: 1, out: 'kb graph push: the server is unreachable\n', err: '' });
  });

  it('says in one line what the server refused, with its reason', async () => {
    const { root } = repo();
    const server = page(() => Response.json({ error: 'No workspace of yours tracks acme/widgets.' }, { status: 403 }));
    const run = await omni(root, ['kb', 'graph', 'push'], { fetch: server.fetch });
    expect(run).toEqual({ code: 1, out: 'kb graph push: the server refused (403): No workspace of yours tracks acme/widgets.\n', err: '' });
  });

  it('refuses an answer that is not a push result', async () => {
    const { root } = repo();
    const run = await omni(root, ['kb', 'graph', 'push'], { fetch: page(() => Response.json({ ok: true })).fetch });
    expect(run).toEqual({ code: 1, out: 'kb graph push: the server answered something that is not a push result\n', err: '' });
  });

  it('is a usage error with a word after push', async () => {
    const { root } = repo();
    expect((await omni(root, ['kb', 'graph', 'push', 'now'], { fetch: page().fetch })).code).toBe(2);
  });
});

describe('buildRepositoryGraph', () => {
  const build = (legal: { id: string; statement: string; source: string; owner: string }[] = [], glossary: { term: string; meaning: string; avoid: string[] }[] = []) => {
    const { root } = repo();
    const ctx = testContext(root);
    return buildRepositoryGraph({ entries: readKnowledge({ ctx }).entries, records: [], legal, glossary });
  };

  it('holds every entry and every leaf once, with no product node and no hop', () => {
    const graph = build();
    expect(graph.nodes.map(({ id }) => id).sort()).toEqual(['BR-PRODUCT-1', 'BR-PRODUCT-2', 'P-PRODUCT-1', 'path:^kit/a/', 'test:kit/a/a.test.ts']);
    expect(graph.nodes.every((node) => !('hop' in node))).toBe(true);
    expect(RepositoryGraphSchema.safeParse(graph).success).toBe(true);
  });

  it('keeps a serves edge to a Legal id the cache lacks, and a uses-term edge only for a cached term', () => {
    expect(build().edges).toContainEqual({ from: 'BR-PRODUCT-2', to: 'L-INVOICING-1', kind: 'serves' });
    expect(build().edges.some(({ kind }) => kind === 'uses-term')).toBe(false);
    const termed = build([], [{ term: 'invoice', meaning: 'm', avoid: [] }]);
    expect(termed.edges).toContainEqual({ from: 'BR-PRODUCT-2', to: 'term:invoice', kind: 'uses-term' });
    expect(RepositoryGraphSchema.safeParse(termed).success).toBe(true);
  });

  it('keeps an edge once, whichever end it was read from', () => {
    const edges = build().edges;
    expect(new Set(edges.map((edge) => JSON.stringify(edge))).size).toBe(edges.length);
  });
});
