import { defineConfig, defineDocs } from 'fumadocs-mdx/config';
import { rehypeCodeBadges } from './src/docs/badges';
import { remarkDiagrams } from './src/docs/diagrams';

// The guide (PRD 346): the markdown pages of docs/guide/ at the repository's root, compiled by
// fumadocs-mdx at build time into .source/, which src/docs/source.ts hands to fumadocs-core's loader.
// Their order is docs/guide/meta.json's. Fumadocs' own UI is not used: the layout is src/docs/'s.
export const docs = defineDocs({ dir: '../../docs/guide' });

// No syntax highlighting: Shiki would paint code blocks with its own theme's colours, inline, where
// the app draws everything from @omni/design's tokens (src/docs/docs.css).
// Each code block's fence words (```bash terminal agent) become its badges, set above the code
// (PRD 373, src/docs/badges.ts): decided here, at compile time, never in the browser.
// Each diagram, a line `![…](diagrams/<name>.svg)`, becomes the drawing itself, set in the page so the
// theme's tokens paint it (src/docs/diagrams.ts): first in the list, so fumadocs' image step never
// turns it into an <img>.
export default defineConfig({
  mdxOptions: {
    rehypeCodeOptions: false,
    remarkPlugins: (defaults) => [remarkDiagrams, ...defaults],
    rehypePlugins: [rehypeCodeBadges],
  },
});
