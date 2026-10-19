// PRD 1798, slice s5: `omni kb graph --product <key> <id>` through `main()` with a stubbed `fetch`,
// and P5's reader on version 1 and 2 answers. No test calls the network.
import { describe, expect, it } from 'vitest';
import { readNeighbourhood } from '../lib/knowledge/product-graph.ts';
import { makeRepo } from '../test/fixture.ts';
import { main } from './omni.ts';

const HOST = 'omni.test';
const CONFIG = 'kit: 1\nrepo:\n  slug: acme/widgets\nask:\n  url: https://omni.test\n';
const SHA = 'a'.repeat(40);
const signedIn = { read: (host: string) => (host === HOST ? { access_token: 'a', refresh_token: 'r' } : null), write: () => {} };
const NOT_SIGNED_IN = { read: () => null, write: () => {} };

const ANSWER = {
  version: 2,
  shape: 'neighbourhood',
  repo: null,
  start: ['L-INVOICING-1'],
  depth: 2,
  product: { state: 'server', key: 'invoicing', cachedOn: null },
  nodes: [
    { id: 'L-INVOICING-1', kind: 'legal', label: 'An invoice is kept ten years.', status: null, file: null, origin: 'product', hop: 0, repo: null },
    { id: 'back-end/BR-INVOICE-1', kind: 'rule', label: 'An invoice is stored.', status: 'law', file: 'k/rules.md', origin: 'repository', hop: 1, repo: 'back-end' },
  ],
  edges: [{ from: 'back-end/BR-INVOICE-1', to: 'L-INVOICING-1', kind: 'serves' }],
  unresolved: [],
  repositories: [
    { repo: 'back-end', commit: SHA, pushedAt: '2026-10-13T14:02:00.000Z', pushedBy: 'pierrederval', graph: 'own' },
    { repo: 'front-end', commit: null, pushedAt: null, pushedBy: null, graph: 'own' },
  ],
};

async function omni(argv: readonly string[], options: Record<string, unknown> = {}) {
  const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': CONFIG } });
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(argv, { cwd: root, stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) }, env: {}, tokens: signedIn, ...options });
  return { code, out: out.join(''), err: err.join('') };
}

function page(respond: () => Response = () => Response.json(ANSWER)) {
  const urls: string[] = [];
  return { urls, fetch: (url: string) => { urls.push(url); return Promise.resolve(respond()); } };
}

describe('omni kb graph --product (PRD 1798, s5)', () => {
  it('prints a header per repository, the neighbourhood with the short name before each id, and the server line', async () => {
    const server = page();
    const run = await omni(['kb', 'graph', '--product', 'invoicing', 'L-INVOICING-1', '--depth', '2'], { fetch: server.fetch });
    expect(run.code).toBe(0);
    const lines = run.out.trimEnd().split('\n');
    expect(lines.slice(0, 2)).toEqual(['back-end @aaaaaaa · pushed 2026-10-13 14:02 by @pierrederval', 'front-end · never pushed']);
    expect(lines[2]).toContain('L-INVOICING-1 · legal');
    expect(lines[3]).toMatch(/back-end back-end\/BR-INVOICE-1\s+rule\s+An invoice is stored\.$/);
    expect(lines.at(-1)).toBe('product knowledge: server (invoicing).');
    const url = new URL(server.urls[0] ?? '');
    expect(url.pathname).toBe('/api/products/invoicing/knowledge/graph');
    expect(url.searchParams.get('id')).toBe('L-INVOICING-1');
    expect(url.searchParams.get('depth')).toBe('2');
  });

  it('leaves depth to the server when none is given', async () => {
    const server = page();
    await omni(['kb', 'graph', '--product', 'invoicing', 'L-INVOICING-1'], { fetch: server.fetch });
    expect(new URL(server.urls[0] ?? '').searchParams.has('depth')).toBe(false);
  });

  it('prints --json as the answer unchanged', async () => {
    const run = await omni(['kb', 'graph', '--product', 'invoicing', 'L-INVOICING-1', '--json'], { fetch: page().fetch });
    expect(JSON.parse(run.out)).toEqual(ANSWER);
    expect(run.code).toBe(0);
  });

  it('exits 2 with the usage line for a depth outside 1 to 3, no id, or two ids, calling nothing', async () => {
    const server = page();
    for (const argv of [['--depth', '4', 'X'], ['--depth', '0', 'X'], [], ['A', 'B']]) {
      const run = await omni(['kb', 'graph', '--product', 'invoicing', ...argv], { fetch: server.fetch });
      expect(run.code).toBe(2);
      expect(run.err).toContain('usage: omni kb graph --product <key> <id> [--depth <1-3>] [--json]');
    }
    expect(server.urls).toEqual([]);
  });

  it('fails in one line: no sign-in, the server unreachable, a refusal, an answer that is no graph', async () => {
    const lines = async (options: Record<string, unknown>) => {
      const run = await omni(['kb', 'graph', '--product', 'invoicing', 'X'], options);
      expect(run.code).toBe(1);
      expect(run.out).toBe('');
      return run.err.trimEnd().split('\n');
    };
    expect(await lines({ tokens: NOT_SIGNED_IN, fetch: page().fetch })).toEqual(['kb graph: no sign-in for the Omni page (omni signin)']);
    expect(await lines({ fetch: () => Promise.reject(new Error('down')) })).toHaveLength(1);
    expect(await lines({ fetch: page(() => Response.json({ error: 'no such node' }, { status: 404 })).fetch })).toEqual([expect.stringContaining('the server refused (404)')]);
    expect(await lines({ fetch: page(() => Response.json({ hello: 1 })).fetch })).toEqual(['kb graph: the server answered something that is not a knowledge graph']);
  });
});

describe('readNeighbourhood (P5 reader, PRD 1798 s5)', () => {
  const V1 = {
    version: 1,
    shape: 'neighbourhood',
    repo: 'acme/widgets',
    start: ['BR-1'],
    depth: 1,
    product: { state: 'cached', key: 'invoicing', cachedOn: '2026-10-01' },
    nodes: [{ id: 'BR-1', kind: 'rule', label: 'x', status: 'law', file: 'k.md', origin: 'repository', hop: 0 }],
    edges: [],
  };

  it('reads version 2, and version 1 with no repositories', () => {
    expect(readNeighbourhood(ANSWER)?.version).toBe(2);
    expect(readNeighbourhood(V1)).toMatchObject({ version: 1, repositories: [], unresolved: [] });
  });

  it('refuses another version and an unknown field', () => {
    expect(readNeighbourhood({ ...V1, version: 3 })).toBeNull();
    expect(readNeighbourhood({ ...ANSWER, extra: 1 })).toBeNull();
    expect(readNeighbourhood(null)).toBeNull();
  });
});
