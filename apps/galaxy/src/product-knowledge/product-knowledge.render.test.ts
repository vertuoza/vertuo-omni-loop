import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { KnowledgeTab } from './product-knowledge.contract';
import { demoKnowledgeTab, GRAPH_LINK, knowledgeGraphHref, KNOWLEDGE_LABEL, KnowledgeScreen, type KnowledgeTabView } from './KnowledgeTab';
import { GlossaryList, LegalList } from './KnowledgeLists';
import { LegalItem, TermItem } from './KnowledgeItem';
import { NO_LEGAL, NO_TERMS, type SectionKey } from './knowledge-sections';
import { OWNERS_DECIDE, proposalLine } from './KnowledgeTabPage';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {} }) }));

// The Knowledge home as the server renders it (PRD 1795 s2, PRD 2240 s3): the sub-menu, the Legal and
// Glossary lists with their owner and delegate, their filters and the controls of a kind's owner, a
// delegate, another member and a workspace owner, an entry's page, and every situation of the product home.

const PRODUCT = 'demo-product-1';
const TABS = [
  { href: `/app/products/${PRODUCT}`, label: 'Ledger' },
  { href: `/app/products/${PRODUCT}/knowledge`, label: KNOWLEDGE_LABEL },
];
const BASE = demoKnowledgeTab(PRODUCT) as KnowledgeTab;
const anna = { user: 'u-anna', login: 'anna' };
const dev = { user: 'u-dev', login: 'dev' };
const PROPOSAL = {
  proposal: 'p-1', action: 'add', entry: null, fields: { term: 'Invoice', meaning: 'A bill.' }, proposedBy: dev, proposedAt: '2026-12-11T09:00:00Z',
};
const LEGAL = BASE.legal.entries[0] as (typeof BASE.legal.entries)[number];
const TERM = BASE.glossary.entries[0] as (typeof BASE.glossary.entries)[number];

const live = (tab: KnowledgeTab): KnowledgeTabView => ({ kind: 'tab', source: { kind: 'live' }, tab });
const screen = (view: KnowledgeTabView, section: SectionKey | null, body: (tab: KnowledgeTab, source: { kind: 'demo' } | { kind: 'live' }) => ReactNode) =>
  renderToStaticMarkup(createElement(KnowledgeScreen, { view, tabs: TABS, section, children: body }));
const legalPage = (tab: KnowledgeTab, query = {}) => screen(live(tab), 'legal', (t, source) => createElement(LegalList, { tab: t, source, query }));
const glossaryPage = (tab: KnowledgeTab, query = {}) => screen(live(tab), 'glossary', (t, source) => createElement(GlossaryList, { tab: t, source, query }));

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const buttons = (html: string) => [...html.matchAll(/<button\b[^>]*>([^<]*)<\/button>/g)].map((m) => m[1]);

const withProposals = (decides: boolean, owner = anna as typeof anna | null, delegate = null as typeof anna | null): KnowledgeTab => ({
  ...BASE,
  legal: { ...BASE.legal, owner, delegate, decides, proposals: [{ ...PROPOSAL, fields: { code: 'INVOICING', statement: 'No gaps.' } }] },
  glossary: { ...BASE.glossary, owner, delegate, decides, proposals: [PROPOSAL] },
});

const more = (over: Partial<typeof LEGAL>) => ({ ...LEGAL, ...over });

describe('the frame', () => {
  const html = legalPage(BASE);

  it('is headed with the product\'s name, its tabs marking Knowledge', () => {
    expect(/<h1[^>]*>([^<]*)<\/h1>/.exec(html)?.[1]).toBe('Widgets');
    expect(html).toContain('aria-label="Widgets"');
  });

  it('links the knowledge graph from its heading', () => {
    const head = html.slice(0, html.indexOf('</section>'));
    expect(head).toContain(`href="${knowledgeGraphHref(PRODUCT)}"`);
    expect(text(head)).toContain(GRAPH_LINK);
  });

  it('draws the sub-menu in order, the counts on Legal and Glossary, the section showing marked', () => {
    const nav = html.slice(html.indexOf('aria-label="Widgets knowledge"'));
    const labels = [...nav.matchAll(/class="section-tab"[^>]*>([A-Za-z]+)/g)].map((m) => m[1]);
    expect(labels.slice(0, 7)).toEqual(['Constituents', 'Personas', 'Legal', 'Glossary', 'Pitch', 'Repositories', 'Settings']);
    expect(nav).toContain(`href="/app/products/${PRODUCT}/knowledge/legal"`);
    expect(nav).toContain(`href="/app/products/${PRODUCT}/knowledge/repositories"`);
    expect(/<a [^>]*aria-current="page"[^>]*>([^<]*)</.exec(nav)?.[1]).toBe('Legal');
    expect(nav).toContain('Legal: 1 waiting');
    expect(nav).toContain('Glossary: 1 waiting');
  });
});

describe('the Legal list', () => {
  const html = legalPage(BASE);

  it('has one header per column, sorting by Created, newest first, until the address asks otherwise', () => {
    const heads = [...html.matchAll(/<th scope="col"[^>]*>(.*?)<\/th>/g)].map((m) => text(m[1] ?? ''));
    expect(heads.map((h) => h.replace(/[▲▼]/g, '').trim())).toEqual(['Code', 'Statement', 'Source law', 'Owner', 'Created by', 'Created']);
    expect(html).toContain('aria-sort="descending"');
    expect(html.match(/aria-sort=/g)).toHaveLength(1);
  });

  it('marks the header the address sorts by, and keeps the rest of the query in every header link', () => {
    const sorted = legalPage(BASE, { sort: 'code', dir: 'desc', show: 'active' });
    expect(/<th scope="col"[^>]*aria-sort="descending"[^>]*><a[^>]*>Code/.test(sorted)).toBe(true);
    expect(sorted).toContain('href="/app/products/demo-product-1/knowledge/legal?show=active&amp;sort=statement"');
  });

  it('shows an entry\'s code as a link to its page, who added it and when', () => {
    expect(html).toContain(`href="/app/products/${PRODUCT}/knowledge/legal/L-INVOICING-1"`);
    expect(text(html)).toContain('@anna 2026-11-02');
  });

  it('shows a dash for an entry with no author, and sorts it last in Created by, both ways', () => {
    const tab = { ...BASE, legal: { ...BASE.legal, entries: [more({ entry: 'a', id: 'L-A-1', createdBy: null }), more({ entry: 'b', id: 'L-B-1' })] } };
    for (const dir of ['asc', 'desc']) {
      const rows = [...legalPage(tab, { sort: 'by', dir }).matchAll(/data-entry="(L-[A-Z]-1)"/g)].map((m) => m[1]);
      expect(rows).toEqual(['L-B-1', 'L-A-1']);
    }
    expect(text(legalPage(tab))).toContain('L-A-1');
    expect(text(legalPage(tab))).toContain('—');
  });

  it('cuts a long statement to one line ending in an ellipsis', () => {
    const long = 'Invoice numbers follow each other with no gaps, whatever the year, the company or the currency of the invoice.';
    const html2 = legalPage({ ...BASE, legal: { ...BASE.legal, entries: [more({ statement: long })] } });
    expect(html2).toContain('…</td>');
    expect(html2).toContain(`title="${long}"`);
  });

  it('names its owner and delegate, and that the workspace\'s owners decide while none is named', () => {
    expect(text(html)).toContain('Owner: @anna · Delegate: not named');
    const empty = legalPage({ ...BASE, legal: { ...BASE.legal, owner: null, entries: [] } });
    expect(text(empty)).toContain(NO_LEGAL);
    expect(text(empty)).toContain(OWNERS_DECIDE);
  });

  it('filters Active and Retired with their counts, the retired ones behind ?show=retired', () => {
    const retired = more({ entry: 'x', id: 'L-INVOICING-2', number: 2, retiredAt: '2026-12-01T00:00:00Z' });
    const tab = { ...BASE, legal: { ...BASE.legal, entries: [LEGAL, retired] } };
    const active = legalPage(tab);
    expect(text(active)).toContain('Active · 1 Retired · 1');
    expect(active).not.toContain('data-entry="L-INVOICING-2"');
    const kept = legalPage(tab, { show: 'retired' });
    expect(kept).toContain('data-entry="L-INVOICING-2"');
    expect(kept).not.toContain('data-entry="L-INVOICING-1"');
    expect(kept).toContain('href="/app/products/demo-product-1/knowledge/legal/L-INVOICING-2?show=retired"');
  });
});

describe('the Glossary list', () => {
  const html = glossaryPage(BASE);

  it('has a column per field and links a term to its page', () => {
    const heads = [...html.matchAll(/<th scope="col"[^>]*>(.*?)<\/th>/g)].map((m) => text(m[1] ?? '').replace(/[▲▼]/g, '').trim());
    expect(heads).toEqual(['Term', 'Meaning', 'Created by', 'Created']);
    expect(html).toContain(`href="/app/products/${PRODUCT}/knowledge/glossary/demo-term-1"`);
  });

  it('says there is no term yet', () => {
    expect(text(glossaryPage({ ...BASE, glossary: { ...BASE.glossary, entries: [] } }))).toContain(NO_TERMS);
  });
});

describe('a kind\'s owner or delegate', () => {
  const html = legalPage(withProposals(true));

  it('approves or rejects each open proposal, and adds an entry', () => {
    expect(buttons(html)).toEqual(['Approve', 'Reject', 'Add an entry']);
    expect(text(html)).toContain('adds No gaps.');
    expect(buttons(glossaryPage(withProposals(true)))).toEqual(['Approve', 'Reject', 'Add an entry']);
  });

  it('is a delegate the same way', () => {
    const delegate = legalPage(withProposals(true, null, dev));
    expect(text(delegate)).toContain('Owner: not named · Delegate: @dev');
    expect(buttons(delegate)).toContain('Approve');
  });
});

describe('another member', () => {
  const html = legalPage(withProposals(false));

  it('sees Propose instead of Add, and no Approve or Reject', () => {
    expect(buttons(html)).toEqual(['Propose']);
    expect(buttons(glossaryPage(withProposals(false)))).toEqual(['Propose']);
    expect(text(html)).toContain('proposed by @dev');
  });

  it('is not offered the naming of an owner', () => {
    expect(html).not.toContain('Name owner and delegate');
  });
});

describe('a workspace owner', () => {
  const tab = { ...withProposals(true), canName: true, members: [{ id: 'u-anna', login: 'anna' }, { id: 'u-dev', login: 'dev' }] };

  it('sees, above each list, the control that names its owner and delegate', () => {
    for (const html of [legalPage(tab), glossaryPage(tab)]) {
      expect(buttons(html)).toContain('Name owner and delegate');
      expect(html).toMatch(/<option value="u-anna" selected="">@anna<\/option>/);
      expect(html).toContain('<option value="u-dev">@dev</option>');
    }
  });
});

describe('a Legal entry\'s page', () => {
  const page = (tab: KnowledgeTab, entry = LEGAL, query = {}) => screen(live(tab), 'legal', (t, source) => createElement(LegalItem, { tab: t, source, entry, query }));

  it('shows the whole statement and source law, who added it and when, and a way back that keeps the sort', () => {
    const long = `${'Invoice numbers follow each other. '.repeat(6)}End.`;
    const html = page(BASE, more({ statement: long }), { sort: 'code', dir: 'desc' });
    expect(text(html)).toContain(long);
    expect(text(html)).toContain('Created by @anna');
    expect(html).toContain('href="/app/products/demo-product-1/knowledge/legal?sort=code&amp;dir=desc"');
    expect(text(html)).toContain('← Legal');
    expect(text(html)).toContain('Added 2026-11-02 by @anna');
  });

  it('offers Edit and Retire to the kind\'s owner, and the proposals to another member', () => {
    expect(buttons(page(withProposals(true)))).toEqual(['Edit', 'Retire']);
    expect(buttons(page(withProposals(false)))).toEqual(['Propose an edit', 'Propose to retire']);
  });

  it('reads a retired entry as text, marked retired, with no control', () => {
    const html = page(BASE, more({ retiredAt: '2026-12-01T00:00:00Z' }));
    expect(text(html)).toContain('L-INVOICING-1 · retired 2026-12-01');
    expect(buttons(html)).toEqual([]);
  });

  it('shows a dash when nobody is known to have added it', () => {
    expect(text(page(BASE, more({ createdBy: null })))).toContain('Created by —');
  });
});

describe('a term\'s page', () => {
  const page = (tab: KnowledgeTab, entry = TERM) => screen(live(tab), 'glossary', (t, source) => createElement(TermItem, { tab: t, source, entry, query: {} }));

  it('shows the meaning and the words to avoid, with Edit and Remove for the owner', () => {
    const html = page(withProposals(true));
    expect(text(html)).toContain('Avoid refund');
    expect(buttons(html)).toEqual(['Edit', 'Remove']);
    expect(buttons(page(withProposals(false)))).toEqual(['Propose an edit', 'Propose to remove']);
  });

  it('reads a removed term as text, with no control', () => {
    const html = page(BASE, { ...TERM, removedAt: '2026-12-01T00:00:00Z' });
    expect(text(html)).toContain('Credit note · removed 2026-12-01');
    expect(buttons(html)).toEqual([]);
  });
});

describe('a proposal', () => {
  it('names what it does to which entry, and who proposed it', () => {
    expect(proposalLine('legal', { ...PROPOSAL, action: 'retire', entry: LEGAL.entry, fields: {} }, [LEGAL])).toBe('retires L-INVOICING-1 · proposed by @dev');
    expect(proposalLine('legal', { ...PROPOSAL, action: 'edit', entry: LEGAL.entry, fields: { statement: 'New.' }, proposedBy: null }, [LEGAL])).toBe('edits L-INVOICING-1: New.');
    expect(proposalLine('glossary', PROPOSAL, [])).toBe('adds Invoice · proposed by @dev');
  });
});

describe('the situations', () => {
  it('says what is wrong when there is no tab to show', () => {
    const body = () => null;
    expect(text(screen({ kind: 'not-found' }, null, body))).toContain('No such product');
    expect(text(screen({ kind: 'sign-in' }, null, body))).toContain('Sign in to see your products');
    expect(text(screen({ kind: 'unreadable' }, null, body))).toContain('Couldn’t load your products');
  });
});
