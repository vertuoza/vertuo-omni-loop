// PRD 2632, s1: `omni kb business-laws [--domain <key>] [--json]`, `--spec <file>`, `omni kb laws --paths`
// placing the business laws, and `omni check knowledge` grading them — each through `main()` on a
// fixture repository. Every law, term and login is fictional.
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
