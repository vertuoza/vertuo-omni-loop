import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { demoRepositories } from './repositories-demo';
import { NO_RECORD, RepositoriesView } from './RepositoriesPages';
import { LEDE, NO_REPOSITORY, noPackLine, type RepositoriesData } from './repositories-section';

// The Repositories section as the server renders it (PRD 2419 s1): each repository of the product, its
// playbook pages and decision records each with its level and owner, and a repository with no pack.

const DEMO = demoRepositories('demo-product-1') as RepositoriesData;
const html = renderToStaticMarkup(createElement(RepositoriesView, { data: DEMO }));
const text = (markup: string) =>
  markup.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/&amp;/g, '&').replace(/\s+/g, ' ').replace(/ ,/g, ',').trim();

/** The markup inside the element whose tag carries `attribute="value"`, up to `end`. */
const inside = (markup: string, attribute: string, value: string, end: string) => {
  const at = markup.indexOf(`${attribute}="${value}"`);
  const start = markup.indexOf('>', at) + 1;
  const stop = markup.indexOf(end, start);
  return markup.slice(start, stop === -1 ? undefined : stop);
};
/** One repository's card. */
const card = (repository: string) => inside(html, 'data-repository', repository, 'data-repository=');
/** One row of a table, by its data attribute. */
const row = (markup: string, attribute: string, value: string) => inside(markup, attribute, value, '</tr>');

describe('the Repositories section', () => {
  it('is headed Repositories, with its lede', () => {
    expect(/<h2[^>]*>([^<]*)<\/h2>/.exec(html)?.[1]).toBe('Repositories');
    expect(text(html)).toContain(LEDE);
  });

  it('lists each repository of the product, by name', () => {
    expect([...html.matchAll(/data-repository="([^"]+)"/g)].map((m) => m[1])).toEqual(['widgets/api', 'widgets/web']);
    expect([...html.matchAll(/<h3[^>]*>([^<]*)<\/h3>/g)].map((m) => m[1])).toEqual(['widgets/api', 'widgets/web']);
  });

  it('says which commit a repository’s pack was read at', () => {
    expect(text(card('widgets/api'))).toContain('Read from its knowledge pack at 3f2a9c1, committed 2026-11-18.');
  });

  it('marks each playbook page with its level, where it is read from and its owner', () => {
    const api = card('widgets/api');
    expect(text(row(api, 'data-page', 'testing'))).toBe('testing Testing Repository widgets/api .omni-loop/knowledge/playbook/testing.md @anna —');
    expect(text(row(api, 'data-page', 'setup'))).toContain('Repository widgets/api .omni-loop/knowledge/playbook/setup.md @dev');
    expect(text(row(api, 'data-page', 'ci'))).toBe('ci CI Plan repository widgets/plan .omni-loop/knowledge/playbook/ci.md @pat Write it for this repository');
    expect(text(row(api, 'data-page', 'review'))).toBe('review Review Omni settings widgets/plan .omni-loop/settings/playbook/review.md @pat Write it for this repository');
    expect(text(row(api, 'data-page', 'releasing'))).toBe('releasing Kit default — @anna Write it for this repository');
    expect(row(api, 'data-page', 'ci')).toContain('data-level="plan repo"');
  });

  it('offers "Write it for this repository" on a page that reads a default, as a pull request link', () => {
    const api = card('widgets/api');
    for (const form of ['ci', 'review', 'releasing']) {
      const href = /href="([^"]+)"/.exec(row(api, 'data-page', form))?.[1];
      expect(href).toBe(`https://github.com/widgets/api/new/HEAD?filename=.omni-loop%2Fknowledge%2Fplaybook%2F${form}.md`);
    }
  });

  it('offers none on a page the repository holds', () => {
    const api = card('widgets/api');
    for (const form of ['testing', 'setup']) {
      expect(row(api, 'data-page', form)).not.toContain('Write it for this repository');
      expect(row(api, 'data-page', form)).not.toContain('github.com');
    }
  });

  it('marks each decision record with its level, where it is read from and its owner', () => {
    const api = card('widgets/api');
    expect(text(row(api, 'data-record', '0001'))).toBe('0001 One database for every service Repository widgets/api @anna');
    expect(text(row(api, 'data-record', '0002'))).toBe('0002 Releases go out every week Plan repository widgets/plan @pat');
  });

  it('says a repository with no pack has none, and how to send one', () => {
    const web = card('widgets/web');
    expect(text(web)).toContain(noPackLine('widgets/web'));
    expect(web).not.toContain('<table');
  });

  it('says a product with no repository has none', () => {
    const empty = renderToStaticMarkup(createElement(RepositoriesView, { data: { product: 'p', repositories: [] } }));
    expect(text(empty)).toContain(NO_REPOSITORY);
    expect(empty).toContain('href="/app/products/p/repositories"');
  });

  it('says a repository whose pack holds no record has none, and names a file it skipped', () => {
    const data: RepositoriesData = {
      product: 'p',
      repositories: [{ repository: 'acme/api', pack: { sha: 'a'.repeat(40), committedAt: '2026-11-02T09:00:00Z' }, pages: [], records: [], problems: ['bad.md: does not parse'] }],
    };
    const markup = text(renderToStaticMarkup(createElement(RepositoriesView, { data })));
    expect(markup).toContain(NO_RECORD);
    expect(markup).toContain('Skipped 1 file bad.md: does not parse');
  });
});
