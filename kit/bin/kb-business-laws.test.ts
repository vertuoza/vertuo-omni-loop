// PRD 2632, s1: `omni kb business-laws [--domain <key>] [--json]`, `--spec <file>`, `omni kb laws --paths`
// placing the business laws, and `omni check knowledge` grading them — each through `main()` on a
// fixture repository. Every law, term and login is fictional.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../test/fixture.ts';
import { main } from './omni.ts';

const K = '.omni-loop/knowledge';
const CONFIG = [
  'kit: 1',
  'repo:',
  '  slug: acme/widgets',
  'laws:',
  '  source: none',
  '  owners: [pm-login]',
  'flow:',
  '  areas:',
  '    quoting:',
  '      paths: ["^apps/quotes/"]',
  '      knowledge: quotes',
  '    billing:',
  '      paths: ["^apps/billing/"]',
  '      knowledge: invoicing',
  '',
].join('\n');

const QUOTES_LAWS = [
  '## BL-QUOTES-1',
  'A quote can be sent only when its total including tax is above zero.',
  'Why: A customer who receives an empty quote stops trusting the contractor.',
  '',
].join('\n');
const INVOICING_LAWS = ['## BL-INVOICING-1', 'An invoice is never deleted.', 'Why: The tax office asks for every number.', 'Also: quotes', ''].join('\n');
const PLANNING_LAWS = ['## BL-PLANNING-1', 'A crew works one site a day.', 'Why: Travel eats the day.', ''].join('\n');
const PRODUCT_LAWS = ['## BL-PRODUCT-1', 'Every amount shows its currency.', 'Why: Two currencies once looked the same.', ''].join('\n');

const COPY = {
  product: 'Builder',
  readAt: '2026-11-01T10:00:00.000Z',
  legal: [],
  glossary: [
    { term: 'Quote', meaning: 'A priced offer.', avoid: ['estimate'], domains: ['quotes'] },
    { term: 'Customer', meaning: 'Who pays.', avoid: [], domains: [] },
  ],
  personas: [],
};

const FILES = {
  '.omni-loop/config.yml': CONFIG,
  [`${K}/product/business-laws.md`]: PRODUCT_LAWS,
  [`${K}/domains/quotes/business-laws.md`]: QUOTES_LAWS,
  [`${K}/domains/invoicing/business-laws.md`]: INVOICING_LAWS,
  [`${K}/domains/planning/business-laws.md`]: PLANNING_LAWS,
  [`${K}/repos/backend/domains/quotes/business-laws.md`]: '## BL-QUOTES-9\nA copy.\nWhy: z\n',
};

async function omni(root: string, argv: readonly string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(argv, { cwd: root, stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) } });
  return { code, out: out.join(''), err: err.join('') };
}

const lines = (text: string) => text.trimEnd().split('\n');

const PRODUCT_1 = ['BL-PRODUCT-1 — Every amount shows its currency. (product)', '  Why: Two currencies once looked the same.'];
const QUOTES_1 = ['BL-QUOTES-1 — A quote can be sent only when its total including tax is above zero. (quotes)', '  Why: A customer who receives an empty quote stops trusting the contractor.'];
const INVOICING_1 = ['BL-INVOICING-1 — An invoice is never deleted. (invoicing, quotes)', '  Why: The tax office asks for every number.'];
const PLANNING_1 = ['BL-PLANNING-1 — A crew works one site a day. (planning)', '  Why: Travel eats the day.'];

describe('omni kb business-laws — the laws in the files', () => {
  it('prints every law with its Why and domains, product/ first, and never an imported copy', async () => {
    const { root } = makeRepo({ git: true, files: FILES });
    const { code, out } = await omni(root, ['kb', 'business-laws']);
    expect(code).toBe(0);
    expect(lines(out)).toEqual(['kb business-laws — 4 business law(s)', ...PRODUCT_1, ...INVOICING_1, ...PLANNING_1, ...QUOTES_1]);
  });

  it('--domain keeps the laws of that domain, by folder or Also:', async () => {
    const { root } = makeRepo({ git: true, files: FILES });
    expect(lines((await omni(root, ['kb', 'business-laws', '--domain', 'quotes'])).out)).toEqual(['kb business-laws — 2 business law(s) in quotes', ...INVOICING_1, ...QUOTES_1]);
    expect(lines((await omni(root, ['kb', 'business-laws', '--domain', 'payments'])).out)).toEqual(['kb business-laws — no business law in payments.']);
  });

  it('--json prints the laws as data', async () => {
    const { root } = makeRepo({ git: true, files: FILES });
    const parsed: unknown = JSON.parse((await omni(root, ['kb', 'business-laws', '--domain', 'planning', '--json'])).out);
    expect(parsed).toEqual({
      laws: [{ id: 'BL-PLANNING-1', statement: 'A crew works one site a day.', why: 'Travel eats the day.', also: [], scope: 'domain', domain: 'planning', file: `${K}/domains/planning/business-laws.md`, problems: [] }],
    });
  });

  it('says where to write one when there is none', async () => {
    const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': CONFIG } });
    expect(lines((await omni(root, ['kb', 'business-laws'])).out)).toEqual([`kb business-laws — no business law yet: write one in ${K}/domains/<key>/business-laws.md or ${K}/product/business-laws.md.`]);
  });

  it('refuses --spec with --domain, and a spec that is not there', async () => {
    const { root } = makeRepo({ git: true, files: FILES });
    expect(await omni(root, ['kb', 'business-laws', '--spec', 'spec.md', '--domain', 'quotes'])).toMatchObject({ code: 2 });
    expect(await omni(root, ['kb', 'business-laws', '--spec', 'nowhere.md'])).toMatchObject({ code: 2, err: expect.stringContaining('nowhere.md') as unknown });
  });
});

describe('omni kb business-laws --spec — what a spec is judged against (acceptance 2, 3)', () => {
  it('a spec using "Quote" with no areas: is judged against the Quotes laws and every product/ law, and says why', async () => {
    const { root, write } = makeRepo({ git: true, files: { ...FILES, '.omni-loop/local/product-knowledge.json': JSON.stringify(COPY) } });
    write('spec.md', '---\nprd: 7\ntitle: Send\n---\nThe customer sends a quote.\n');
    const { code, out } = await omni(root, ['kb', 'business-laws', '--spec', 'spec.md']);
    expect(code).toBe(0);
    expect(lines(out)).toEqual(['kb business-laws — spec.md is judged against 3 business law(s)', 'Domains: quotes ← "Quote"', ...PRODUCT_1, ...INVOICING_1, ...QUOTES_1]);
  });

  it('takes areas: too, and --json carries the domains and their reasons', async () => {
    const { root, write } = makeRepo({ git: true, files: { ...FILES, '.omni-loop/local/product-knowledge.json': JSON.stringify(COPY) } });
    write('spec.md', '---\nprd: 7\nareas: [planning]\n---\nAn estimate.\n');
    const parsed = JSON.parse((await omni(root, ['kb', 'business-laws', '--spec', 'spec.md', '--json'])).out) as { domains: unknown; laws: { id: string }[] };
    expect(parsed.domains).toEqual([{ key: 'planning', reasons: ['areas'] }, { key: 'quotes', reasons: ['"estimate" (for "Quote")'] }]);
    expect(parsed.laws.map(({ id }) => id)).toEqual(['BL-PRODUCT-1', 'BL-INVOICING-1', 'BL-PLANNING-1', 'BL-QUOTES-1']);
  });

  it('with no copy of the glossary, takes areas: and product/ alone, and says so', async () => {
    const { root, write } = makeRepo({ git: true, files: FILES });
    write('spec.md', '---\nprd: 7\n---\nA quote.\n');
    expect(lines((await omni(root, ['kb', 'business-laws', '--spec', 'spec.md'])).out)).toEqual([
      'kb business-laws — spec.md is judged against 1 business law(s)',
      'Domains: none taken',
      'glossary: no local copy, so no term was read — omni kb glossary reads it',
      ...PRODUCT_1,
    ]);
  });
});

describe('omni kb laws --paths — the business laws of the files\' domains (acceptance 13)', () => {
  it('shows a law for a file of its domain, by folder or Also:, hides it for a file of another, and puts product/ under Global', async () => {
    const { root } = makeRepo({ git: true, files: FILES });
    const quotes = lines((await omni(root, ['kb', 'laws', '--paths', 'apps/quotes/send.ts'])).out);
    expect(quotes).toEqual([
      'Applies here',
      'business law BL-INVOICING-1 — An invoice is never deleted. (domain quotes)',
      'business law BL-QUOTES-1 — A quote can be sent only when its total including tax is above zero. (domain quotes)',
      'Global',
      'business law BL-PRODUCT-1 — Every amount shows its currency.',
      'business law BL-PLANNING-1 — A crew works one site a day.',
    ]);
    const billing = lines((await omni(root, ['kb', 'laws', '--paths', 'apps/billing/run.ts'])).out);
    expect(billing).toContain('business law BL-INVOICING-1 — An invoice is never deleted. (domain invoicing)');
    expect(billing.join('\n')).not.toContain('BL-QUOTES-1');
  });
});

describe('omni check knowledge — the business laws graded under laws.source none', () => {
  it('counts them when they hold, and refuses one with no Why:', async () => {
    const product = Object.fromEntries(['principles', 'rules', 'invariants'].map((name) => [`${K}/product/${name}.md`, '# Product\n']));
    const { root, write } = makeRepo({ git: true, files: { ...FILES, ...product } });
    const green = await omni(root, ['check', 'knowledge']);
    expect(green).toMatchObject({ code: 0, out: expect.stringContaining('4 business law(s)') as unknown });
    write(`${K}/domains/planning/business-laws.md`, '## BL-PLANNING-1\nA crew works one site a day.\n');
    const red = await omni(root, ['check', 'knowledge']);
    expect(red.code).toBe(1);
    expect(red.out).toContain(`${K}/domains/planning/business-laws.md: BL-PLANNING-1 — is missing a "Why:" line`);
  });
});

// PRD 2632, s2: the law home. The Omni page says where a product's laws live (`lawHome`); `omni kb business-laws`
// reads that repository's pack away from it, and `omni check knowledge` refuses a domain off the product's list,
// an avoid word and a law outside the home — each only a note while the page cannot be read.
describe('the law home (PRD 2632, s2)', () => {
  const HOST = 'omni.test';
  const NOW = new Date('2026-11-04T08:00:00Z');
  const signedIn = { read: (host: string) => (host === HOST ? { access_token: 'a', refresh_token: 'r' } : null), write: () => {} };
  const signedOut = { read: () => null, write: () => {} };
  const ASK = { '.omni-loop/config.yml': `${CONFIG}ask:\n  url: https://${HOST}\n` };
  const PRODUCT_LAYERS = Object.fromEntries(['principles', 'rules', 'invariants'].map((name) => [`${K}/product/${name}.md`, '# Product\n']));
  const DOMAINS = [
    { key: 'quotes', name: 'Quotes', meaning: 'Priced offers.' },
    { key: 'invoicing', name: 'Invoicing', meaning: 'Invoices.' },
    { key: 'planning', name: 'Planning', meaning: 'Crews.' },
  ];
  const business = (extra: Record<string, unknown> = {}): Record<string, unknown> => ({
    state: 'ok',
    business: { name: 'Acme' },
    product: { name: 'Builder' },
    claims: [{ id: 'region#1', kind: 'region', value: 'BE', source: 'x', state: 'confirmed', receipt: null, lastSeen: null }],
    personas: [],
    legal: [],
    glossary: COPY.glossary,
    domains: DOMAINS,
    lawHome: 'acme/widgets',
    ...extra,
  });
  const olderBusiness = (): Record<string, unknown> => {
    const { lawHome: _home, domains: _domains, ...older } = business();
    return older;
  };
  const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');
  const PACK_FILES = { [`${K}/domains/quotes/business-laws.md`]: QUOTES_LAWS, [`${K}/product/business-laws.md`]: PRODUCT_LAWS };
  const pack = (): unknown => ({
    repository: 'acme/plan',
    sha: 'a'.repeat(40),
    committedAt: '2026-11-03T09:00:00Z',
    madeAt: '2026-11-03T09:01:00Z',
    files: Object.entries(PACK_FILES).map(([path, content]) => ({ path, content, sha256: sha256(content) })),
  });

  /** A page answering `/api/business` with `answer` and `/api/knowledge-packs` with the pack, or nothing when `down`. */
  function page({ answer = business(), down = false }: { answer?: unknown; down?: boolean } = {}) {
    const urls: string[] = [];
    const fetch = (url: string): Promise<Response> => {
      urls.push(url);
      if (down) return Promise.reject(new TypeError('fetch failed'));
      if (url.includes('/api/knowledge-packs')) return Promise.resolve(new Response(JSON.stringify(pack())));
      return Promise.resolve(new Response(JSON.stringify(answer)));
    };
    return { urls, fetch };
  }

  async function run(root: string, argv: readonly string[], server: { fetch: (url: string) => Promise<Response> }, tokens: unknown = signedIn) {
    const out: string[] = [];
    const err: string[] = [];
    const code = await main(argv, { cwd: root, stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) }, tokens, fetch: server.fetch, now: () => NOW } as Parameters<typeof main>[1]);
    return { code, out: out.join(''), err: err.join('') };
  }

  describe('omni kb business-laws away from the law home', () => {
    it('reads the home\'s pack, not this checkout\'s files, and says so', async () => {
      const server = page({ answer: business({ lawHome: 'acme/plan' }) });
      const { root } = makeRepo({ git: true, files: { ...FILES, ...ASK } });
      const { code, out } = await run(root, ['kb', 'business-laws'], server);
      expect(code).toBe(0);
      expect(server.urls.some((url) => url.includes('/api/knowledge-packs?repo=acme%2Fplan'))).toBe(true);
      expect(lines(out)).toEqual(['kb business-laws — 2 business law(s)', ...PRODUCT_1, ...QUOTES_1, `law home: acme/plan — read from its pack ${'a'.repeat(7)}`]);
    });

    it('says when the pack is the last one fetched, the page being unreachable', async () => {
      const { root } = makeRepo({ git: true, files: { ...FILES, ...ASK, '.omni-loop/local/product-knowledge.json': JSON.stringify({ ...COPY, lawHome: 'acme/plan' }) } });
      await run(root, ['kb', 'business-laws'], page({ answer: business({ lawHome: 'acme/plan' }) }));
      const { code, out } = await run(root, ['kb', 'business-laws'], page({ down: true }));
      expect(code).toBe(0);
      expect(out).toContain(`held · server unreachable · newest pack fetched: ${'a'.repeat(40)}`);
      expect(out).toContain('BL-QUOTES-1');
    });

    it('fails, naming the pack, when none was fetched and the page is down', async () => {
      const { root } = makeRepo({ git: true, files: { ...FILES, ...ASK, '.omni-loop/local/product-knowledge.json': JSON.stringify({ ...COPY, lawHome: 'acme/plan' }) } });
      const { code, out, err } = await run(root, ['kb', 'business-laws'], page({ down: true }));
      expect(code).toBe(1);
      expect(out).toBe('');
      expect(err).toContain('omni kb business-laws: no pack of plan');
    });

    it.each([
      ['in the law home', business({ lawHome: 'Acme/Widgets' })],
      ['with no law home', business({ lawHome: null })],
      ['from a page that sends none', olderBusiness()],
    ])('reads this checkout\'s files %s', async (_, answer) => {
      const server = page({ answer });
      const { root } = makeRepo({ git: true, files: { ...FILES, ...ASK } });
      const { code, out } = await run(root, ['kb', 'business-laws'], server);
      expect(code).toBe(0);
      expect(lines(out)).toEqual(['kb business-laws — 4 business law(s)', ...PRODUCT_1, ...INVOICING_1, ...PLANNING_1, ...QUOTES_1]);
      expect(server.urls.some((url) => url.includes('knowledge-packs'))).toBe(false);
    });

    it('reads this checkout\'s files when the computer is not signed in', async () => {
      const { root } = makeRepo({ git: true, files: { ...FILES, ...ASK } });
      const { code, out } = await run(root, ['kb', 'business-laws'], page(), signedOut);
      expect(code).toBe(0);
      expect(lines(out)[0]).toBe('kb business-laws — 4 business law(s)');
    });

    it('keeps --json pure, the pack\'s lines going to stderr', async () => {
      const { root } = makeRepo({ git: true, files: { ...FILES, ...ASK } });
      const { out, err } = await run(root, ['kb', 'business-laws', '--json'], page({ answer: business({ lawHome: 'acme/plan' }) }));
      expect((JSON.parse(out) as { laws: unknown[] }).laws).toHaveLength(2);
      expect(err).toContain('law home: acme/plan');
    });
  });

  describe('omni check knowledge with the page (acceptance 1)', () => {
    const PAYMENTS = `${K}/domains/payments/business-laws.md`;
    const files = (extra: Record<string, string> = {}) => ({ ...PRODUCT_LAYERS, [`${K}/domains/quotes/business-laws.md`]: QUOTES_LAWS, ...ASK, ...extra });

    it('passes laws in the law home, on the product\'s list, with no avoid word', async () => {
      const { root } = makeRepo({ git: true, files: files() });
      const result = await run(root, ['check', 'knowledge'], page());
      expect(result).toMatchObject({ code: 0, out: expect.stringContaining('1 business law(s)') as unknown });
    });

    it('refuses a folder and an Also: key off the product\'s domain list, naming each', async () => {
      const { root } = makeRepo({ git: true, files: files({ [PAYMENTS]: '## BL-PAYMENTS-1\nA payment is final.\nWhy: x\nAlso: quotes, billing\n' }) });
      const result = await run(root, ['check', 'knowledge'], page());
      expect(result.code).toBe(1);
      expect(result.out).toContain(`${PAYMENTS}: BL-PAYMENTS-1 — names the domain payments, which is not on the product's domain list`);
      expect(result.out).toContain('BL-PAYMENTS-1 — names the domain billing, which is not on the product\'s domain list');
      expect(result.out).not.toContain('names the domain quotes');
    });

    it('refuses a statement using a word the glossary says to avoid, naming the term to write', async () => {
      const { root } = makeRepo({ git: true, files: files({ [`${K}/domains/planning/business-laws.md`]: '## BL-PLANNING-1\nAn estimate is never sent twice.\nWhy: x\n' }) });
      const result = await run(root, ['check', 'knowledge'], page());
      expect(result.code).toBe(1);
      expect(result.out).toContain('BL-PLANNING-1 — uses "estimate", which the glossary says to avoid: write "Quote".');
    });

    it('refuses a law in a repository that is not the law home, naming the home', async () => {
      const { root } = makeRepo({ git: true, files: files() });
      const result = await run(root, ['check', 'knowledge'], page({ answer: business({ lawHome: 'acme/plan' }) }));
      expect(result.code).toBe(1);
      expect(result.out).toContain(`${K}/domains/quotes/business-laws.md: BL-QUOTES-1 — sits in acme/widgets, but the product's law home is acme/plan: move it there.`);
    });

    it('notes, never refuses, a product with no law home or a page that sends no domain list', async () => {
      const { root } = makeRepo({ git: true, files: files({ [PAYMENTS]: '## BL-PAYMENTS-1\nA payment is final.\nWhy: x\n' }) });
      const result = await run(root, ['check', 'knowledge'], page({ answer: olderBusiness() }));
      expect(result.code).toBe(0);
      expect(result.out).toContain('Business laws not placed: the product has no law home');
      expect(result.out).toContain('Business law domains not verified: the page sent no domain list');
    });

    it.each([
      ['the page is unreachable', () => page({ down: true }), signedIn, 'page unreachable'],
      ['the computer is not signed in', () => page(), signedOut, 'not signed in'],
    ])('notes, never refuses, when %s', async (_, server, tokens, why) => {
      const { root } = makeRepo({ git: true, files: files({ [PAYMENTS]: '## BL-PAYMENTS-1\nA payment is final.\nWhy: x\n' }) });
      const result = await run(root, ['check', 'knowledge'], server(), tokens);
      expect(result.code).toBe(0);
      expect(result.out).toContain(`Business laws not verified: ${why}`);
    });

    it('notes a repository in no product, and reads nothing when there is no law', async () => {
      const { root } = makeRepo({ git: true, files: files() });
      const result = await run(root, ['check', 'knowledge'], page({ answer: business({ product: null }) }));
      expect(result).toMatchObject({ code: 0, out: expect.stringContaining('Business laws not verified: this repository belongs to no product') as unknown });
      const bare = makeRepo({ git: true, files: { ...PRODUCT_LAYERS, ...ASK } });
      const server = page();
      expect((await run(bare.root, ['check', 'knowledge'], server)).code).toBe(0);
      expect(server.urls).toEqual([]);
    });
  });
});
