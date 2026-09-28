import { defineConfig, defineDocs } from 'fumadocs-mdx/config';

// The guide (PRD 346): the markdown pages of docs/guide/ at the repository's root, compiled by
// fumadocs-mdx at build time into .source/, which src/docs/source.ts hands to fumadocs-core's loader.
// Their order is docs/guide/meta.json's. Fumadocs' own UI is not used: the layout is src/docs/'s.
export const docs = defineDocs({ dir: '../../docs/guide' });

// No syntax highlighting: Shiki would paint code blocks with its own theme's colours, inline, where
// the app draws everything from @omni/design's tokens (src/docs/docs.css).
export default defineConfig({ mdxOptions: { rehypeCodeOptions: false } });
