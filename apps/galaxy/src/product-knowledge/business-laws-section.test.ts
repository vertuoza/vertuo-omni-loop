import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { BusinessLaw } from 'omni-loop/kit/lib/knowledge/business-laws.ts';
import { BusinessLawsSection, DomainLaws } from './BusinessLawsSection';
import {
  LAWS_NONE_TEXT, domainsOfLaw, lawCountOf, lawFileHref, lawHomeOfRepositories, lawsOfDomain, noHomeWhy, ownersLine, type LawsRead,
} from './business-laws-section';
import { DomainItem } from './KnowledgeItem';
import { demoKnowledgeTab } from './KnowledgeTab';
import type { KnowledgeTab } from './product-knowledge.contract';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {} }) }));

// The Business laws section (PRD 2632 s6): the law home, the filter, each state it says, and the markup, which has no edit control.

const PRODUCT = 'demo-product-1';
const TAB = demoKnowledgeTab(PRODUCT) as KnowledgeTab;
const law = (id: string, domain: string, over: Partial<BusinessLaw> = {}): BusinessLaw => ({
  id, statement: `The rule ${id}.`, why: `Because ${id}.`, also: [], scope: domain === 'product' ? 'product' : 'domain', domain,
  file: `.omni-loop/knowledge/${domain === 'product' ? 'product' : `domains/${domain}`}/business-laws.md`, problems: [], ...over,
});
const LAWS = [law('BL-PRODUCT-1', 'product'), law('BL-QUOTES-1', 'quotes', { also: ['invoicing'] }), law('BL-QUOTES-2', 'quotes'), law('BL-PLANNING-1', 'planning')];
const READ: LawsRead = { state: 'read', home: 'acme/plan', sha: 'abc123', laws: LAWS, owners: ['pm'] };

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/\s+/g, ' ').trim();
const section = (read: LawsRead, query = {}) => renderToStaticMarkup(createElement(BusinessLawsSection, { tab: TAB, read, query }));

describe('the law home', () => {
  it('is the plan repository when set, else the only repository, else none', () => {
    expect(lawHomeOfRepositories({ plan: 'Acme/Plan', repositories: ['acme/a', 'acme/b'] })).toBe('acme/plan');
    expect(lawHomeOfRepositories({ plan: null, repositories: ['Acme/A'] })).toBe('acme/a');
    expect(lawHomeOfRepositories({ plan: null, repositories: ['acme/a', 'acme/b'] })).toBeNull();
    expect(lawHomeOfRepositories({ plan: null, repositories: [] })).toBeNull();
  });

  it('says to set a plan repository for several repositories, and that there is no repository for none', () => {
    expect(noHomeWhy({ plan: null, repositories: ['a/a', 'b/b'] })).toBe('set-plan');
    expect(noHomeWhy({ plan: null, repositories: [] })).toBe('no-repository');
    expect(LAWS_NONE_TEXT['set-plan']).toContain('Set a plan repository');
  });
});

describe('the filter', () => {
  it('keeps the laws of a domain\'s folder or naming it in Also, and every product law', () => {
    expect(lawsOfDomain(LAWS, 'invoicing').map((l) => l.id)).toEqual(['BL-PRODUCT-1', 'BL-QUOTES-1']);
    expect(lawsOfDomain(LAWS, 'planning').map((l) => l.id)).toEqual(['BL-PRODUCT-1', 'BL-PLANNING-1']);
    expect(lawsOfDomain(LAWS, null)).toHaveLength(4);
  });

  it('names a law\'s domains, its folder first, and none for a product law', () => {
    expect(domainsOfLaw(LAWS[1] as BusinessLaw)).toEqual(['quotes', 'invoicing']);
    expect(domainsOfLaw(LAWS[0] as BusinessLaw)).toEqual([]);
  });

  it('counts the laws only when they were read', () => {
    expect(lawCountOf(READ)).toBe(4);
    expect(lawCountOf({ state: 'none', why: 'no-pack' })).toBeNull();
  });

  it('writes a file link at the pack\'s commit and the owners as logins', () => {
    expect(lawFileHref('acme/plan', 'abc', '.omni-loop/knowledge/domains/a b/business-laws.md')).toBe('https://github.com/acme/plan/blob/abc/.omni-loop/knowledge/domains/a%20b/business-laws.md');
    expect(ownersLine(['pm', 'lead'])).toBe('@pm, @lead');
    expect(ownersLine([])).toContain('not named');
  });
});

describe('the section', () => {
  it('lists each law with its statement, Why, domains, owner and a link to its file, and offers no edit', () => {
    const html = section(READ);
    expect(html).toContain('data-law="BL-QUOTES-1"');
    expect(text(html)).toContain('The rule BL-QUOTES-1. Because BL-QUOTES-1. quotes , invoicing @pm');
    expect(html).toContain('href="https://github.com/acme/plan/blob/abc123/.omni-loop/knowledge/domains/quotes/business-laws.md"');
    expect(html).toContain(`href="/app/products/${PRODUCT}/knowledge/domains/quotes"`);
    expect(text(html)).toContain('Everywhere');
    expect(html).not.toMatch(/<button|<form|<input|<textarea|<select/);
  });

  it('is filtered through ?domain=<key>, saying what it filters by and how to clear it', () => {
    const html = section(READ, { domain: 'planning' });
    expect(html).toContain('data-law="BL-PLANNING-1"');
    expect(html).toContain('data-law="BL-PRODUCT-1"');
    expect(html).not.toContain('data-law="BL-QUOTES-1"');
    expect(html).toContain('data-domain-filter="planning"');
  });

  it('says so when no law names the domain asked for, and when there is no law at all', () => {
    expect(text(section({ ...READ, laws: [LAWS[3] as BusinessLaw] }, { domain: 'quotes' }))).toContain('No business law names quotes.');
    expect(text(section({ ...READ, laws: [] }))).toContain('No business law yet.');
  });

  it.each(['set-plan', 'no-repository', 'no-pack', 'unreadable'] as const)('says why there is nothing to read: %s', (why) => {
    const html = section({ state: 'none', why });
    expect(html).toContain(`data-laws-none="${why}"`);
    expect(text(html)).toContain(text(LAWS_NONE_TEXT[why]));
  });
});

describe('a domain\'s page', () => {
  const domain = TAB.domains.entries[0] as (typeof TAB.domains.entries)[number];
  const page = (laws?: LawsRead) => renderToStaticMarkup(createElement(DomainItem, { tab: TAB, source: { kind: 'live' }, entry: { ...domain, key: 'quotes' }, query: {}, ...(laws === undefined ? {} : { laws }) }));

  it('lists the laws of that domain', () => {
    const html = page(READ);
    expect(html).toContain('data-law="BL-QUOTES-1"');
    expect(html).toContain('data-law="BL-QUOTES-2"');
    expect(html).not.toContain('data-law="BL-PLANNING-1"');
  });

  it('says why there is none to list, and shows nothing when the laws were not read', () => {
    expect(text(page({ state: 'none', why: 'no-pack' }))).toContain(text(LAWS_NONE_TEXT['no-pack']));
    expect(text(page({ ...READ, laws: [] }))).toContain('No business law yet.');
    expect(page()).not.toContain('Business laws');
  });

  it('draws the same list on its own', () => {
    expect(renderToStaticMarkup(createElement(DomainLaws, { product: PRODUCT, domain: 'planning', read: READ }))).toContain('data-law="BL-PLANNING-1"');
  });
});
