import { createFromSource } from 'fumadocs-core/search/server';
import { guide } from '../../../src/docs/source';

// /docs/search (PRD 346): the guide's search index, exported once at build time as a static file, which
// the search box (src/docs/DocsSearch.tsx) downloads and searches in the browser.

export const revalidate = false;

export const { staticGET: GET } = createFromSource(guide);
