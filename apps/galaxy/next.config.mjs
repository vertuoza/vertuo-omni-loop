import { fileURLToPath } from 'node:url';

// The monorepo root: the app imports the game layer (game/*.mjs) through the workspace packages.
const root = fileURLToPath(new URL('../..', import.meta.url));

// The knowledge map (PRD 149) reads the checkout's Omni Loop config and knowledge registers at request
// time, through the kit (src/data/load-knowledge.ts). Nothing imports those files, so the trace would
// leave them out of a deployment: they are traced by hand. Next matches a key anywhere in a route, so
// '/' reaches every server route, the arcade's `/` and the `/knowledge` page among them; the files
// weigh a few kilobytes. Globs resolve from this folder. The registers only: the playbook and the
// decision records are not read.
const KNOWLEDGE_FILES = [
  '../../.omni-loop/config.yml',
  '../../.omni-loop/knowledge/product/*.md',
  '../../.omni-loop/knowledge/domains/**/*.md',
  '../../.omni-loop/knowledge/cross-domain/*.md',
];

/** @type {import('next').NextConfig} */
export default {
  transpilePackages: ['@omni/galaxy', '@omni/sprites', 'vertuo-omni-plan'],
  turbopack: { root },
  outputFileTracingRoot: root,
  outputFileTracingIncludes: { '/': KNOWLEDGE_FILES },
};
