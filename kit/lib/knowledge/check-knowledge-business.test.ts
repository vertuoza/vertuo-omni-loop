// What `omni check knowledge` refuses of the business laws with the product's read in hand (PRD 2632, s2):
// a domain off the list, an avoid word and a law outside the law home. Pure: the read is handed in.
import { describe, expect, it } from 'vitest';
import { parseBusinessLaws } from './business-laws.ts';
import { verifyBusinessLaws, type BusinessLawReach } from './check-knowledge-business.ts';

const FILE = 'k/domains/quotes/business-laws.md';
const law = (id: string, statement: string, also = '') =>
  parseBusinessLaws(FILE, `## ${id}\n${statement}\nWhy: a reason\n${also === '' ? '' : `Also: ${also}\n`}`, { scope: 'domain', domain: 'quotes' });
const PRODUCT_LAW = parseBusinessLaws('k/product/business-laws.md', '## BL-PRODUCT-1\nEvery amount shows its currency.\nWhy: a reason\n', { scope: 'product', domain: 'product' });

const reach = (extra: Partial<BusinessLawReach> = {}): BusinessLawReach => ({
  repo: 'acme/plan',
  domains: [{ key: 'quotes', name: 'Quotes', meaning: '' }, { key: 'invoicing', name: 'Invoicing', meaning: '' }],
  glossary: [{ term: 'Quote', meaning: '', avoid: ['estimate', 'Cost Sheet'] }],
  lawHome: 'acme/plan',
  ...extra,
});

describe('verifyBusinessLaws', () => {
  it('has nothing to say of no law', () => {
    expect(verifyBusinessLaws([], reach({ lawHome: null }))).toEqual({ violations: [], notes: [] });
  });

  it('passes laws on the list, free of avoid words, in the law home (whatever the case of the slug)', () => {
    expect(verifyBusinessLaws([...law('BL-QUOTES-1', 'A quote is sent with a total.', 'invoicing'), ...PRODUCT_LAW], reach({ repo: 'Acme/Plan' }))).toEqual({ violations: [], notes: [] });
  });

  it('refuses each key off the list, the folder\'s first, and never a product/ law', () => {
    const got = verifyBusinessLaws([...law('BL-QUOTES-1', 'A quote is sent.', 'billing, invoicing'), ...PRODUCT_LAW], reach({ domains: [{ key: 'invoicing', name: '', meaning: '' }] }));
    expect(got.violations).toEqual([
      `${FILE}: BL-QUOTES-1 — names the domain quotes, which is not on the product's domain list: use one of its domains, or ask a PM to add it.`,
      `${FILE}: BL-QUOTES-1 — names the domain billing, which is not on the product's domain list: use one of its domains, or ask a PM to add it.`,
    ]);
  });

  it('refuses an avoid word as a whole word without case, naming the term to write, and not the term itself', () => {
    const got = verifyBusinessLaws([...law('BL-QUOTES-1', 'An Estimate is never sent twice, nor a cost sheet.'), ...law('BL-QUOTES-2', 'A quote is estimated by hand.')], reach());
    expect(got.violations).toEqual([
      `${FILE}: BL-QUOTES-1 — uses "estimate", which the glossary says to avoid: write "Quote".`,
      `${FILE}: BL-QUOTES-1 — uses "Cost Sheet", which the glossary says to avoid: write "Quote".`,
    ]);
  });

  it('refuses a law outside the law home, naming the home, and every law of the file', () => {
    const got = verifyBusinessLaws([...law('BL-QUOTES-1', 'A quote is sent.'), ...PRODUCT_LAW], reach({ lawHome: 'acme/backend' }));
    expect(got.violations).toEqual([
      `${FILE}: BL-QUOTES-1 — sits in acme/plan, but the product's law home is acme/backend: move it there.`,
      'k/product/business-laws.md: BL-PRODUCT-1 — sits in acme/plan, but the product\'s law home is acme/backend: move it there.',
    ]);
  });

  it.each([null, undefined])('notes a product with no law home (%s), refusing no placement', (lawHome) => {
    expect(verifyBusinessLaws(law('BL-QUOTES-1', 'A quote is sent.'), reach({ lawHome }))).toEqual({
      violations: [],
      notes: ['Business laws not placed: the product has no law home — set its plan repository on the Omni page'],
    });
  });

  it('notes a page that sends no domain list, refusing no domain', () => {
    expect(verifyBusinessLaws(law('BL-QUOTES-1', 'A quote is sent.'), reach({ domains: undefined }))).toEqual({
      violations: [],
      notes: ['Business law domains not verified: the page sent no domain list'],
    });
  });

  it('refuses every domain of a product whose list is empty', () => {
    expect(verifyBusinessLaws(law('BL-QUOTES-1', 'A quote is sent.'), reach({ domains: [] })).violations).toHaveLength(1);
  });
});
