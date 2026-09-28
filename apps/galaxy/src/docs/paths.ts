// Where the guide lives on the site (PRD 346). No Node import here: the search box, which runs in the
// browser, reads it too.

/** The guide's root; its page `index` is served there. */
export const DOCS_PATH = '/docs';

/** Where the guide's search index is served (app/docs/search/route.ts), built once, statically. */
export const SEARCH_PATH = `${DOCS_PATH}/search`;

/** The site path a page of the guide is served at. */
export const pageUrl = (slug: string) => (slug === 'index' ? DOCS_PATH : `${DOCS_PATH}/${slug}`);
