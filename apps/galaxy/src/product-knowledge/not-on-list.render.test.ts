import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { foundDomains, type RepositoryFolders } from './found-domains';
import { demoKnowledgeTab, KnowledgeScreen } from './KnowledgeTab';
import { CANNOT_BE_KEY, NotOnList, UNREAD } from './NotOnList';
import type { KnowledgeTab } from './product-knowledge.contract';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {} }) }));

// The Domains section's Not on the list region and the sub-menu's count (PRD 2583 s3), as the server renders
// them. Fictional repositories and folders.

const PRODUCT = 'demo-product-1';
const TAB = demoKnowledgeTab(PRODUCT) as KnowledgeTab;
const TABS = [{ href: `/app/products/${PRODUCT}`, label: 'Ledger' }];
const live = { kind: 'live' } as const;

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const buttons = (html: string) => [...html.matchAll(/<button\b[^>]*>([^<]*)<\/button>/g)].map((m) => m[1]);
const folders = (repository: string, names: string[] | null): RepositoryFolders => ({ repository, folders: names === null ? null : new Map(names.map((n) => [n, ''])) });
const region = (decides: boolean, repos: RepositoryFolders[], listed = TAB.domains.entries) =>
  renderToStaticMarkup(createElement(NotOnList, { product: PRODUCT, source: live, decides, found: foundDomains(listed, repos) }));

describe('the Not on the list region', () => {
  const REPOS = [folders('acme/api', ['planning', 'invoicing', 'Bad_Name', 'legacy']), folders('acme/web', ['planning']), folders('acme/old', null)];
  const RETIRED = { ...(TAB.domains.entries[0] as (typeof TAB.domains.entries)[number]), entry: 'd-old', key: 'legacy', retiredAt: '2026-12-01T00:00:00Z' };
  const listed = [...TAB.domains.entries, RETIRED];

  it('shows each folder off the list with the repositories holding it, and one action to add it', () => {
    const html = region(true, REPOS, listed);
    expect(text(html)).toContain('planning · acme/api, acme/web');
    expect(text(html)).toContain('Not on the list · 2');
    expect(html).toContain('data-folder="planning"');
    expect(html).not.toContain('data-folder="invoicing"');
    expect(buttons(html).filter((b) => b === 'Add to the list')).toHaveLength(1);
  });

  it('offers another member the same as a proposal', () => {
    expect(buttons(region(false, REPOS, listed))).toEqual(['Propose']);
  });

  it('says a folder that cannot be a key cannot, and offers no action on it', () => {
    const html = region(true, [folders('acme/api', ['Bad_Name'])]);
    expect(text(html)).toContain(`Bad_Name · acme/api ${CANNOT_BE_KEY}`);
    expect(buttons(html)).toEqual([]);
  });

  it('shows a retired domain still in a repository as such, with its page, and a repository with no pack as not read yet', () => {
    const html = region(true, REPOS, listed);
    expect(text(html)).toContain('legacy · retired, still in acme/api');
    expect(html).toContain(`href="/app/products/${PRODUCT}/knowledge/domains/legacy"`);
    expect(text(html)).toContain('acme/old · not read yet');
  });

  it('is absent when there is nothing to show, and says it could not read when it could not', () => {
    expect(region(true, [folders('acme/api', ['invoicing'])])).toBe('');
    expect(region(true, [])).toBe('');
    const unread = renderToStaticMarkup(createElement(NotOnList, { product: PRODUCT, source: live, decides: true, found: null }));
    expect(text(unread)).toContain(UNREAD);
    expect(buttons(unread)).toEqual([]);
  });
});

describe('the sub-menu\'s Domains entry', () => {
  const nav = (notOnList: number | null) =>
    renderToStaticMarkup(createElement(KnowledgeScreen, {
      view: { kind: 'tab', source: live, tab: notOnList === null ? TAB : { ...TAB, notOnList } }, tabs: TABS, section: 'legal', children: () => null,
    }));
  const entry = (html: string) => /<a[^>]*href="[^"]*\/knowledge\/domains"[^>]*>(.*?)<\/a>/.exec(html)?.[1] ?? '';

  it('counts the folders off the list beside the active count, on any section', () => {
    expect(text(entry(nav(2)))).toBe('Domains 1 · 2 not on the list');
  });

  it('shows the active count alone when none is off the list or none is known', () => {
    expect(text(entry(nav(0)))).toBe('Domains 1');
    expect(text(entry(nav(null)))).toBe('Domains 1');
  });
});
