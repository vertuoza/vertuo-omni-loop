import { fileURLToPath } from 'node:url';

// The monorepo root: the app imports the game layer (game/*.mjs) through the workspace packages.
const root = fileURLToPath(new URL('../..', import.meta.url));

/** @type {import('next').NextConfig} */
export default {
  transpilePackages: ['@omni/galaxy', '@omni/sprites', 'vertuo-omni-plan'],
  turbopack: { root },
  outputFileTracingRoot: root,
};
