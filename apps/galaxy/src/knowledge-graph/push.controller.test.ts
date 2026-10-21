import { describe, expect, it } from 'vitest';
import type { RepositoryGraph } from 'omni-loop/kit/lib/knowledge/graph-schema.ts';
import { MAX_GRAPH_PUSH_BYTES } from './push.contract';
import { pushKnowledgeGraph, type GraphPushDeps } from './push.controller';
import type { GraphPushRepository, Pushed, Stored } from './push.repository';
import { graphPushService } from './push.service';

// POST /api/knowledge/graphs (PRD 1798 s1): the sign-in first, then the size, then the body and its graph
// by the kit's own schema, then the push as the caller, through the real service over a repository that
// answers as knowledge_graph_push() does: a member of a workspace listing the repository pushes, anyone
// else is refused 42501 and nothing is kept. No test calls Supabase.

const SHA = '9086e70'.padEnd(40, 'a');
const ADA = 'token-ada';
const EVE = 'token-eve';

/** Each token's workspaces, and each workspace's repositories and products. */
const MEMBERS: Record<string, string[]> = { [ADA]: ['w-acme'], [EVE]: ['w-other'] };
const LISTS: Record<string, string[]> = { 'w-acme': ['acme/api', 'acme/web'], 'w-other': ['other/site'] };
const PRODUCTS = [
  { id: 'p-mobile', key: 'mobile', workspace: 'w-acme', repository: 'acme/api' },
  { id: 'p-field', key: null, workspace: 'w-acme', repository: 'acme/api' },
  { id: 'p-other', key: 'other', workspace: 'w-other', repository: 'acme/api' },
];

const GRAPH: RepositoryGraph = {
  version: 1,
  shape: 'repository',
  nodes: [
    { id: 'P-PRODUCT-1', kind: 'principle', label: 'Quotes stay readable.', status: null, file: '.omni-loop/knowledge/product/principles.md', origin: 'repository' },
    { id: 'BR-PRODUCT-3', kind: 'rule', label: 'A quote shows its total.', status: 'law', file: '.omni-loop/knowledge/product/rules.md', origin: 'repository' },
  ],
  edges: [
    { from: 'BR-PRODUCT-3', to: 'P-PRODUCT-1', kind: 'serves' },
    { from: 'BR-PRODUCT-3', to: 'L-INVOICING-1', kind: 'serves' },
  ],
};

type Kept = { repository: string; sha: string; graph: RepositoryGraph; by: string };

/** A repository answering as knowledge_graph_push() would for `token`'s member, or failing as told. */
function repositoryAs(token: string, kept: Kept[], fail: 'refuse' | 'down' | 'throw' | 'shape' | null): GraphPushRepository {
  return {
    push: (repo, sha, graph) => {
      if (fail === 'throw') return Promise.reject(new Error('socket hang up'));
      if (fail === 'down') return Promise.resolve({ ok: false, code: 'XX000', message: 'connection lost' });
      if (fail === 'shape') return Promise.resolve({ ok: false, code: 'shape', message: 'knowledge_graph_push answered out of shape' });
      if (fail === 'refuse') return Promise.resolve({ ok: false, code: '22023', message: 'Graph: 2 MiB at most.' });
      const repository = repo.toLowerCase();
      const mine = MEMBERS[token] ?? [];
      if (!mine.some((workspace) => LISTS[workspace]?.includes(repository))) {
        return Promise.resolve({ ok: false, code: '42501', message: `You are not a member of a workspace that tracks ${repository}.` });
      }
      const commit = sha.toLowerCase();
      const at = kept.findIndex((row) => row.repository === repository && row.sha === commit);
      if (at >= 0) kept.splice(at, 1);
      kept.push({ repository, sha: commit, graph, by: token });
      const products = PRODUCTS.filter((p) => p.repository === repository && mine.includes(p.workspace)).map(({ id, key }) => ({ id, key }));
      return Promise.resolve<Stored<Pushed>>({ ok: true, value: { repository, sha: commit, nodes: graph.nodes.length, edges: graph.edges.length, products } });
    },
  };
}

/** The deps: a sign-in that knows Ada and Eve, and the push as each. */
function deps({ fail = null, database = true, authDown = false }: { fail?: 'refuse' | 'down' | 'throw' | 'shape' | null; database?: boolean; authDown?: boolean } = {}) {
  const lines: string[] = [];
  const kept: Kept[] = [];
  const connect = (token: string) => ({
    auth: {
      getUser: (jwt: string) => Promise.resolve(
        authDown ? { data: null, error: { status: 503 } }
          : MEMBERS[jwt] ? { data: { user: { id: jwt, email: null } }, error: null } : { data: { user: null }, error: { status: 401 } },
      ),
    },
    service: graphPushService(repositoryAs(token, kept, fail)),
  });
  const given: GraphPushDeps = { connect: database ? connect : null, log: (line) => lines.push(line) };
  return { deps: given, lines, kept };
}

const post = (body: unknown, { token = ADA, raw = false, headers = {} }: { token?: string | null; raw?: boolean; headers?: Record<string, string> } = {}) =>
  new Request('https://omni.example/api/knowledge/graphs', {
    method: 'POST',
    headers: { ...(token === null ? {} : { authorization: `Bearer ${token}` }), 'content-type': 'application/json', ...headers },
    body: raw ? String(body) : JSON.stringify(body),
  });

const PUSH = { repo: 'Acme/API', commit: SHA.toUpperCase(), graph: GRAPH };

/** A push whose JSON body is exactly `bytes` long: rules of 4000-character labels, the last one cut to fit. */
function pushOf(bytes: number) {
  const rule = (n: number, label: string) => ({ ...GRAPH.nodes[1], id: `BR-PRODUCT-${String(100_000 + n)}`, label }) as RepositoryGraph['nodes'][number];
  const bare = JSON.stringify(PUSH).length;
  const each = JSON.stringify(rule(0, 'x'.repeat(4000))).length + 1;
  const lastBare = JSON.stringify(rule(0, '')).length + 1;
  const whole = Math.floor((bytes - bare - lastBare) / each);
  const nodes = [...GRAPH.nodes, ...Array.from({ length: whole }, (_, n) => rule(n, 'x'.repeat(4000)))];
  const last = rule(whole, '');
  const left = bytes - bare - whole * each - (JSON.stringify(last).length + 1);
  return { ...PUSH, graph: { ...GRAPH, nodes: [...nodes, { ...last, label: 'x'.repeat(left) }] } };
}

async function answer(response: Response) {
  return { status: response.status, body: (await response.json()) as unknown, cache: response.headers.get('cache-control') };
}

describe('POST /api/knowledge/graphs (PRD 1798 s1)', () => {
  it('keeps the graph as the caller and answers the repository, the commit, the counts and the products serving it', async () => {
    const { deps: given, kept } = deps();
    expect(await answer(await pushKnowledgeGraph(post(PUSH), given))).toEqual({
      status: 200,
      body: {
        repo: 'acme/api', commit: SHA, nodes: 2, edges: 2,
        products: [
          { key: 'mobile', href: 'https://omni.example/app/products/p-mobile/knowledge' },
          { key: null, href: 'https://omni.example/app/products/p-field/knowledge' },
        ],
      },
      cache: 'no-store',
    });
    expect(kept).toEqual([{ repository: 'acme/api', sha: SHA, graph: GRAPH, by: ADA }]);
  });

  it('links each product where the caller reached the app, behind the proxy too', async () => {
    const { deps: given } = deps();
    const response = await pushKnowledgeGraph(post(PUSH, { headers: { 'x-forwarded-host': 'www.omni-loop.xyz', 'x-forwarded-proto': 'https' } }), given);
    expect(((await response.json()) as { products: Array<{ href: string }> }).products[0]?.href).toBe('https://www.omni-loop.xyz/app/products/p-mobile/knowledge');
  });

  it('stores a repository in no product, and answers no product', async () => {
    const { deps: given, kept } = deps();
    const got = await answer(await pushKnowledgeGraph(post({ ...PUSH, repo: 'acme/web' }), given));
    expect(got).toMatchObject({ status: 200, body: { repo: 'acme/web', products: [] } });
    expect(kept.map((row) => row.repository)).toEqual(['acme/web']);
  });

  it('refuses with 403 a repository no workspace of the caller tracks, and keeps nothing', async () => {
    const { deps: given, kept, lines } = deps();
    expect(await answer(await pushKnowledgeGraph(post(PUSH, { token: EVE }), given))).toEqual({
      status: 403, body: { error: 'You are not a member of a workspace that tracks acme/api.' }, cache: 'no-store',
    });
    expect(kept).toEqual([]);
    expect(lines).toEqual([]);
  });

  it('refuses with 401 a push without a sign-in, or with one that is not valid, before reading the body', async () => {
    const { deps: given, kept } = deps();
    expect(await answer(await pushKnowledgeGraph(post(PUSH, { token: null }), given))).toMatchObject({
      status: 401, body: { error: 'Sign in first: this call needs an Authorization: Bearer token.' },
    });
    expect(await answer(await pushKnowledgeGraph(post('not json', { token: 'token-nobody', raw: true }), given))).toMatchObject({
      status: 401, body: { error: 'This sign-in is not valid any more. Sign in again.' },
    });
    expect(kept).toEqual([]);
  });

  it('answers 503 with no database here, or the sign-in service down', async () => {
    expect(await answer(await pushKnowledgeGraph(post(PUSH), deps({ database: false }).deps))).toMatchObject({
      status: 503, body: { error: 'Knowledge graphs are not available here: this deployment has no database.' },
    });
    expect((await pushKnowledgeGraph(post(PUSH), deps({ authDown: true }).deps)).status).toBe(503);
  });

  it('refuses with 413 a body over 2 MiB, naming the cap, by its length or its header, and takes one of exactly 2 MiB', async () => {
    const { deps: given, kept } = deps();
    expect(await answer(await pushKnowledgeGraph(post(pushOf(MAX_GRAPH_PUSH_BYTES + 1)), given))).toEqual({
      status: 413, body: { error: 'A push carries 2048 KiB at most.' }, cache: 'no-store',
    });
    expect((await pushKnowledgeGraph(post(PUSH, { headers: { 'content-length': String(MAX_GRAPH_PUSH_BYTES + 1) } }), given)).status).toBe(413);
    expect(kept).toEqual([]);
    const fits = pushOf(MAX_GRAPH_PUSH_BYTES);
    expect(JSON.stringify(fits).length).toBe(MAX_GRAPH_PUSH_BYTES);
    expect((await pushKnowledgeGraph(post(fits), given)).status).toBe(200);
  });

  it.each([
    ['not JSON', 'not json', true, 'The body must be a JSON object.'],
    ['a list', [PUSH], false, 'The body must be a JSON object.'],
    ['an unknown field', { ...PUSH, branch: 'main' }, false, 'A knowledge graph push does not carry branch.'],
    ['a repository that is not owner/name', { ...PUSH, repo: 'acme' }, false, 'A knowledge graph push\'s `repo` is malformed: owner/name.'],
    ['a short commit', { ...PUSH, commit: '9086e70' }, false, 'A knowledge graph push\'s `commit` is malformed: the full 40-character commit.'],
    ['no graph', { repo: PUSH.repo, commit: PUSH.commit }, false, /^A knowledge graph push's `graph` is malformed/],
    ['a graph carrying a start', { ...PUSH, graph: { ...GRAPH, start: ['BR-PRODUCT-3'] } }, false, 'The graph does not carry start.'],
    ['a node carrying its hop', { ...PUSH, graph: { ...GRAPH, nodes: [{ ...GRAPH.nodes[0], hop: 0 }, GRAPH.nodes[1]] } }, false, 'The graph\'s node 1 does not carry hop.'],
    ['a neighbourhood for a graph', { ...PUSH, graph: { ...GRAPH, shape: 'neighbourhood' } }, false, /^The graph's `shape` is malformed/],
    ['a product node', { ...PUSH, graph: { ...GRAPH, nodes: [...GRAPH.nodes, { ...GRAPH.nodes[0], id: 'term:quote', kind: 'term', origin: 'product' }] } }, false, /^The graph's `nodes\.2\.origin` is malformed/],
    ['an edge to no node', { ...PUSH, graph: { ...GRAPH, edges: [{ from: 'BR-PRODUCT-3', to: 'BR-PRODUCT-404', kind: 'cites' }] } }, false, 'The graph\'s `edges.0.to` is malformed: BR-PRODUCT-404 is no node of the graph.'],
  ])('refuses with 400 %s, naming the field, and keeps nothing', async (_name, body, raw, error) => {
    const { deps: given, kept } = deps();
    const got = await answer(await pushKnowledgeGraph(post(body, { raw }), given));
    expect(got.status).toBe(400);
    expect((got.body as { error: string }).error).toEqual(typeof error === 'string' ? error : expect.stringMatching(error));
    expect(kept).toEqual([]);
  });

  it('passes on the database\'s refusal of a malformed value with 400, in its words', async () => {
    const { deps: given, lines } = deps({ fail: 'refuse' });
    expect(await answer(await pushKnowledgeGraph(post(PUSH), given))).toMatchObject({ status: 400, body: { error: 'Graph: 2 MiB at most.' } });
    expect(lines).toEqual([]);
  });

  it.each([
    ['the database failing', 'down' as const, 'knowledge-graphs: Acme/API: XX000: connection lost'],
    ['an answer out of shape', 'shape' as const, 'knowledge-graphs: Acme/API: shape: knowledge_graph_push answered out of shape'],
    ['the call throwing', 'throw' as const, 'knowledge-graphs: Acme/API: socket hang up'],
  ])('answers 500 on %s, in plain words, and logs it', async (_name, fail, line) => {
    const { deps: given, lines } = deps({ fail });
    expect(await answer(await pushKnowledgeGraph(post(PUSH), given))).toEqual({
      status: 500, body: { error: 'The knowledge graph could not be stored. Try again.' }, cache: 'no-store',
    });
    expect(lines).toEqual([line]);
  });

  it('keeps one graph for a commit pushed twice, the second', async () => {
    const { deps: given, kept } = deps();
    await pushKnowledgeGraph(post(PUSH), given);
    const second = { ...GRAPH, nodes: [GRAPH.nodes[0]], edges: [] };
    expect(await answer(await pushKnowledgeGraph(post({ ...PUSH, graph: second }), given))).toMatchObject({ status: 200, body: { nodes: 1, edges: 0 } });
    expect(kept).toEqual([{ repository: 'acme/api', sha: SHA, graph: second, by: ADA }]);
  });
});
