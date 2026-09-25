// Bundles the `omni` CLI into one dependency-free file, `kit/dist/omni.mjs`, that a repository
// carries as `.omni-loop/bin/omni.mjs` and runs with plain `node` — no install step.
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const kit = fileURLToPath(new URL('.', import.meta.url));
await build({
  entryPoints: [`${kit}bin/omni.mjs`],
  outfile: `${kit}dist/omni.mjs`,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  legalComments: 'none',
});
