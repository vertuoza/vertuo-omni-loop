// Bundles the `omni` CLI into one dependency-free file, `kit/dist/omni.mjs`, that a repository
// carries as `.omni-loop/bin/omni.mjs` and runs with plain `node` — no install step.
// `__OMNI_BUNDLE__` is the bundle's marker (see lib/init/bundle.mjs): only a build defines it, and
// it records where the kit comes from, so `omni init` can install the bundle and name its source.
// `node kit/build.mjs [outfile]`: the outfile defaults to `kit/dist/omni.mjs`, which is committed and
// kept equal to a fresh build by kit/test/dist.test.mjs — so the output never depends on the cwd.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { slugFromRemote } from './lib/context.mjs';

const kit = fileURLToPath(new URL('.', import.meta.url));
const outfile = process.argv[2] ? resolve(process.argv[2]) : `${kit}dist/omni.mjs`;
let home = null;
try {
  home = slugFromRemote(execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: kit, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
} catch {
  home = null;
}
await build({
  entryPoints: [`${kit}bin/omni.mjs`],
  outfile,
  // esbuild names each bundled module in a comment relative to this directory: pin it to the
  // repository root, so a build from any cwd is byte-identical.
  absWorkingDir: fileURLToPath(new URL('..', import.meta.url)),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  legalComments: 'none',
  define: { __OMNI_BUNDLE__: JSON.stringify({ home }) },
});
