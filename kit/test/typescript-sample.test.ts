// The first TypeScript test outside the arcade (PRD 725, s1): it proves the suite runs `*.test.ts`
// under `kit/`, that `pnpm typecheck` reads it, and that Node itself runs a `.ts` file that imports
// another `.ts` file by its own name, with no build step and no runner (ADR-0054).
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

type Engines = { engines: { node: string } };

let dir: string | undefined;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

describe('TypeScript in the kit', () => {
  it('runs as a test file', () => {
    const shout = (word: string): string => word.toUpperCase();
    expect(shout('omni')).toBe('OMNI');
  });

  it('runs on Node itself, an import naming the .ts file it imports', () => {
    dir = mkdtempSync(join(tmpdir(), 'omni-ts-'));
    writeFileSync(join(dir, 'package.json'), '{ "type": "module" }\n');
    writeFileSync(join(dir, 'slice.ts'), 'export type Slice = { id: string };\nexport const label = (slice: Slice): string => `slice ${slice.id}`;\n');
    writeFileSync(join(dir, 'main.ts'), "import { label, type Slice } from './slice.ts';\nconst slice: Slice = { id: 's1' };\nconsole.log(label(slice));\n");
    const out = execFileSync(process.execPath, [join(dir, 'main.ts')], { encoding: 'utf8' });
    expect(out.trim()).toBe('slice s1');
  });

  it('asks for a Node that strips types without a flag', () => {
    const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as Engines;
    expect(pkg.engines.node).toBe('>=22.18');
  });
});
