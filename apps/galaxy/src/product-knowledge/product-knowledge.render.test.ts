import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { KnowledgeTab } from './product-knowledge.contract';
import { demoKnowledgeTab, GRAPH_LINK, knowledgeGraphHref, KNOWLEDGE_LABEL, KnowledgeTabScreen, type KnowledgeTabView } from './KnowledgeTab';
import { NO_LEGAL, NO_TERMS, OWNERS_DECIDE, proposalLine } from './KnowledgeTabPage';

// The Knowledge tab as the server renders it (PRD 1795 s2): the Legal and Glossary sections, each naming
// its owner and delegate, and the controls of a kind's owner, a delegate, another member and a workspace
// owner; every situation of the product home.

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

const render = (view: KnowledgeTabView) => renderToStaticMarkup(createElement(KnowledgeTabScreen, { view, tabs: TABS }));
const live = (tab: KnowledgeTab): KnowledgeTabView => ({ kind: 'tab', source: { kind: 'live' }, tab });
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const buttons = (html: string) => [...html.matchAll(/<button\b[^>]*>([^<]*)<\/button>/g)].map((m) => m[1]);
/** A section's html, from its heading to the next section's. */
const sectionOf = (html: string, id: string) => {
  const from = html.indexOf(`aria-labelledby="${id}"`);
  const next = html.indexOf('<section', from + 1);
  return html.slice(from, next < 0 ? undefined : next);
};

const withProposals = (decides: boolean, owner = anna as typeof anna | null, delegate = null as typeof anna | null): KnowledgeTab => ({
  ...BASE,
  legal: { ...BASE.legal, owner, delegate, decides, proposals: [{ ...PROPOSAL, fields: { code: 'INVOICING', statement: 'No gaps.' } }] },
  glossary: { ...BASE.glossary, owner, delegate, decides, proposals: [PROPOSAL] },
});

describe('the tab', () => {
  const html = render(live(BASE));

  it('is headed with the product\'s name, its tabs marking Knowledge', () => {
    expect(/<h1[^>]*>([^<]*)<\/h1>/.exec(html)?.[1]).toBe('Widgets');
    expect(text(/<a [^>]*aria-current="page"[^>]*>([^<]*)<\/a>/.exec(html)?.[1] ?? '')).toBe(KNOWLEDGE_LABEL);
  });

  it('links the knowledge graph from its heading, and stays the marked tab', () => {
    const head = html.slice(0, html.indexOf('</section>'));
    expect(head).toContain(`href="${knowledgeGraphHref(PRODUCT)}"`);
    expect(knowledgeGraphHref(PRODUCT)).toBe(`/app/products/${PRODUCT}/knowledge/graph`);
    expect(text(head)).toContain(GRAPH_LINK);
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
  });

  it('has a Legal section and a Glossary section, each naming its owner and delegate', () => {
    expect(html.indexOf('id="glossary-title"')).toBeGreaterThan(html.indexOf('id="legal-title"'));
    expect(text(sectionOf(html, 'legal-title'))).toContain('Owner: @anna · Delegate: not named');
    expect(text(sectionOf(html, 'glossary-title'))).toContain('Owner: @anna · Delegate: not named');
  });

  it('shows an entry by its id and a term by its words to avoid', () => {
    expect(sectionOf(html, 'legal-title')).toContain('L-INVOICING-1');
    expect(sectionOf(html, 'glossary-title')).toContain('value="refund"');
  });

  it('says a kind with no entry, and that the workspace\'s owners decide while none is named', () => {
    const empty = render(live({ ...BASE, legal: { ...BASE.legal, owner: null, entries: [] }, glossary: { ...BASE.glossary, owner: null, entries: [] } }));
    expect(text(empty)).toContain(NO_LEGAL);
    expect(text(empty)).toContain(NO_TERMS);
    expect(text(empty)).toContain(OWNERS_DECIDE);
  });

  it('keeps a retired entry as text, and a removed term', () => {
    const kept = render(live({
      ...BASE,
      legal: { ...BASE.legal, entries: [...BASE.legal.entries, { ...(BASE.legal.entries[0] as (typeof BASE.legal.entries)[number]), entry: 'x', id: 'L-INVOICING-2', number: 2, retiredAt: '2026-12-01' }] },
      glossary: { ...BASE.glossary, entries: [...BASE.glossary.entries, { ...(BASE.glossary.entries[0] as (typeof BASE.glossary.entries)[number]), entry: 'y', term: 'Bill', meaning: 'Old.', avoid: [], removedAt: '2026-12-01' }] },
    }));
    expect(text(kept)).toContain('L-INVOICING-2 · retired');
    expect(text(kept)).toContain('Bill · removed');
    expect(kept).not.toContain('data-entry="L-INVOICING-2"');
  });
});

describe('a kind\'s owner or delegate', () => {
  const html = render(live(withProposals(true)));

  it('edits and retires directly, adds, and approves or rejects each open proposal', () => {
    const legal = sectionOf(html, 'legal-title');
    expect(buttons(legal)).toEqual(['Edit', 'Retire', 'Approve', 'Reject', 'Add']);
    expect(buttons(sectionOf(html, 'glossary-title'))).toEqual(['Edit', 'Remove', 'Approve', 'Reject', 'Add']);
    expect(text(legal)).toContain('adds No gaps.');
  });

  it('is a delegate the same way', () => {
    const delegate = render(live(withProposals(true, null, dev)));
    expect(text(sectionOf(delegate, 'legal-title'))).toContain('Owner: not named · Delegate: @dev');
    expect(buttons(sectionOf(delegate, 'legal-title'))).toContain('Approve');
  });
});

describe('another member', () => {
  const html = render(live(withProposals(false)));

  it('sees Propose instead of Edit, and no Approve or Reject', () => {
    expect(buttons(sectionOf(html, 'legal-title'))).toEqual(['Propose an edit', 'Propose to retire', 'Propose']);
    expect(buttons(sectionOf(html, 'glossary-title'))).toEqual(['Propose an edit', 'Propose to remove', 'Propose']);
    expect(text(html)).toContain('proposed by @dev');
  });

  it('is not offered the naming of an owner', () => {
    expect(html).not.toContain('Name owner and delegate');
  });
});

describe('a workspace owner', () => {
  const html = render(live({ ...withProposals(true), canName: true, members: [{ id: 'u-anna', login: 'anna' }, { id: 'u-dev', login: 'dev' }] }));

  it('sees, in each section, the control that names its owner and delegate', () => {
    expect(buttons(sectionOf(html, 'legal-title'))).toContain('Name owner and delegate');
    expect(buttons(sectionOf(html, 'glossary-title'))).toContain('Name owner and delegate');
    expect(sectionOf(html, 'legal-title')).toMatch(/<option value="u-anna" selected="">@anna<\/option>/);
    expect(sectionOf(html, 'legal-title')).toContain('<option value="u-dev">@dev</option>');
  });
});

describe('a proposal', () => {
  it('names what it does to which entry, and who proposed it', () => {
    const entry = BASE.legal.entries[0] as (typeof BASE.legal.entries)[number];
    expect(proposalLine('legal', { ...PROPOSAL, action: 'retire', entry: entry.entry, fields: {} }, [entry])).toBe('retires L-INVOICING-1 · proposed by @dev');
    expect(proposalLine('legal', { ...PROPOSAL, action: 'edit', entry: entry.entry, fields: { statement: 'New.' }, proposedBy: null }, [entry])).toBe('edits L-INVOICING-1: New.');
    expect(proposalLine('glossary', PROPOSAL, [])).toBe('adds Invoice · proposed by @dev');
  });
});

describe('the situations', () => {
  it('says what is wrong when there is no tab to show', () => {
    expect(text(render({ kind: 'not-found' }))).toContain('No such product');
    expect(text(render({ kind: 'sign-in' }))).toContain('Sign in to see your products');
    expect(text(render({ kind: 'unreadable' }))).toContain('Couldn’t load your products');
  });
});
