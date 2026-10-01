// The ratchet's guard (PRD 725, s29): what would bring the old state back fails here. A file that
// opens with `@ts-nocheck`, a JavaScript source file, and an `any` or an `as` in source on a line
// with no `// ts-allow: <reason>` comment (or one with no reason). The rules are proven on fixtures
// first, then the guard runs on every file git tracks, dot folders included.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ARCADE_UNMARKED, findViolations, type Violation } from './typescript-guard.ts';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

const one = (path: string, text: string): Violation[] => findViolations([{ path, text }]);
const rules = (path: string, text: string): string[] => one(path, text).map((v) => v.rule);

describe('the guard, on fixtures', () => {
  it('refuses a file that opens with @ts-nocheck, a test included, after a hashbang too', () => {
    expect(rules('kit/lib/a.ts', '// @ts-nocheck\nexport const a = 1;\n')).toEqual(['ts-nocheck']);
    expect(rules('kit/lib/a.test.ts', '// @ts-nocheck\nexport const a = 1;\n')).toEqual(['ts-nocheck']);
    expect(rules('kit/build.ts', '#!/usr/bin/env node\n// @ts-nocheck\nexport {};\n')).toEqual(['ts-nocheck']);
    expect(rules('kit/lib/a.ts', '/* @ts-nocheck */\nexport {};\n')).toEqual(['ts-nocheck']);
  });

  it('lets a file name @ts-nocheck inside a sentence or a string', () => {
    expect(rules('kit/lib/a.ts', "// the rename opens each file with `// @ts-nocheck`\nexport const s = '// @ts-nocheck';\n")).toEqual([]);
  });

  it('refuses a JavaScript source file, but not the bundle, the shim or the rename script', () => {
    expect(rules('kit/lib/a.mjs', 'export const a = 1;\n')).toEqual(['javascript']);
    expect(rules('game/b.js', 'export const a = 1;\n')).toEqual(['javascript']);
    expect(rules('kit/dist/omni.mjs', 'export const a = 1;\n')).toEqual([]);
    expect(rules('.omni-loop/bin/omni.mjs', 'export const a = 1;\n')).toEqual([]);
    expect(rules('scripts/ts-rename.mjs', 'export const a = 1;\n')).toEqual([]);
  });

  it('refuses an any and an as in source on a line with no ts-allow comment, naming the line', () => {
    expect(one('kit/lib/a.ts', 'export const a = 1;\nexport function f(x: any) { return x; }\n')).toEqual([
      { path: 'kit/lib/a.ts', line: 2, rule: 'any', text: 'export function f(x: any) { return x; }' },
    ]);
    expect(rules('kit/lib/a.ts', 'export const n = JSON.parse("1") as number;\n')).toEqual(['as']);
    expect(rules('kit/lib/a.ts', 'export const n = <number>JSON.parse("1");\n')).toEqual(['as']);
    expect(rules('apps/omni-app/src/a.ts', 'export const xs: Array<any> = [];\n')).toEqual(['any']);
  });

  it('refuses a ts-allow comment with no reason', () => {
    expect(rules('kit/lib/a.ts', 'export const n = JSON.parse("1") as number; // ts-allow:\n')).toEqual(['empty-reason']);
    expect(rules('kit/lib/a.ts', 'export const n = JSON.parse("1") as number; // ts-allow:   \n')).toEqual(['empty-reason']);
  });

  it('passes an any or an as on a line that gives its reason', () => {
    expect(rules('kit/lib/a.ts', 'export const n = JSON.parse("1") as number; // ts-allow: JSON.parse returns any\n')).toEqual([]);
    expect(rules('kit/lib/a.ts', 'export function f(x: any) { return x; } // ts-allow: the caller passes anything\n')).toEqual([]);
  });

  it('marks a cast on the line of its type, when the expression spans lines', () => {
    const text = 'export const n = JSON.parse(\n  "1",\n) as number; // ts-allow: JSON.parse returns any\n';
    expect(rules('kit/lib/a.ts', text)).toEqual([]);
  });

  it('lets through what is no escape hatch: as const, an import or export alias, a non-null assertion, words in strings', () => {
    const text = [
      "import { join as joinPath } from 'node:path';",
      "export * as path from 'node:path';",
      "export { joinPath as join };",
      'export const KINDS = Object.freeze([\'a\', \'b\'] as const);',
      'export const first = (xs: string[]) => xs[0]!;',
      "export const words = 'as any as it gets'; // any as",
      '',
    ].join('\n');
    expect(rules('kit/lib/a.ts', text)).toEqual([]);
  });

  it('lets a test cast its fixtures freely', () => {
    expect(rules('kit/lib/a.test.ts', 'const x: any = {};\nconst y = x as number;\n')).toEqual([]);
    expect(rules('apps/galaxy/src/a.test.tsx', 'const x: any = {};\n')).toEqual([]);
    expect(rules('apps/omni-app/test/scenario.ts', 'export const x: any = {};\n')).toEqual([]);
  });

  it('does not read casts in the arcade folders still unmarked, but holds them to the other rules', () => {
    expect(ARCADE_UNMARKED.length).toBeGreaterThan(0);
    expect(rules('apps/galaxy/src/jev/store.ts', 'export const x = JSON.parse("1") as number;\n')).toEqual([]);
    expect(rules('apps/galaxy/src/jev/store.ts', '// @ts-nocheck\nexport {};\n')).toEqual(['ts-nocheck']);
    expect(rules('apps/galaxy/src/outbox/send.ts', 'export const x = JSON.parse("1") as number;\n')).toEqual(['as']);
  });

  it('reads .tsx and .mts files as source too', () => {
    expect(rules('packages/design/src/a.tsx', 'export const A = (p: any) => <div>{p.x as string}</div>;\n')).toEqual(['any', 'as']);
    expect(rules('kit/lib/a.mts', 'export const a: any = 1;\n')).toEqual(['any']);
  });

  it('leaves the generated database types alone', () => {
    expect(rules('supabase/database.types.ts', 'export type Json = any;\nexport const Constants = { a: 1 } as const;\n')).toEqual([]);
  });

  it('leaves files that are not code alone', () => {
    expect(rules('kit/lib/a.md', '// @ts-nocheck\nconst a: any = 1;\n')).toEqual([]);
  });
});

describe('the guard, on the whole repository', () => {
  it('finds nothing in any file git tracks', () => {
    const paths = execFileSync('git', ['ls-files', '-z'], { cwd: repoRoot, encoding: 'utf8' }).split('\0').filter(Boolean);
    const files = paths.filter(isCode).map((path) => ({ path, text: readFileSync(join(repoRoot, path), 'utf8') }));
    expect(files.length).toBeGreaterThan(500);
    expect(findViolations(files).map((v) => `${v.path}:${v.line} ${v.rule}: ${v.text.trim()}`)).toEqual([]);
  });
});

function isCode(path: string): boolean {
  return /\.(?:[cm]?[jt]sx?)$/.test(path);
}
