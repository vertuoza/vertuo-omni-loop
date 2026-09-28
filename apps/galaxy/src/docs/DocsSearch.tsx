'use client';

import { useDocsSearch } from 'fumadocs-core/search/client';
import { SEARCH_PATH } from './paths';

// The guide's search (PRD 346): fumadocs-core's static search, whose index /docs/search serves as a
// file at build time and the browser downloads on the first keystroke. What a person types is looked
// up there; each result links to its page or its heading. The results' text is fumadocs' markdown
// with <mark> around what matched: shown as plain text.

/** A result's text as a person reads it: no markup, no markdown emphasis. */
export const plain = (content: string) => content.replace(/<[^>]+>/g, '').replace(/[*_`]/g, '').trim();

export function DocsSearch() {
  const { search, setSearch, query } = useDocsSearch({ type: 'static', from: SEARCH_PATH });
  const results = Array.isArray(query.data) ? query.data : [];
  return (
    <search className="docs-search">
      <label className="docs-search-label" htmlFor="docs-search">Search the docs</label>
      <input
        id="docs-search"
        className="docs-search-input"
        type="search"
        placeholder="Search"
        autoComplete="off"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {search ? (
        <ul className="docs-search-results" aria-live="polite">
          {query.isLoading ? <li className="docs-search-note">Searching…</li> : null}
          {!query.isLoading && results.length === 0 ? <li className="docs-search-note">Nothing found.</li> : null}
          {results.slice(0, 8).map((result) => (
            <li key={result.id} data-type={result.type}>
              <a href={result.url}>{plain(result.content)}</a>
            </li>
          ))}
        </ul>
      ) : null}
    </search>
  );
}
