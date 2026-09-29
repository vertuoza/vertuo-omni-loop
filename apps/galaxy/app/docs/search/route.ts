import { createSearchAPI } from 'fumadocs-core/search/server';
import { searchIndexes } from '../../../src/docs/search';
import { guide } from '../../../src/docs/source';

// /docs/search (PRD 346, PRD 580): the docs' search index, the guide's pages and every skill page
// (src/docs/search.ts), exported once at build time as a static file, which the search box
// (src/docs/DocsSearch.tsx) downloads and searches in the browser.

export const revalidate = false;

export const { staticGET: GET } = createSearchAPI('advanced', {
  indexes: () => searchIndexes(guide.getPages()),
});
