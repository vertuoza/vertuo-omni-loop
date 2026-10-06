import { generateKeyPairSync } from 'node:crypto';
import { graphOfTexts } from 'vertuo-omni-plan/kit/lib/knowledge/graph.ts';
import { describe, expect, it, vi } from 'vitest';
import { GithubDeferred, GithubPaused, memoryGithubStore, type GithubStore, type Priority } from '@omni/github';
import { CONFIG_BATCH, configQuery, GRAPH_TTL_MS, knowledgeReader, LISTING_TTL_MS } from './github';
import { sure } from '../arcade/test/sure';

vi.mock('server-only', () => ({}));

// The knowledge map's GitHub reader, against a stubbed `fetch`: never GitHub itself. A small fake
// GitHub answers the App's token route, an installation's repository listing and the two GraphQL
// queries (the configs, then one knowledge folder); each test says what the repositories hold.

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const CREDS = { appId: '123456', privateKey: privateKey.export({ type: 'pkcs1', format: 'pem' }).toString() };
const NOW = Date.parse('2026-09-29T10:00:00Z');
const INSTALLATION = 91001;

const CONFIG = 'kit: 1\nrepo:\n  slug: acme/widgets\n  defaultBranch: main\n';
const K = '.omni-loop/knowledge';
const FILES = {
  [`${K}/product/principles.md`]: '# Principles\n\n## P-PRODUCT-1\n\nEvery change is reviewed.\n\nWhy: Nobody merges alone.\n',
  [`${K}/product/rules.md`]: '# Rules\n\n## BR-PRODUCT-1\n\nOne approval.\n\nServes: P-PRODUCT-1\nEnforced by: unenforced\n',
  [`${K}/domains/quote/README.md`]: '# Quote\n\nGlossary term: Quote\n',
  [`${K}/domains/quote/principles.md`]: '# Quote\n\n## P-QUOTE-1\n\nA quote is never lost.\n\nProposed: invade 2026-09-25\n',
  [`${K}/cross-domain/product--quote.md`]: '# Between\n\n## X-PRODUCT-QUOTE-1\n\nA quote needs a review.\n\nKind: rule\nServes: P-QUOTE-1\n',
};

type Repo = { name: string; archived?: boolean; config?: string | undefined; files?: Record<string, string>; truncated?: string };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

/** The folder under `dir` as the `files` fragment reads it, or null when nothing sits there. */
function folder(files: Record<string, string>, dir: string, truncated?: string) {
  const under = Object.keys(files).filter((path) => path.startsWith(`${dir}/`)).map((path) => path.slice(dir.length + 1));
  if (!under.length) return null;
  const names = [...new Set(under.map((rest) => sure(rest.split('/')[0], 'rest.split(\'/\')[0]')))].sort();
  return {
    entries: names.map((name) => (under.includes(name)
      ? { name, type: 'blob', object: { text: files[`${dir}/${name}`], isTruncated: `${dir}/${name}` === truncated } }
      : { name, type: 'tree', object: {} })),
  };
}

function fakeGithub(repos: Repo[], { fail }: { fail?: RegExp } = {}) {
  const calls: string[] = [];
  let tokens = 0;
  const byName = new Map(repos.map((r) => [r.name.toLowerCase(), r]));
  const fetchImpl = vi.fn((href: string, init: RequestInit) => {
    const url = new URL(href);
    const body = typeof init.body === 'string' && init.body !== '' ? (JSON.parse(init.body) as { query: string; variables: Record<string, string> }) : null;
    const what = body ? (body.query.includes('fragment files') ? `graphql knowledge ${body.variables.owner}/${body.variables.name}` : 'graphql configs') : `${init.method ?? 'GET'} ${url.pathname}${url.search}`;
    calls.push(what);
    if (fail?.test(what)) return Promise.resolve(json({ message: 'boom' }, 502));
    if (url.pathname === `/app/installations/${INSTALLATION}/access_tokens` && init.method === 'POST') {
      tokens += 1;
      return Promise.resolve(json({ token: `ghs_${tokens}`, expires_at: new Date(NOW + 60 * 60_000).toISOString() }, 201));
    }
    if (url.pathname === '/orgs/acme/installation') return Promise.resolve(json({ id: INSTALLATION, account: { login: 'acme', type: 'Organization' } }));
    if (url.pathname === '/orgs/solo/installation') return Promise.resolve(json({ message: 'Not Found' }, 404));
    if (url.pathname === '/users/solo/installation') return Promise.resolve(json({ id: 777, account: { login: 'solo', type: 'User' } }));
    if (url.pathname.endsWith('/installation')) return Promise.resolve(json({ message: 'Not Found' }, 404));
    if (url.pathname === '/installation/repositories') {
      expect((init.headers as Record<string, string>).authorization).toMatch(/^Bearer ghs_/);
      const page = Number(url.searchParams.get('page'));
      const slice = repos.slice((page - 1) * 100, page * 100);
      return Promise.resolve(json({ total_count: repos.length, repositories: slice.map((r) => ({ full_name: r.name, archived: r.archived ?? false })) }));
    }
    if (url.pathname === '/graphql' && body) {
      if (body.query.includes('fragment files')) {
        const repo = byName.get(`${body.variables.owner}/${body.variables.name}`.toLowerCase());
        if (!repo) return Promise.resolve(json({ data: { repository: null }, errors: [{ message: 'Could not resolve to a Repository' }] }));
        const files = repo.files ?? {};
        const at = (expression: string | undefined) => sure(expression, 'expression').replace(/^HEAD:/, '');
        const domains = folder(files, at(body.variables.domains));
        return Promise.resolve(json({
          data: {
            repository: {
              product: folder(files, at(body.variables.product), repo.truncated),
              domains: domains && {
                entries: domains.entries.map((d) => ({ ...d, object: folder(files, `${at(body.variables.domains)}/${d.name}`, repo.truncated) })),
              },
              cross: folder(files, at(body.variables.cross), repo.truncated),
            },
          },
        }));
      }
      const data: Record<string, unknown> = {};
      for (const m of body.query.matchAll(/(r\d+): repository\(owner: "([^"]+)", name: "([^"]+)"\) \{ object\(expression: "HEAD:\.omni-loop\/config\.yml"\)/g)) {
        const repo = byName.get(`${m[2]}/${m[3]}`.toLowerCase());
        data[sure(m[1], 'm[1]')] = repo ? { object: repo.config === undefined ? null : { text: repo.config } } : null;
      }
      return Promise.resolve(json({ data }));
    }
    return Promise.resolve(json({ message: `no route for ${what}` }, 500));
  });
  return { fetchImpl, calls, tokens: () => tokens };
}

function reader(repos: Repo[], options: { fail?: RegExp; store?: GithubStore; priority?: Priority } = {}) {
  const github = fakeGithub(repos, options);
  const clock = { now: NOW };
  const log = vi.fn();
  const budget = { store: options.store ?? null, ...(options.priority ? { priority: options.priority } : {}) };
  return { ...github, clock, log, read: knowledgeReader(CREDS, github.fetchImpl, () => clock.now, log, budget) };
}

describe('the repositories an installation offers the knowledge map', () => {
  it('lists, by name, the repositories that carry the loop\'s config, and leaves the others and the archived ones out', async () => {
    const { read, calls } = reader([
      { name: 'acme/widgets', config: CONFIG },
      { name: 'acme/Anvils', config: CONFIG },
      { name: 'acme/website' },
      { name: 'acme/old-plan', config: CONFIG, archived: true },
    ]);
    expect(await read.repos(INSTALLATION)).toEqual(['acme/Anvils', 'acme/widgets']);
    expect(calls).toEqual([
      `POST /app/installations/${INSTALLATION}/access_tokens`,
      'GET /installation/repositories?per_page=100&page=1',
      'graphql configs',
    ]);
  });

  it('reads every page of the installation, and checks fifty configs per call', async () => {
    const many = Array.from({ length: 130 }, (_, i) => ({ name: `acme/repo-${String(i).padStart(3, '0')}`, config: i % 2 ? CONFIG : undefined }));
    const { read, calls } = reader(many);
    const listed = await read.repos(INSTALLATION);
    expect(listed).toHaveLength(65);
    expect(listed[0]).toBe('acme/repo-001');
    expect(calls.filter((c) => c.startsWith('GET /installation/repositories'))).toHaveLength(2);
    expect(calls.filter((c) => c === 'graphql configs')).toHaveLength(Math.ceil(130 / CONFIG_BATCH));
  });

  it('leaves out a repository whose config cannot be read, saying why in the log', async () => {
    const { read, log } = reader([{ name: 'acme/widgets', config: CONFIG }, { name: 'acme/broken', config: 'kit: [nope' }]);
    expect(await read.repos(INSTALLATION)).toEqual(['acme/widgets']);
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/^knowledge map: acme\/broken is left out, its config cannot be read — /));
  });

  it('keeps the listing five minutes, and its token until a minute before it expires', async () => {
    const { read, calls, clock, tokens } = reader([{ name: 'acme/widgets', config: CONFIG }]);
    await read.repos(INSTALLATION);
    clock.now += LISTING_TTL_MS - 1;
    await read.repos(INSTALLATION);
    expect(calls.filter((c) => c === 'graphql configs')).toHaveLength(1);
    clock.now += 2;
    await read.repos(INSTALLATION);
    expect(calls.filter((c) => c === 'graphql configs')).toHaveLength(2);
    expect(tokens()).toBe(1);
  });

  it('throws when GitHub refuses the listing, so the page can offer the checkout alone', async () => {
    const { read } = reader([{ name: 'acme/widgets', config: CONFIG }], { fail: /repositories/ });
    await expect(read.repos(INSTALLATION)).rejects.toThrow(/GitHub answered 502 to \/installation\/repositories/);
  });

  it('writes each repository as a plain string in the configs query', () => {
    expect(configQuery(['acme/widgets', 'acme/a.b_c-d'])).toBe(
      'query {\n'
      + '  r0: repository(owner: "acme", name: "widgets") { object(expression: "HEAD:.omni-loop/config.yml") { ... on Blob { text } } }\n'
      + '  r1: repository(owner: "acme", name: "a.b_c-d") { object(expression: "HEAD:.omni-loop/config.yml") { ... on Blob { text } } }\n'
      + '}',
    );
  });
});

describe('a repository\'s knowledge, read from GitHub', () => {
  it('is the graph the kit builds from the same files, under the repository\'s own name', async () => {
    const { read } = reader([{ name: 'acme/widgets', config: CONFIG, files: { ...FILES, 'README.md': '## P-PRODUCT-9\n\nNot knowledge.\n' } }]);
    const graph = await read.graph(INSTALLATION, 'acme/widgets');
    expect(graph).toEqual(graphOfTexts({ texts: FILES, knowledgeRoot: K, repo: 'acme/widgets' }));
    expect(graph?.entries.map((e) => e.id)).toEqual(['P-PRODUCT-1', 'BR-PRODUCT-1', 'P-QUOTE-1', 'X-PRODUCT-QUOTE-1']);
    expect(graph?.links).toContainEqual({ from: 'BR-PRODUCT-1', to: 'P-PRODUCT-1', kind: 'serves' });
  });

  it('reads the folder where the repository\'s config puts it, and finds the repository whatever the case asked', async () => {
    const moved = Object.fromEntries(Object.entries(FILES).map(([path, text]) => [path.replace(K, 'docs/kb'), text]));
    const { read, calls } = reader([{ name: 'acme/Anvils', config: `${CONFIG}paths:\n  knowledge: docs/kb/\n`, files: moved }]);
    const graph = await read.graph(INSTALLATION, 'ACME/anvils');
    expect(graph?.repo).toBe('acme/Anvils');
    expect(graph?.entries).toHaveLength(4);
    expect(sure(graph?.entries[0], 'graph?.entries[0]').file).toBe('docs/kb/product/principles.md');
    expect(calls).toContain('graphql knowledge acme/Anvils');
  });

  it('is an empty graph for a repository set up without knowledge yet', async () => {
    const { read } = reader([{ name: 'acme/widgets', config: CONFIG }]);
    expect(await read.graph(INSTALLATION, 'acme/widgets')).toEqual({ version: 1, repo: 'acme/widgets', domains: [], entries: [], links: [], loose: [], unserved: [] });
  });

  it('never reads a repository the installation does not list', async () => {
    const { read, calls, log } = reader([{ name: 'acme/widgets', config: CONFIG }, { name: 'acme/website', files: FILES }]);
    expect(await read.graph(INSTALLATION, 'acme/website')).toBeNull();
    expect(await read.graph(INSTALLATION, 'other/secret')).toBeNull();
    expect(calls.some((c) => c.startsWith('graphql knowledge'))).toBe(false);
    expect(log).toHaveBeenCalledWith(`knowledge map: acme/website is not a repository of installation ${INSTALLATION} that carries .omni-loop/config.yml`);
  });

  it('is null, and says why in the log, when GitHub fails or a register is too large to read', async () => {
    const failing = reader([{ name: 'acme/widgets', config: CONFIG, files: FILES }], { fail: /graphql knowledge/ });
    expect(await failing.read.graph(INSTALLATION, 'acme/widgets')).toBeNull();
    expect(failing.log).toHaveBeenCalledWith('knowledge map: acme/widgets could not be read from GitHub — GitHub answered 502 to a GraphQL query');

    const huge = reader([{ name: 'acme/widgets', config: CONFIG, files: FILES, truncated: `${K}/product/rules.md` }]);
    expect(await huge.read.graph(INSTALLATION, 'acme/widgets')).toBeNull();
    expect(huge.log).toHaveBeenCalledWith(`knowledge map: acme/widgets could not be read from GitHub — ${K}/product/rules.md is too large to read`);
  });

  it('keeps a graph one minute', async () => {
    const { read, calls, clock } = reader([{ name: 'acme/widgets', config: CONFIG, files: FILES }]);
    await read.graph(INSTALLATION, 'acme/widgets');
    clock.now += GRAPH_TTL_MS - 1;
    await read.graph(INSTALLATION, 'acme/widgets');
    expect(calls.filter((c) => c.startsWith('graphql knowledge'))).toHaveLength(1);
    clock.now += 2;
    await read.graph(INSTALLATION, 'acme/widgets');
    expect(calls.filter((c) => c.startsWith('graphql knowledge'))).toHaveLength(2);
  });
});

describe('the installation a workspace owns', () => {
  it('is the one it stored, without asking GitHub', async () => {
    const { read, calls } = reader([]);
    expect(await read.installationFor({ github_org: 'acme', github_installation_id: 42 })).toBe(42);
    expect(calls).toEqual([]);
  });

  it('is found on its GitHub account when it stored none: an org\'s, else a person\'s', async () => {
    const { read } = reader([]);
    expect(await read.installationFor({ github_org: 'acme', github_installation_id: null })).toBe(INSTALLATION);
    expect(await read.installationFor({ github_org: 'solo', github_installation_id: null })).toBe(777);
    expect(await read.installationFor({ github_org: 'nobody', github_installation_id: null })).toBeNull();
    expect(await read.installationFor({ github_org: null, github_installation_id: null })).toBeNull();
  });
});

describe('the knowledge reader and the budget (PRD 902, s6)', () => {
  const RESET = NOW + 30 * 60_000;
  const installationCalls = (calls: string[]) => calls.filter((c) => !c.includes('/access_tokens') && !c.endsWith('/installation'));

  it('sends nothing while the installation is paused, and says so', async () => {
    const store = memoryGithubStore();
    await store.pause(INSTALLATION, 'core', RESET, NOW);
    const { read, calls } = reader([{ name: 'acme/widgets', config: CONFIG }], { store });
    await expect(read.repos(INSTALLATION)).rejects.toBeInstanceOf(GithubPaused);
    expect(installationCalls(calls)).toEqual([]);
  });

  it('steps back below 20% of the limit by default, a background reader', async () => {
    const store = memoryGithubStore();
    await store.saveBudget(INSTALLATION, 'core', { limit: 5000, remaining: 999, resetAt: RESET, at: NOW });
    const { read, calls } = reader([{ name: 'acme/widgets', config: CONFIG }], { store });
    await expect(read.repos(INSTALLATION)).rejects.toBeInstanceOf(GithubDeferred);
    expect(installationCalls(calls)).toEqual([]);
  });

  it('reads below the floor when a person waits on it, an interactive reader', async () => {
    const store = memoryGithubStore();
    await store.saveBudget(INSTALLATION, 'core', { limit: 5000, remaining: 999, resetAt: RESET, at: NOW });
    const { read } = reader([{ name: 'acme/widgets', config: CONFIG }], { store, priority: 'interactive' });
    expect(await read.repos(INSTALLATION)).toEqual(['acme/widgets']);
  });

  it('does not let a paused GraphQL budget into a knowledge read', async () => {
    const store = memoryGithubStore();
    const { read, calls, log, clock } = reader([{ name: 'acme/widgets', config: CONFIG, files: FILES }], { store, priority: 'interactive' });
    await read.repos(INSTALLATION);
    await store.pause(INSTALLATION, 'graphql', RESET, clock.now);
    expect(await read.graph(INSTALLATION, 'acme/widgets')).toBeNull();
    expect(calls.some((c) => c.startsWith('graphql knowledge'))).toBe(false);
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/^knowledge map: acme\/widgets could not be read from GitHub — GitHub paused until /));
  });
});
