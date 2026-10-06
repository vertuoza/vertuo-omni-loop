// The guard (PRD 725, s29; PRD 1030): what would bring the old state back fails here. A file that
// opens with `@ts-nocheck`, a JavaScript source file, an `eslint-disable` comment, and an `any`, an
// `as` cast or an angle-bracket cast in source, in every folder. No comment lets a cast or an `any`
// through: PRD 942's `ts-allow` comment and its per-area ceilings are gone (PRD 1030), since source
// parses outside data at the boundary instead (ADR-0054). The rules are proven on fixtures first,
// then the guard runs on every file git tracks, dot folders included.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

// The rules:
//
// - `ts-nocheck`: a comment line that opens with the `@ts-nocheck` directive, in any TypeScript file.
// - `javascript`: a JavaScript source file, outside the bundle, the shim and the rename script.
// - `any` / `as`: an `any` type, an `as` cast or an angle-bracket cast, in source (not a test),
//   whatever comment its line carries. `as const` is no cast, nor is an import or an export alias,
//   nor a non-null assertion (settled item s24-02).
// - `eslint-disable`: an `eslint-disable` comment, in any TypeScript file (PRD 976): the linter's
//   `noInlineConfig` makes one inert, and every finding is fixed in code instead.

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

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
    expect(rules('apps/omni-app/api/github.mjs', 'export const a = 1;\n')).toEqual([]);
    expect(rules('.omni-loop/bin/omni.mjs', 'export const a = 1;\n')).toEqual([]);
    expect(rules('scripts/ts-rename.mjs', 'export const a = 1;\n')).toEqual([]);
  });

  it('refuses an any, an as cast and an angle-bracket cast in source, naming the line', () => {
    expect(one('kit/lib/a.ts', 'export const a = 1;\nexport function f(x: any) { return x; }\n')).toEqual([
      { path: 'kit/lib/a.ts', line: 2, rule: 'any', text: 'export function f(x: any) { return x; }' },
    ]);
    expect(rules('kit/lib/a.ts', 'export const n = JSON.parse("1") as number;\n')).toEqual(['as']);
    expect(rules('kit/lib/a.ts', 'export const n = <number>JSON.parse("1");\n')).toEqual(['as']);
    expect(rules('apps/omni-app/src/a.ts', 'export const xs: Array<any> = [];\n')).toEqual(['any']);
  });

  it('refuses them whatever comment the line carries: no comment lets one through (PRD 1030)', () => {
    expect(rules('kit/lib/a.ts', 'export const n = JSON.parse("1") as number; // ts-allow: JSON.parse returns any\n')).toEqual(['as']);
    expect(rules('kit/lib/a.ts', 'export const n = <number>JSON.parse("1"); // ts-allow: JSON.parse returns any\n')).toEqual(['as']);
    expect(rules('kit/lib/a.ts', 'export function f(x: any) { return x; } // ts-allow: the caller passes anything\n')).toEqual(['any']);
    expect(rules('kit/lib/a.ts', 'export const n = JSON.parse("1") as number; // ts-allow:\n')).toEqual(['as']);
    expect(rules('apps/galaxy/src/a.ts', '// ts-allow: the next line\nexport const x = JSON.parse("1") as number; /* trust me */\n')).toEqual(['as']);
  });

  it('marks a cast on the line of its type, when the expression spans lines', () => {
    const text = 'export const n = JSON.parse(\n  "1",\n) as number;\n';
    expect(one('kit/lib/a.ts', text)).toEqual([{ path: 'kit/lib/a.ts', line: 3, rule: 'as', text: ') as number;' }]);
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
    expect(rules('kit/lib/a.test.ts', 'const x: any = {};\nconst y = x as number;\nconst z = <number>x;\n')).toEqual([]);
    expect(rules('apps/galaxy/src/a.test.tsx', 'const x: any = {};\n')).toEqual([]);
    expect(rules('apps/omni-app/test/scenario.ts', 'export const x: any = {};\n')).toEqual([]);
  });

  it("reads casts in every folder, the arcade's included", () => {
    expect(rules('apps/galaxy/src/jev/store.ts', 'export const x = JSON.parse("1") as number;\n')).toEqual(['as']);
    expect(rules('apps/galaxy/proxy.ts', 'export const x: any = 1;\n')).toEqual(['any']);
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

  it('refuses an eslint-disable comment of any form, in source and tests, naming the line', () => {
    const text = 'export const a = 1;\n  // eslint-disable-next-line react-hooks/exhaustive-deps\nexport const b = 2;\n';
    expect(one('apps/galaxy/src/arcade/A.tsx', text)).toEqual([
      { path: 'apps/galaxy/src/arcade/A.tsx', line: 2, rule: 'eslint-disable', text: '  // eslint-disable-next-line react-hooks/exhaustive-deps' },
    ]);
    expect(rules('kit/lib/a.test.ts', '/* eslint-disable */\nexport const a = 1;\n')).toEqual(['eslint-disable']);
    expect(rules('kit/lib/a.ts', 'export const a = f(); // eslint-disable-line\n')).toEqual(['eslint-disable']);
    expect(rules('kit/lib/a.ts', 'export const a = 1;\n/*\n * eslint-disable\n */\n')).toEqual(['eslint-disable']);
    expect(rules('apps/galaxy/src/A.tsx', 'export const A = () => <div>{/* eslint-disable-line */}</div>;\n')).toEqual(['eslint-disable']);
  });

  it('lets a file name eslint-disable in a string or a sentence, and leaves the bundle alone', () => {
    expect(rules('kit/lib/a.ts', "// the guard refuses an eslint-disable comment\nexport const s = '// eslint-disable';\n")).toEqual([]);
    expect(rules('kit/dist/omni.mjs', '// eslint-disable-next-line no-x\nexport const a = 1;\n')).toEqual([]);
  });
});

describe('the guard, on the whole repository', () => {
  const tracked = (): File[] => {
    const paths = execFileSync('git', ['ls-files', '-z'], { cwd: repoRoot, encoding: 'utf8' }).split('\0').filter(Boolean);
    return paths.filter(isCode).map((path) => ({ path, text: readFileSync(join(repoRoot, path), 'utf8') }));
  };

  it('finds nothing in any file git tracks', () => {
    const files = tracked();
    expect(files.length).toBeGreaterThan(500);
    expect(findViolations(files).map((v) => `${v.path}:${v.line} ${v.rule}: ${v.text.trim()}`)).toEqual([]);
  });

  it('keeps no ceilings file: there is nothing left to count (PRD 1030)', () => {
    expect(existsSync(join(repoRoot, 'scripts/typescript-ceilings.json'))).toBe(false);
  });
});

function isCode(path: string): boolean {
  return /\.(?:[cm]?[jt]sx?)$/.test(path);
}

type Rule = 'ts-nocheck' | 'javascript' | 'any' | 'as' | 'eslint-disable';
type Violation = { path: string; line: number; rule: Rule; text: string };
type File = { path: string; text: string };

/** The JavaScript files that stay: the bundle, this repository's shim onto the source, and the rename. */
const JAVASCRIPT_KEPT = [/^kit\/dist\//, /^apps\/omni-app\/api\//, /^\.omni-loop\/bin\//, /^scripts\/ts-rename\.mjs$/];

/** Files no person writes: their casts are the generator's. */
const GENERATED = [/^supabase\/database\.types\.ts$/];

/** A test, or a file in a `test/` folder that serves tests only: it may cast its fixtures freely. */
const TEST = [/\.(?:test|spec)\.[cm]?tsx?$/, /(?:^|\/)test\//];

const JAVASCRIPT = /\.(?:[cm]?js|jsx)$/;
const TYPESCRIPT = /\.(?:[cm]?ts|tsx)$/;
const NOCHECK = /^\s*(?:\/\/+|\/\*+|\*)\s*@ts-nocheck\b/;

const matchesAny = (patterns: readonly RegExp[], path: string): boolean => patterns.some((pattern) => pattern.test(path));

/** Whether a file is source whose `any` and casts are read: TypeScript, not a test, not generated. */
function isSource(path: string): boolean {
  return TYPESCRIPT.test(path) && !matchesAny(TEST, path) && !matchesAny(GENERATED, path);
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
  for (const line of eslintDisables(file)) out.push(at(line, 'eslint-disable'));
  if (!isSource(file.path)) return out;
  for (const { line, rule } of escapes(file)) out.push(at(line, rule));
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

/** A comment line that is an `eslint-disable` directive: the directive opens it, not a sentence. */
const ESLINT_DISABLE = /^\s*(?:\/\/+|\/\*+|\*)?\s*eslint-disable/;

/**
 * The lines of a file's `eslint-disable` comments (PRD 976): every comment the parser sees, before
 * or after any token, read line by line. A string that holds the words is no comment.
 */
function eslintDisables(file: File): number[] {
  const kind = file.path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(file.path, file.text, ts.ScriptTarget.Latest, true, kind);
  const seen = new Set<number>();
  const lines = new Set<number>();
  const read = (ranges: ts.CommentRange[] | undefined): void => {
    for (const range of ranges ?? []) {
      if (seen.has(range.pos)) continue;
      seen.add(range.pos);
      const first = source.getLineAndCharacterOfPosition(range.pos).line + 1;
      file.text.slice(range.pos, range.end).split('\n').forEach((line, index) => {
        if (ESLINT_DISABLE.test(line)) lines.add(first + index);
      });
    }
  };
  const visit = (node: ts.Node): void => {
    read(ts.getLeadingCommentRanges(file.text, node.pos));
    read(ts.getTrailingCommentRanges(file.text, node.end));
    for (const child of node.getChildren(source)) visit(child);
  };
  visit(source);
  return [...lines].sort((a, b) => a - b);
}

function isConst(type: ts.TypeNode): boolean {
  return ts.isTypeReferenceNode(type) && ts.isIdentifier(type.typeName) && type.typeName.text === 'const';
}
