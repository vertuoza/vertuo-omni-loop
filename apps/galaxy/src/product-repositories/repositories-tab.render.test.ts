import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { APPROVERS_READ_ONLY } from '../products/approvers-section';
import { ALL_LINKED, LINKS_READ_ONLY, NO_LINKS } from './LinksSection';
import { NO_PLAN, NO_PLAN_CHOICE, NOTHING_LEFT, PLAN_READ_ONLY, PlanRepositorySection } from './PlanRepositorySection';
import type { RepositoriesTab } from './repositories-tab.contract';
import { demoRepositoriesTab, RepositoriesTabScreen, TAB_LABEL, type RepositoriesTabView } from './RepositoriesTab';

// The Repositories & approvers tab as the server renders it (PRD 1364 s11, acceptance 11): an owner's
// editable links with Add a repository, a member's read-only list, the empty tab, the Approvers section
// under the links, and every situation of the product home.

const PRODUCT = 'demo-product-1';
const TABS = [
  { href: `/app/products/${PRODUCT}`, label: 'Ledger' },
  { href: `/app/products/${PRODUCT}/prds`, label: 'PRDs' },
  { href: `/app/products/${PRODUCT}/repositories`, label: TAB_LABEL },
];
const TAB = demoRepositoriesTab(PRODUCT) as RepositoriesTab;

const render = (view: RepositoriesTabView, add: string | null = null) => renderToStaticMarkup(createElement(RepositoriesTabScreen, { view, tabs: TABS, add }));
const live = (tab: RepositoriesTab): RepositoriesTabView => ({ kind: 'tab', source: { kind: 'live' }, tab });
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const rowOf = (html: string, repo: string) => {
  const from = html.indexOf(`data-repo="${repo}"`);
  return from < 0 ? '' : html.slice(html.indexOf('>', from) + 1, html.indexOf('</li>', from));
};
const buttons = (html: string) => [...html.matchAll(/<button\b[^>]*>([^<]*)<\/button>/g)].map((m) => m[1]);

describe('an owner\'s tab', () => {
  const html = render(live(TAB));

  it('is headed with the product\'s name, its tabs marking Repositories & approvers', () => {
    expect(/<h1[^>]*>([^<]*)<\/h1>/.exec(html)?.[1]).toBe('Widgets');
    const current = /<a [^>]*aria-current="page"[^>]*>([^<]*)<\/a>/.exec(html)?.[1];
    expect(text(current ?? '')).toBe(TAB_LABEL);
  });

  it('lists each repository with every field to edit, Save and Remove', () => {
    const widgets = rowOf(html, 'acme/widgets');
    expect(widgets).toContain('value="web"');
    expect(widgets).toMatch(/<option value="own" selected="">Its own<\/option>/);
    expect(widgets).toMatch(/<input type="checkbox" checked=""[^>]*\/?>\s*<span>acme\/api<\/span>/);
    expect(text(widgets)).toContain('added by a PRD');
    expect(buttons(widgets)).toEqual(['Save', 'Remove']);
    expect(rowOf(html, 'acme/api')).toMatch(/<input type="checkbox" checked=""[^>]*\/?>\s*<span>Read only<\/span>/);
  });

  it('offers the workspace\'s other repositories under Add a repository, starting on ?add=', () => {
    expect(buttons(html)).toContain('Add a repository');
    expect(render(live({ ...TAB, addable: ['acme/billing', 'acme/scripts'] }), 'acme/scripts')).toMatch(/<option value="acme\/scripts" selected="">/);
    expect(text(render(live({ ...TAB, addable: [] })))).toContain(ALL_LINKED);
  });

  it('shows the Approvers section under the links, with its controls', () => {
    expect(html.indexOf('id="approvers-title"')).toBeGreaterThan(html.indexOf('id="links-title"'));
    expect(text(html)).toContain('Irisa');
    expect(text(html)).not.toContain(APPROVERS_READ_ONLY);
  });

  it('says a product with no repository yet', () => {
    expect(text(render(live({ ...TAB, links: [] })))).toContain(NO_LINKS);
  });
});

describe('a member\'s tab', () => {
  const html = render(live({ ...TAB, owner: false, approvers: TAB.approvers && { ...TAB.approvers, owner: false } }));

  it('reads every link as text, with no control', () => {
    expect(html).not.toContain('<input');
    expect(buttons(html)).toEqual([]);
    expect(text(rowOf(html, 'acme/widgets'))).toBe('acme/widgets role web · knowledge: its own · consumes acme/api · added by a PRD');
    expect(text(rowOf(html, 'acme/api'))).toBe('acme/api role api · knowledge: its own · read only · added by a person');
    expect(text(html)).toContain(LINKS_READ_ONLY);
    expect(text(html)).toContain(APPROVERS_READ_ONLY);
  });

  it('names an imported knowledge base by its commit, and a link with no role', () => {
    const imported = render(live({ ...TAB, owner: false, links: [{ repo: 'acme/api', role: null, knowledge: 'imported', readAt: '3f2a9c1e0b7d4c5a8e6f1d2c3b4a5968778695a4', readOnly: false, consumes: [], addedBy: 'person', ladderStep: 1 }] }));
    expect(text(rowOf(imported, 'acme/api'))).toBe('acme/api no role yet · knowledge imported at 3f2a9c1 · added by a person');
  });
});

describe('the situations', () => {
  it('says what is wrong when there is no tab to show', () => {
    expect(text(render({ kind: 'not-found' }))).toContain('No such product');
    expect(text(render({ kind: 'sign-in' }))).toContain('Sign in to see your products');
    expect(text(render({ kind: 'unreadable' }))).toContain('Couldn’t load your products');
  });

  it('keeps the links when the Approvers list could not be read', () => {
    const html = render(live({ ...TAB, approvers: null }));
    expect(html).toContain('data-repo="acme/widgets"');
    expect(text(html)).toContain('Couldn’t load this product’s approvers');
  });
});

describe('the ladder and the plan repository (PRD 2011 s17)', () => {
  const planned = (plan: RepositoriesTab['plan'], over: Partial<RepositoriesTab> = {}) => render(live({ ...TAB, plan, ...over }));

  it('draws one line per repository with its step, five cells, the reached ones filled', () => {
    const html = planned(null);
    const from = html.indexOf('data-ladder-repo="acme/widgets"');
    const row = html.slice(from, html.indexOf('</li>', from));
    expect(text(row).replace(/^[^>]*> /, '')).toBe('widgets step 3');
    expect(row).toContain('aria-label="acme/widgets: step 3 of 5"');
    expect(row.match(/plan-ladder-cell on/g)).toHaveLength(3);
    expect(row.match(/plan-ladder-cell"/g)).toHaveLength(2);
    expect(text(html)).not.toContain('Still in the plan repository');
  });

  it('names what is still in the plan repository, with nothing to press', () => {
    const html = planned({ repository: 'acme/plan', holds: [{ name: 'widgets', why: 'step 3' }, { name: 'roadmap 0412', why: 'in git' }] });
    const still = html.slice(html.indexOf('Still in the plan repository'), html.indexOf('id="links-title"'));
    expect(text(still)).toContain('Held by widgets · step 3');
    expect(text(still)).toContain('Held by roadmap 0412 · in git');
    expect(still).not.toContain('<button');
    expect(text(html).toLowerCase()).not.toContain('archive');
  });

  it('says when nothing open is left in it, the same to a member as to an owner', () => {
    const plan = { repository: 'acme/plan', holds: [] };
    expect(text(planned(plan))).toContain(`acme/plan ${NOTHING_LEFT}`);
    expect(text(planned(plan, { owner: false, approvers: null }))).toContain(`acme/plan ${NOTHING_LEFT}`);
  });
});

describe('naming the plan repository', () => {
  const sectionOf = (html: string) => html.slice(html.indexOf('id="plan-title"'), html.indexOf('id="links-title"'));
  const options = (html: string) => [...html.matchAll(/<option value="([^"]*)"( selected="")?>/g)].map((m) => (m[2] ? `${m[1]} *` : m[1]));
  const PLAN = { repository: 'acme/plan', holds: [] };

  it('offers an owner none or any of the workspace\'s repositories, the saved one picked, Save waiting for a change', () => {
    const section = sectionOf(render(live({ ...TAB, plan: PLAN })));
    expect(section).toContain('aria-label="Plan repository"');
    expect(options(section)).toEqual(['', 'acme/api', 'acme/plan *', 'acme/scripts', 'acme/widgets']);
    expect(section).toContain(`<option value="">${NO_PLAN_CHOICE}</option>`);
    expect(section).toMatch(/<button class="ask-button" type="submit" disabled="">Save<\/button>/);
  });

  it('picks none for an owner while the product names no plan repository, and keeps a saved one the workspace no longer lists', () => {
    expect(options(sectionOf(render(live({ ...TAB, plan: null }))))).toEqual([' *', 'acme/api', 'acme/plan', 'acme/scripts', 'acme/widgets']);
    expect(options(sectionOf(render(live({ ...TAB, plan: { repository: 'acme/old-plan', holds: [] } }))))).toContain('acme/old-plan *');
  });

  it('reads the plan repository as text to a member, or says there is none, with no control', () => {
    const member = (plan: RepositoriesTab['plan']) => sectionOf(render(live({ ...TAB, owner: false, approvers: null, plan })));
    expect(member(PLAN)).not.toContain('<select');
    expect(buttons(member(PLAN))).toEqual([]);
    expect(text(member(PLAN))).toContain(`acme/plan ${PLAN_READ_ONLY}`);
    expect(text(member(null))).toContain(`${NO_PLAN} ${PLAN_READ_ONLY}`);
  });

  it('says a refusal in the database\'s words', () => {
    const refused = 'Repository: acme/gone is not one of this workspace\'s repositories.';
    const html = renderToStaticMarkup(createElement(PlanRepositorySection, { form: { plan: null, busy: false, message: refused }, owner: true, repositories: ['acme/api'] }));
    expect(html).toContain(`<p class="products-refusal" role="alert">${refused.replace(/'/g, '&#x27;')}</p>`);
  });
});
