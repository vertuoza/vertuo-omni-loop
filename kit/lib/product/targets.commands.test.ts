// PRD 1548, s10 (acceptance 12): with `plan: { product: Mobile }`, `omni board`, `omni next`,
// `omni care` and `omni flow` read Mobile's targets from the Omni page, as `omni targets` does, and
// with `plan.targets[]` they read the config's as before, calling no server. Through `main()` on a
// fixture plan repository: `gh` and the server are fakes, and nothing here calls the network.
import type { ExecFileSyncOptions } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { main } from '../../bin/omni.ts';
import { makeRepo, realExec } from '../../test/fixture.ts';

const HOST = 'omni.test';
const PRODUCT = 'kit: 1\nrepo:\n  slug: acme/plan\nask:\n  url: https://omni.test\nplan:\n  guide: null\n  product: Mobile\n';
const LISTED = [
  'kit: 1',
  'repo:',
  '  slug: acme/plan',
  'plan:',
  '  targets:',
  '    - repo: acme/backend',
  '      role: back-end',
  '      knowledge: none',
  '    - repo: acme/frontend',
  '      role: front-end',
  '      knowledge: own',
  '',
].join('\n');
const LINKS = {
  product: { name: 'Mobile' },
  targets: [
    { repo: 'acme/backend', role: 'back-end', knowledge: 'none', readAt: null, readOnly: false, consumes: [] },
    { repo: 'acme/frontend', role: 'front-end', knowledge: 'own', readAt: null, readOnly: false, consumes: ['acme/backend'] },
  ],
};
const PLAN = [
  '# A plan',
  '',
  '| id | repo | slice | territory | blocked by | wave |',
  '| --- | --- | --- | --- | --- | --- |',
  '| s1 | backend | Alpha | `a/` | — | 1 |',
  '| s2 | frontend | Beta | `b/` | — | 2 |',
  '',
  '## Repositories',
  '',
  '| repo | role | read at | knowledge |',
  '| --- | --- | --- | --- |',
  '| backend | back-end | abc | none |',
  '| frontend | front-end | abc | own |',
  '',
].join('\n');

type Tokens = { access_token: string; refresh_token: string };
const signedIn = { read: (host: string): Tokens | null => (host === HOST ? { access_token: 'a', refresh_token: 'r' } : null), write: () => {} };

/** A server answering the product's links, recording each URL it is called on; `down` never answers. */
function server(status = 200) {
  const urls: string[] = [];
  const fetch = (url: string) => {
    urls.push(url);
    return Promise.resolve(new Response(JSON.stringify(LINKS), { status }));
  };
  return { urls, fetch };
}
const down = { urls: [], fetch: () => Promise.reject(new TypeError('fetch failed')) };

/** A `gh` that knows one draft feature PR in each target and nothing else, and records the repository of each call. */
const feature = (slug: string) => ({ number: 40, state: 'OPEN', isDraft: true, url: `https://github.com/${slug}/pull/40`, updatedAt: '2026-10-11T07:00:00Z', body: 'Part of #7' });

/** What the fake `gh` answers, by its first two arguments; anything else lists nothing. */
const GH: Record<string, (args: readonly string[], slug: string) => string> = {
  'repo view': () => 'main\n',
  'pr view': (args) => JSON.stringify({ number: Number(args[2]), state: 'OPEN', url: null, commits: [] }),
  'issue view': () => JSON.stringify({ comments: [], closedByPullRequestsReferences: [] }),
  'pr list': (args, slug) => JSON.stringify(args.includes('--head') && slug !== 'acme/plan' ? [feature(slug)] : []),
};

function fakeGh() {
  const repos: string[] = [];
  const exec = (file: string, args: readonly string[], options?: ExecFileSyncOptions): string => {
    if (file === 'git') return args[0] === 'fetch' ? '' : realExec(file, args, options);
    const slug = String(args[args.indexOf('--repo') + 1]);
    if (args.includes('--repo')) repos.push(slug);
    return (GH[args.slice(0, 2).join(' ')] ?? (() => '[]'))(args, slug);
  };
  return { exec, repos };
}

async function omni(argv: string[], { config, fetch = server(), tokens = signedIn }: { config: string; fetch?: { fetch: unknown }; tokens?: unknown }) {
  const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': config, '.omni-loop/delivery/inbox/0007-widgets/plan.md': PLAN } });
  return omniIn(root, argv, { fetch, tokens });
}

async function omniIn(root: string, argv: string[], { fetch = server(), tokens = signedIn }: { fetch?: { fetch: unknown }; tokens?: unknown } = {}) {
  const gh = fakeGh();
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(argv, {
    cwd: root,
    exec: gh.exec,
    env: {},
    tokens,
    fetch: fetch.fetch,
    now: () => new Date('2026-10-11T08:00:00Z'),
    stdout: { write: (s: string) => out.push(s) },
    stderr: { write: (s: string) => err.push(s) },
  });
  return { code, out: out.join(''), err: err.join(''), repos: [...new Set(gh.repos)] };
}

const TARGETS_URL = 'https://omni.test/api/products/targets?repo=acme%2Fplan&product=Mobile';

describe.each([
  ['plan: { product: Mobile }, read from the server', PRODUCT],
  ['plan.targets[], read from the config', LISTED],
])('the targets of %s', (_, config) => {
  it('omni board reads the pull requests of each target a slice names', async () => {
    const fetch = server();
    const { code, out, repos } = await omni(['board', '7', '--json'], { config, fetch });
    expect(code).toBe(0);
    expect(repos).toEqual(['acme/backend', 'acme/frontend']);
    const { slices }: { slices: { id: string; slug: string | null; state: string }[] } = JSON.parse(out);
    expect(slices.map(({ id, slug, state }) => ({ id, slug, state }))).toEqual([
      { id: 's1', slug: 'acme/backend', state: 'runnable' },
      { id: 's2', slug: 'acme/frontend', state: 'runnable' },
    ]);
    expect(fetch.urls).toEqual(config === PRODUCT ? [TARGETS_URL] : []);
  });

  it("omni next reads each target's feature PR", async () => {
    const { code, err, repos } = await omni(['next', '7', '--json'], { config });
    expect(err).toBe('');
    expect(code).toBe(0);
    expect(repos).toEqual(expect.arrayContaining(['acme/backend', 'acme/frontend']));
  });

  it('omni care list lists each target', async () => {
    const { code, out } = await omni(['care', 'list', '7', '--json'], { config });
    expect(code).toBe(0);
    const entries: { repo: string; kind: string }[] = JSON.parse(out);
    expect(entries.filter(({ kind }) => kind === 'target').map(({ repo }) => repo)).toEqual(['acme/backend', 'acme/frontend']);
  });

  it('omni flow show --repo finds a target by its short name', async () => {
    const { code, err } = await omni(['flow', 'show', '--repo', 'backend'], { config });
    expect(code).toBe(2);
    expect(err).toMatch(/^omni flow show: backend has no copied flow at /);
  });
});

describe('the targets of plan: { product }, when they cannot be read', () => {
  it('reads the last copy when the server is unreachable, saying so on stderr', async () => {
    const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': PRODUCT, '.omni-loop/delivery/inbox/0007-widgets/plan.md': PLAN } });
    await omniIn(root, ['board', '7', '--json']);
    const { code, err, repos } = await omniIn(root, ['board', '7', '--json'], { fetch: down });
    expect(code).toBe(0);
    expect(err).toBe('targets from the last read, 2026-10-11 08:00 UTC · server unreachable\n');
    expect(repos).toEqual(['acme/backend', 'acme/frontend']);
  });

  it.each([
    ['board', ['board', '7']],
    ['next', ['next', '7']],
    ['care', ['care', 'list', '7']],
    ['flow', ['flow', 'show', '--repo', 'backend']],
  ])('omni %s stops with the line saying why', async (verb, argv) => {
    const { code, err } = await omni(argv, { config: PRODUCT, tokens: { read: () => null, write: () => {} } });
    expect(code).toBe(2);
    expect(err).toBe(`omni ${verb}: no targets: no sign-in for omni.test (omni signin)\n`);
  });

  it('names what is missing or refused: the Omni page, the server unreachable with no copy, the server refusing', async () => {
    const noPage = PRODUCT.replace('url: https://omni.test', 'url: null');
    expect((await omni(['board', '7'], { config: noPage })).err).toBe('omni board: no targets: plan.product reads them from the Omni page, and ask.url is not set\n');
    const noSlug = PRODUCT.replace('repo:\n  slug: acme/plan\n', '');
    expect((await omni(['board', '7'], { config: noSlug })).err).toBe('omni board: no targets: no repository slug — set repo.slug in the config\n');
    expect((await omni(['board', '7'], { config: PRODUCT, fetch: down })).err).toBe('omni board: no targets: the server is unreachable and nothing was read yet\n');
    expect((await omni(['board', '7'], { config: PRODUCT, fetch: server(403) })).err).toMatch(/^omni board: the server refused the targets of product Mobile \(403\)/);
  });

  it('calls no server where no target is read: omni care reply, omni flow verdict, omni flow show without a short name', async () => {
    const fetch = server();
    expect((await omni(['care', 'reply', '--verdict', 'fixed', '--body', 'done'], { config: PRODUCT, fetch })).code).toBe(0);
    expect((await omni(['flow', 'show', '--repo', 'acme/backend'], { config: PRODUCT, fetch })).code).toBe(2);
    expect((await omni(['flow', 'show'], { config: PRODUCT, fetch })).code).toBe(0);
    expect(fetch.urls).toEqual([]);
  });
});
