// `pnpm commander:eval --key-file <file>` (PRD 3107 s5): bundles scripts/commander-eval/eval.ts, whose app code imports without
// extensions as the bundler resolves them and node does not, into a temporary directory and runs it there. A person runs it:
// it calls the real model on the key in the file, never in CI.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../..', import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'commander-eval-'));
try {
  const outfile = join(dir, 'commander-eval.mjs');
  await build({
    entryPoints: [join(root, 'scripts/commander-eval/eval.ts')],
    outfile,
    absWorkingDir: root,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    // The fixtures are read from beside the source, so the bundle names them from the repository.
    define: { 'import.meta.url': JSON.stringify(pathToFileURL(join(root, 'scripts/commander-eval/eval.ts')).href) },
    logLevel: 'error',
  });
  const { main } = (await import(pathToFileURL(outfile).href)) as { main: (argv: readonly string[]) => Promise<number> };
  process.exitCode = await main(process.argv.slice(2));
} finally {
  rmSync(dir, { recursive: true, force: true });
}
