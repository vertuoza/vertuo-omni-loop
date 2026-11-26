import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ApiKeysLoading, BusinessLoading, FleetsLoading, JevLoading, PlaybookLoading, RepositoriesLoading } from './pages';

// Each settings page has a skeleton shaped like the page (omni-loop-29 s4): its own head card and
// sections, never another page's and never the Fleets list for every page.

const pages = {
  business: BusinessLoading, fleets: FleetsLoading, 'api-keys': ApiKeysLoading,
  playbook: PlaybookLoading, repositories: RepositoriesLoading, jev: JevLoading,
};

const marks = (page: keyof typeof pages) => renderToStaticMarkup(h(pages[page]));

describe('AC-3: each settings page has a skeleton shaped like the page', () => {
  it('AC-3: draws a different skeleton for each page', () => {
    const drawn = Object.keys(pages).map((page) => marks(page as keyof typeof pages));
    expect(new Set(drawn).size).toBe(drawn.length);
  });

  it('AC-3: Business draws its claims, Connect an agent and the questions', () => {
    const html = marks('business');
    for (const what of ['the claims', 'your agent links', 'the agents’ questions']) expect(html).toContain(`Loading ${what}…`);
  });

  it('AC-3: Jev draws its key and its decisions, Playbook its pages', () => {
    expect(marks('jev')).toContain('Loading the Jev key…');
    expect(marks('jev')).toContain('Loading the Jev decisions…');
    expect(marks('playbook')).toContain('Loading the playbook pages…');
  });

  it('AC-3: each page names its own list, never the fleets for another', () => {
    expect(marks('api-keys')).toContain('Loading the API keys…');
    expect(marks('api-keys')).not.toContain('the fleets');
    expect(marks('repositories')).toContain('Loading the repositories…');
    expect(marks('repositories')).not.toContain('the fleets');
  });
});
