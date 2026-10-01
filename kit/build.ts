// Bundles the `omni` CLI into one dependency-free file, `kit/dist/omni.mjs`, that a repository
// carries as `.omni-loop/bin/omni.mjs` and runs with plain `node` — no install step.
// `__OMNI_BUNDLE__` is the bundle's marker (see lib/init/bundle.ts): only a build defines it, and
// it records where the kit comes from, so `omni init` can install the bundle and name its source.
// `__OMNI_TEMPLATES__` carries the kit defaults (see lib/playbook/templates.ts): every file under
// kit/templates/, read by the same loader that reads them from source, so the bundle needs no other
// file. The bundle exports that loader beside `main`, so the committed file can be asked for them.
// The marker also carries the kit's version: `version` from the root package.json, `null` when it has
// none (PRD 347); the release workflow stamps it there before it builds.
// `node kit/build.ts [outfile] [package.json]`: the outfile defaults to `kit/dist/omni.mjs`, which is
// committed and kept equal to a fresh build by kit/test/dist.test.ts — so the output never depends
// on the cwd. The package.json defaults to the repository's own; a test names another.
import { build } from 'esbuild';
import { z } from 'zod';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { slugFromRemote } from './lib/context.ts';
import { readTemplates } from './lib/playbook/templates.ts';

// The CLI, and the templates loader beside it: an entry that exists only here, named after this
// file in the bundle's module comments. Its hashbang leads the bundle.
const ENTRY = [
  '#!/usr/bin/env node',
  "export * from './bin/omni.ts';",
  "export { formTemplate, frontDoorTemplate } from './lib/playbook/templates.ts';",
  '',
].join('\n');

const kit = fileURLToPath(new URL('.', import.meta.url));
const outfile = process.argv[2] ? resolve(process.argv[2]) : `${kit}dist/omni.mjs`;
const pkgFile = process.argv[3] ? resolve(process.argv[3]) : fileURLToPath(new URL('../package.json', import.meta.url));
/** The one key the build reads of `package.json`: its version, a string when it has one. */
const PackageSchema = z.looseObject({ version: z.unknown().optional() });
const pkgVersion = PackageSchema.parse(JSON.parse(readFileSync(pkgFile, 'utf8'))).version;
const version = typeof pkgVersion === 'string' && pkgVersion ? pkgVersion : null;
let home: string | null = null;
try {
  home = slugFromRemote(execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: kit, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
} catch {
  home = null;
}
await build({
  stdin: { contents: ENTRY, resolveDir: kit, sourcefile: 'build.mjs', loader: 'js' },
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
  // A string, parsed once where it is read: an object here would be initialised in every module.
  define: { __OMNI_BUNDLE__: JSON.stringify({ home, version }), __OMNI_TEMPLATES__: JSON.stringify(JSON.stringify(readTemplates())) },
});
