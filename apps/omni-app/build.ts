// Bundles each Vercel function of the GitHub App into one self-contained file, `api/<name>.mjs`, from
// its entry under `entries/`. Vercel compiles a TypeScript function file by file and keeps every
// `import './x.ts'` as written, so a function whose source imports TypeScript fails to start
// (`ERR_MODULE_NOT_FOUND`, #1084). The bundle carries the app's code, the kit and the workspace
// packages; npm packages stay imports, which Vercel traces and ships beside it. Vercel finds its
// functions before any build command runs, so the bundles are committed, as `kit/dist/omni.mjs` is,
// and `src/vercel-functions.test.ts` keeps them equal to a fresh build.
// `node apps/omni-app/build.ts [outdir]`: the outdir defaults to `apps/omni-app/api/`.
import { build } from 'esbuild';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The functions Vercel serves, each from `entries/<name>.ts`. */
export const FUNCTIONS = ['github', 'inngest'] as const;

/** A workspace package, whose TypeScript the bundle carries. */
const WORKSPACE = /^(?:vertuo-omni-plan|@omni\/[^/]+)(?:\/|$)/;

const app = fileURLToPath(new URL('.', import.meta.url));

/** Bundles every function into `outdir`. */
export async function buildFunctions(outdir: string): Promise<void> {
  await build({
    entryPoints: FUNCTIONS.map((name) => `${app}entries/${name}.ts`),
    outdir,
    outExtension: { '.js': '.mjs' },
    // esbuild names each bundled module in a comment relative to this directory: pin it to the
    // repository root, so a build from any checkout is byte-identical.
    absWorkingDir: fileURLToPath(new URL('../..', import.meta.url)),
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    // The workspace's own TypeScript is bundled; every other bare import is an npm package and stays one.
    plugins: [{
      name: 'npm-external',
      setup(b) {
        b.onResolve({ filter: /^[^./]/ }, (args) => (WORKSPACE.test(args.path) ? undefined : { path: args.path, external: true }));
      },
    }],
    legalComments: 'none',
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildFunctions(process.argv[2] ? resolve(process.argv[2]) : `${app}api`);
}
