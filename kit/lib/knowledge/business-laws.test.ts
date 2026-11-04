// PRD 2632, s1: a business law — parsed from `business-laws.md`, graded for its shape, and selected
// for a spec from its `areas:`, the glossary and `product/`. Pure: every fixture is fictional text.
import { describe, expect, it } from 'vitest';
import {
  businessLawDomains,
  businessLawProblems,
  parseBusinessLaws,
  readBusinessLaws,
  selectBusinessLaws,
  specAreas,
  type BusinessLaw,
} from './business-laws.ts';
import { isLaw, memorySource, readKnowledge } from './registers.ts';

const ROOT = '.omni-loop/knowledge';
const ctx = { root: '/nowhere', layout: { knowledgeRoot: ROOT } };
const QUOTES = `${ROOT}/domains/quotes/business-laws.md`;
const PRODUCT = `${ROOT}/product/business-laws.md`;

const QUOTES_TEXT = [
  '# Quotes',
  '',
  '## BL-QUOTES-1',
  'A quote can be sent only when its total including tax is above zero.',
  'Why: A customer who receives an empty quote stops trusting the contractor.',
  'Also: invoicing, `payments`',
  '',
  '## BL-QUOTES-2',
  'A sent quote keeps its number',
  'for good.',
  'Why: The customer quotes it',
  'on the phone.',
  '',
].join('\n');

const PRODUCT_TEXT = ['## BL-PRODUCT-1', 'Every amount is shown with its currency.', 'Why: Two currencies once looked the same.', ''].join('\n');

const at = (file: string, text: string) => parseBusinessLaws(file, text, file === PRODUCT ? { scope: 'product', domain: 'product' } : { scope: 'domain', domain: 'quotes' });

function law(id: string, fields: Partial<BusinessLaw> = {}): BusinessLaw {
  return { id, statement: `${id} holds.`, why: 'Because.', also: [], scope: 'domain', domain: 'quotes', file: QUOTES, problems: [], ...fields };
}

describe('parseBusinessLaws — a business law read from its file', () => {
  it('reads the id, the statement, Why: and Also:, each continued until a blank line', () => {
    expect(at(QUOTES, QUOTES_TEXT)).toEqual([
      {
        id: 'BL-QUOTES-1',
        statement: 'A quote can be sent only when its total including tax is above zero.',
        why: 'A customer who receives an empty quote stops trusting the contractor.',
        also: ['invoicing', 'payments'],
        scope: 'domain',
        domain: 'quotes',
        file: QUOTES,
        problems: [],
      },
      {
        id: 'BL-QUOTES-2',
        statement: 'A sent quote keeps its number for good.',
        why: 'The customer quotes it on the phone.',
        also: [],
        scope: 'domain',
        domain: 'quotes',
        file: QUOTES,
        problems: [],
      },
    ]);
  });

  it('names a missing Why:, a missing statement, a bad id and a code that is not the folder\'s', () => {
    const text = ['## BL-QUOTES-3', 'No reason given.', '', '## BL-QUOTES-4', 'Why: Only a reason.', '', '## Quotes rule 5', 'A heading that is no id.', 'Why: x', '', '## BL-INVOICING-1', 'Wrong folder.', 'Why: x', ''].join('\n');
    expect(at(QUOTES, text).map(({ id, problems }) => ({ id, problems }))).toEqual([
      { id: 'BL-QUOTES-3', problems: [`${QUOTES}: BL-QUOTES-3 — is missing a "Why:" line: a business law says why it exists, and a red shows it.`] },
      { id: 'BL-QUOTES-4', problems: [`${QUOTES}: BL-QUOTES-4 — has no statement.`] },
      { id: 'Quotes rule 5', problems: [`${QUOTES}: Quotes rule 5 — is not a business law id: write BL-QUOTES-<n>.`] },
      { id: 'BL-INVOICING-1', problems: [`${QUOTES}: BL-INVOICING-1 — names INVOICING, but it sits in the quotes folder: write BL-QUOTES-<n>.`] },
    ]);
  });

  it('takes PRODUCT as the code of product/business-laws.md', () => {
    expect(at(PRODUCT, PRODUCT_TEXT)[0]).toMatchObject({ id: 'BL-PRODUCT-1', scope: 'product', domain: 'product', problems: [] });
    expect(at(PRODUCT, PRODUCT_TEXT.replace('BL-PRODUCT-1', 'BL-QUOTES-9'))[0]?.problems).toEqual([
      `${PRODUCT}: BL-QUOTES-9 — names QUOTES, but it sits in the product folder: write BL-PRODUCT-<n>.`,
    ]);
  });

  it('takes a hyphenated folder\'s code without its hyphens', () => {
    const laws = parseBusinessLaws('x', '## BL-AGENTSESSION-1\nA session ends.\nWhy: y\n', { scope: 'domain', domain: 'agent-session' });
    expect(laws[0]?.problems).toEqual([]);
  });
});

describe('readBusinessLaws — the files of the knowledge folder', () => {
  const texts = {
    [QUOTES]: QUOTES_TEXT,
    [PRODUCT]: PRODUCT_TEXT,
    [`${ROOT}/domains/quotes/rules.md`]: '## BR-QUOTES-1\nA rule.\n',
    [`${ROOT}/repos/backend/domains/quotes/business-laws.md`]: '## BL-QUOTES-7\nA copy.\nWhy: z\n',
    [`${ROOT}/repos/backend/product/business-laws.md`]: '## BL-PRODUCT-7\nA copy.\nWhy: z\n',
  };

  it('reads product/ and every domains/<key>/ file, and never an imported copy under repos/', () => {
    expect(readBusinessLaws({ ctx, source: memorySource(texts) }).map(({ id }) => id)).toEqual(['BL-PRODUCT-1', 'BL-QUOTES-1', 'BL-QUOTES-2']);
  });

  it('is never a law, nor any entry of the registers: the thesis, the briefing and laws.max never see it', () => {
    const { entries } = readKnowledge({ ctx, source: memorySource(texts) });
    expect(entries.map(({ id }) => id)).toEqual(['BR-QUOTES-1']);
    expect(entries.filter(isLaw)).toEqual([]);
  });

  it('reads nothing from an absent folder', () => {
    expect(readBusinessLaws({ ctx, source: memorySource({}) })).toEqual([]);
  });
});

describe('businessLawProblems — what omni check knowledge refuses', () => {
  it('passes well-formed laws with owners named', () => {
    expect(businessLawProblems([law('BL-QUOTES-1'), law('BL-QUOTES-2')], { owners: ['pm-login'], where: ROOT })).toEqual([]);
  });

  it('carries every parse problem, and refuses a number used twice, naming both files', () => {
    const twice = [law('BL-QUOTES-1', { problems: ['bad'] }), law('BL-QUOTES-1', { file: 'other.md' })];
    expect(businessLawProblems(twice, { owners: ['pm-login'], where: ROOT })).toEqual(['bad', `other.md: BL-QUOTES-1 — already used in ${QUOTES}: a business law's number is used once.`]);
  });

  it('refuses a law while laws.owners names nobody, and says nothing with no law', () => {
    expect(businessLawProblems([law('BL-QUOTES-1')], { owners: [], where: ROOT })).toEqual([
      `${ROOT}: 1 business law, and laws.owners is empty — name the product's PM in laws.owners: only they approve a change to one.`,
    ]);
    expect(businessLawProblems([], { owners: [], where: ROOT })).toEqual([]);
  });
});

describe('specAreas — the domains a spec names in its front matter', () => {
  it('reads the bracketed list, and none without one', () => {
    expect(specAreas('---\nprd: 7\nareas: [quotes, `invoicing`]\n---\nBody areas: [x]\n')).toEqual(['quotes', 'invoicing']);
    expect(specAreas('---\nprd: 7\n---\nareas: [x]\n')).toEqual([]);
    expect(specAreas('no front matter')).toEqual([]);
    expect(specAreas('---\nareas: []\n---\n')).toEqual([]);
  });
});

describe('selectBusinessLaws — which laws a spec is judged against', () => {
  const laws = [
    law('BL-PRODUCT-1', { scope: 'product', domain: 'product', file: PRODUCT }),
    law('BL-QUOTES-1', { also: ['invoicing'] }),
    law('BL-INVOICING-1', { domain: 'invoicing' }),
    law('BL-PAYMENTS-1', { domain: 'payments' }),
    law('BL-PLANNING-1', { domain: 'planning', also: ['quotes'] }),
  ];
  const glossary = [
    { term: 'Quote', meaning: 'm', avoid: ['estimate'], domains: ['quotes'] },
    { term: 'Customer', meaning: 'm', avoid: [], domains: [] },
    { term: 'Invoice', meaning: 'm', avoid: [] },
    { term: 'Pay run', meaning: 'm', avoid: [], domains: ['payments'] },
  ];
  const ids = (spec: string) => selectBusinessLaws({ spec, laws, glossary }).laws.map(({ id }) => id);

  it('takes a glossary term used as a whole word, whatever its case, with every product/ law (acceptance 2)', () => {
    const selection = selectBusinessLaws({ spec: '---\nprd: 7\n---\nThe customer sends a QUOTE.', laws, glossary });
    expect(selection.domains).toEqual([{ key: 'quotes', reasons: ['"Quote"'] }]);
    expect(selection.laws.map(({ id }) => id)).toEqual(['BL-PRODUCT-1', 'BL-QUOTES-1', 'BL-PLANNING-1']);
  });

  it('never takes part of a word, nor a domain nothing points to', () => {
    expect(ids('Quoted figures and quotes.')).toEqual(['BL-PRODUCT-1']);
    expect(ids('A pay runner.')).toEqual(['BL-PRODUCT-1']);
    expect(ids('Each pay run.')).toEqual(['BL-PRODUCT-1', 'BL-PAYMENTS-1']);
  });

  it('takes an avoid word as its term, and saying so', () => {
    expect(selectBusinessLaws({ spec: 'An estimate.', laws, glossary }).domains).toEqual([{ key: 'quotes', reasons: ['"estimate" (for "Quote")'] }]);
  });

  it('adds no domain for a term that names none', () => {
    expect(ids('A customer and an invoice.')).toEqual(['BL-PRODUCT-1']);
  });

  it('takes the domains of areas:, by folder or Also:, and gives every reason once per domain', () => {
    const selection = selectBusinessLaws({ spec: '---\nareas: [invoicing, quotes]\n---\nA quote, a quote.', laws, glossary });
    expect(selection.domains).toEqual([
      { key: 'invoicing', reasons: ['areas'] },
      { key: 'quotes', reasons: ['areas', '"Quote"'] },
    ]);
    expect(selection.laws.map(({ id }) => id)).toEqual(['BL-PRODUCT-1', 'BL-QUOTES-1', 'BL-INVOICING-1', 'BL-PLANNING-1']);
  });

  it('reads the glossary only in the spec\'s body, never in its front matter', () => {
    expect(ids('---\ntitle: Quote totals\n---\nNothing here.')).toEqual(['BL-PRODUCT-1']);
  });

  it('selects nothing but product/ laws with no glossary and no areas', () => {
    expect(selectBusinessLaws({ spec: 'A quote.', laws, glossary: [] })).toEqual({ domains: [], laws: [laws[0]] });
  });
});

describe('businessLawDomains', () => {
  it('is the folder and every Also: key, none for a product/ law', () => {
    expect(businessLawDomains(law('BL-QUOTES-1', { also: ['invoicing', 'quotes'] }))).toEqual(['quotes', 'invoicing']);
    expect(businessLawDomains(law('BL-PRODUCT-1', { scope: 'product', domain: 'product' }))).toEqual([]);
  });
});
