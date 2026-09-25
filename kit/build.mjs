// Bundles the `omni` CLI into one dependency-free file, `kit/dist/omni.mjs`, that a repository
// carries as `.omni-loop/bin/omni.mjs` and runs with plain `node` — no install step.
// `__OMNI_BUNDLE__` is the bundle's marker (see lib/init/bundle.mjs): only a build defines it, and
// it records where the kit comes from, so `omni init` can install the bundle and name its source.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { slugFromRemote } from './lib/context.mjs';

const kit = fileURLToPath(new URL('.', import.meta.url));
let home = null;
try {
  home = slugFromRemote(execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: kit, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
} catch {
  home = null;
}
await build({
  entryPoints: [`${kit}bin/omni.mjs`],
  outfile: `${kit}dist/omni.mjs`,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  legalComments: 'none',
  define: { __OMNI_BUNDLE__: JSON.stringify({ home }) },
});
