// The ratchet's guard (PRD 725, s29): what would bring the old state back fails here. A file that
// opens with `@ts-nocheck`, a JavaScript source file, and an `any` or an `as` in source on a line
// with no `// ts-allow: <reason>` comment (or one with no reason). The rules are proven on fixtures
// first, then the guard runs on every file git tracks, dot folders included.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

// The rules:
//
// - `ts-nocheck`: a comment line that opens with the `@ts-nocheck` directive, in any TypeScript file.
// - `javascript`: a JavaScript source file, outside the bundle, the shim and the rename script.
// - `any` / `as`: an `any` type, an `as` cast or an angle-bracket cast, in source (not a test), on
//   a line with no `// ts-allow: <reason>` comment. `as const` is no cast, nor is an import or an
//   export alias, nor a non-null assertion (settled item s24-02).
// - `empty-reason`: a `// ts-allow:` comment that gives no reason.

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

type Rule = 'ts-nocheck' | 'javascript' | 'any' | 'as' | 'empty-reason';
type Violation = { path: string; line: number; rule: Rule; text: string };
type File = { path: string; text: string };

/** The JavaScript files that stay: the bundle, this repository's shim onto the source, and the rename. */
const JAVASCRIPT_KEPT = [/^kit\/dist\//, /^\.omni-loop\/bin\//, /^scripts\/ts-rename\.mjs$/];

/** Files no person writes: their casts are the generator's. */
const GENERATED = [/^supabase\/database\.types\.ts$/];

/** A test, or a file in a `test/` folder that serves tests only: it may cast its fixtures freely. */
const TEST = [/\.(?:test|spec)\.[cm]?tsx?$/, /(?:^|\/)test\//];

/**
 * The arcade folders whose slices left their casts as they were (settled items s25-01 and
 * s27-01 of PRD 725): `any` and `as` are not read there until each is marked. The other rules
 * still hold. Strike a folder from this list once its casts carry their reasons.
 */
const ARCADE_UNMARKED = [
  // s25
  'apps/galaxy/src/ask/',
  'apps/galaxy/src/dashboard/',
  'apps/galaxy/src/profile/',
  'apps/galaxy/src/signup/',
  'apps/galaxy/src/proxy/',
  'apps/galaxy/proxy.ts',
  'apps/galaxy/src/working/',
  // s27
  'apps/galaxy/src/business/',
  'apps/galaxy/src/business-api/',
  'apps/galaxy/src/jev/',
  'apps/galaxy/src/proof/',
  'apps/galaxy/src/engineering/',
  'apps/galaxy/src/repositories/',
];

const JAVASCRIPT = /\.(?:[cm]?js|jsx)$/;
const TYPESCRIPT = /\.(?:[cm]?ts|tsx)$/;
const NOCHECK = /^\s*(?:\/\/+|\/\*+|\*)\s*@ts-nocheck\b/;
const ALLOW = /\/\/\s*ts-allow:(.*)$/;

const matchesAny = (patterns: readonly RegExp[], path: string): boolean => patterns.some((pattern) => pattern.test(path));

/** Whether a file's `any` and casts are read: not in a test, a generated file or an unmarked arcade folder. */
function escapesRead(path: string): boolean {
  if (matchesAny(TEST, path) || matchesAny(GENERATED, path)) return false;
  return !ARCADE_UNMARKED.some((folder) => path.startsWith(folder));
}

/** The rule an `any` or a cast on line `text` breaks: its own without a reason, none with one. */
function escapeRule(rule: 'any' | 'as', text: string): Rule | null {
  const allow = ALLOW.exec(text);
  if (!allow) return rule;
  return allow[1]?.trim() ? null : 'empty-reason';
}

function fileViolations(file: File): Violation[] {
  const lines = file.text.split('\n');
  const at = (line: number, rule: Rule): Violation => ({ path: file.path, line, rule, text: lines[line - 1] ?? '' });
  if (JAVASCRIPT.test(file.path)) return matchesAny(JAVASCRIPT_KEPT, file.path) ? [] : [at(1, 'javascript')];
  if (!TYPESCRIPT.test(file.path)) return [];
  const out: Violation[] = [];
  lines.forEach((line, index) => {
    if (NOCHECK.test(line)) out.push(at(index + 1, 'ts-nocheck'));
  });
  if (!escapesRead(file.path)) return out;
  for (const { line, rule } of escapes(file)) {
    const broken = escapeRule(rule, lines[line - 1] ?? '');
    if (broken) out.push(at(line, broken));
  }
  return out;
}

function findViolations(files: readonly File[]): Violation[] {
  return files.flatMap(fileViolations);
}

/** Every `any` and every cast in a file, with the line it reads on: a cast's is its type's. */
function escapes(file: File): Array<{ line: number; rule: 'any' | 'as' }> {
  const kind = file.path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(file.path, file.text, ts.ScriptTarget.Latest, true, kind);
  const lineOf = (node: ts.Node) => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
  const found: Array<{ line: number; rule: 'any' | 'as' }> = [];
  const visit = (node: ts.Node): void => {
    if (node.kind === ts.SyntaxKind.AnyKeyword) found.push({ line: lineOf(node), rule: 'any' });
    if ((ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) && !isConst(node.type)) {
      found.push({ line: lineOf(node.type), rule: 'as' });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

function isConst(type: ts.TypeNode): boolean {
  return ts.isTypeReferenceNode(type) && ts.isIdentifier(type.typeName) && type.typeName.text === 'const';
}
