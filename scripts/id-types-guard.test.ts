// The ID guard (PRD 1049, s6; ADR-0056): an identifier is parsed into its brand from
// `kit/lib/ids.ts` where it enters, and never declared bare. A parameter, a property (an interface
// or type-literal member, a class field) or a variable named like an ID whose declared type is a
// bare `number` or `string`, alone, together, or with `null` or `undefined`, fails here; so does a
// zod object field of such a name whose schema is a plain `z.number()` or `z.string()` chain that
// never reaches a brand. Source files only, chosen as the no-`as` guard chooses them: tests and
// generated files are exempt. No allowlist, no comment escape: a name that holds something else
// than its ID is renamed after what it holds. The rules are proven on fixtures first, then the
// guard runs on every file git tracks.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

const found = (path: string, text: string): string[] => findViolations([{ path, text }]).map((v) => `${v.line} ${v.name}`);

describe('the ID guard, on fixtures', () => {
  it('refuses a parameter, a property and a variable declared bare, naming the file, line and name', () => {
    expect(findViolations([{ path: 'kit/lib/a.ts', text: 'export const a = 1;\nexport function f(prd: number) { return prd; }\n' }])).toEqual([
      { path: 'kit/lib/a.ts', line: 2, name: 'prd', text: 'export function f(prd: number) { return prd; }' },
    ]);
    expect(found('kit/lib/a.ts', 'export interface A { slice: string }\n')).toEqual(['1 slice']);
    expect(found('kit/lib/a.ts', 'export type A = { readonly prNumber?: number };\n')).toEqual(['1 prNumber']);
    expect(found('kit/lib/a.ts', 'export class A { issue: number = 1; }\n')).toEqual(['1 issue']);
    expect(found('kit/lib/a.ts', 'export let commentId: number = 1;\n')).toEqual(['1 commentId']);
    expect(found('apps/galaxy/src/a.tsx', 'export const A = ({ sliceId }: { sliceId: string }) => <p>{sliceId}</p>;\n')).toEqual(['1 sliceId']);
  });

  it('refuses every name on the list', () => {
    for (const name of ['prd', 'prdNumber', 'pr', 'prNumber', 'issue', 'issueNumber', 'commentId', 'slice', 'sliceId', 'itemId', 'outboxItemId']) {
      expect(found('kit/lib/a.ts', `export type A = { ${name}: number };\n`)).toEqual([`1 ${name}`]);
    }
  });

  it('refuses number | string, and a bare type with null or undefined beside it', () => {
    expect(found('kit/lib/a.ts', 'export function f(prd: number | string) {}\n')).toEqual(['1 prd']);
    expect(found('kit/lib/a.ts', 'export type A = { pr: number | null };\n')).toEqual(['1 pr']);
    expect(found('kit/lib/a.ts', 'export type A = { itemId: string | undefined };\n')).toEqual(['1 itemId']);
    expect(found('kit/lib/a.ts', 'export type A = { slice: (string | null) };\n')).toEqual(['1 slice']);
  });

  it('refuses a zod field whose schema is a plain number or string chain', () => {
    expect(found('kit/lib/a.ts', "import { z } from 'zod';\nexport const S = z.object({ pr: z.number() });\n")).toEqual(['2 pr']);
    expect(found('kit/lib/a.ts', "import { z } from 'zod';\nexport const S = z.object({ prd: z.number().int().positive().nullable() });\n")).toEqual(['2 prd']);
    expect(found('kit/lib/a.ts', "import { z } from 'zod';\nexport const S = z.object({ 'slice': z.string().regex(/^s\\d+$/) });\n")).toEqual(['2 slice']);
    expect(found('kit/lib/a.ts', "import { z } from 'zod';\nexport const S = z.object({ issue: z.coerce.number() });\n")).toEqual(['2 issue']);
  });

  it('passes the branded forms', () => {
    const text = [
      "import { z } from 'zod';",
      "import { PrNumberSchema, PrdNumberSchema, type PrdNumber, type SliceId } from '../ids.ts';",
      'export function f(prd: PrdNumber) { return prd; }',
      'export interface A { slice: SliceId; prd?: PrdNumber | null }',
      'export const S = z.object({ pr: PrNumberSchema, prd: PrdNumberSchema.nullable() });',
      "export const T = z.object({ prd: z.number().int().positive().brand<'PrdNumber'>() });",
      'export const U = z.object({ prd: z.string().transform(Number).pipe(PrdNumberSchema) });',
      '',
    ].join('\n');
    expect(found('kit/lib/a.ts', text)).toEqual([]);
  });

  it('passes a field named number, a name off the list, and a declaration with no type written', () => {
    const text = [
      "import { z } from 'zod';",
      'export type A = { number: number; prds: number[]; sliceBranch: string };',
      'export const S = z.object({ number: z.number() });',
      'export const prd = Number("1");',
      'export function f(slice = "s1") { return slice; }',
      '',
    ].join('\n');
    expect(found('kit/lib/a.ts', text)).toEqual([]);
  });

  it('lets a test and a generated file declare IDs bare', () => {
    expect(found('kit/lib/a.test.ts', 'const prd: number = 1;\n')).toEqual([]);
    expect(found('apps/omni-app/test/scenario.ts', 'export const pr: number = 1;\n')).toEqual([]);
    expect(found('supabase/database.types.ts', 'export type Row = { prd: number };\n')).toEqual([]);
    expect(found('kit/lib/a.md', 'const prd: number = 1;\n')).toEqual([]);
  });

  it('reads no comment as an escape', () => {
    expect(found('kit/lib/a.ts', '// id-guard-allow: it holds a label\nexport type A = { prd: string }; // allow\n')).toEqual(['2 prd']);
  });
});

describe('the ID guard, on the whole repository', () => {
  it('finds no ID declared bare in any source file git tracks', () => {
    const paths = execFileSync('git', ['ls-files', '-z'], { cwd: repoRoot, encoding: 'utf8' }).split('\0').filter(Boolean);
    const files = paths.filter(isSource).map((path) => ({ path, text: readFileSync(join(repoRoot, path), 'utf8') }));
    expect(files.length).toBeGreaterThan(500);
    expect(findViolations(files).map((v) => `${v.path}:${v.line} ${v.name}: ${v.text.trim()}`)).toEqual([]);
  });
});

type Violation = { path: string; line: number; name: string; text: string };
type File = { path: string; text: string };

/** The names an ID goes by: one of them declared bare is a mistake waiting to compile. */
const ID_NAMES: ReadonlySet<string> = new Set([
  'prd',
  'prdNumber',
  'pr',
  'prNumber',
  'issue',
  'issueNumber',
  'commentId',
  'slice',
  'sliceId',
  'itemId',
  'outboxItemId',
]);

/** Files no person writes. */
const GENERATED = [/^supabase\/database\.types\.ts$/];

/** A test, or a file in a `test/` folder that serves tests only. */
const TEST = [/\.(?:test|spec)\.[cm]?tsx?$/, /(?:^|\/)test\//];

const TYPESCRIPT = /\.(?:[cm]?ts|tsx)$/;

/** Whether a file is source the guard reads: TypeScript, not a test, not generated (as the no-`as` guard chooses). */
function isSource(path: string): boolean {
  return TYPESCRIPT.test(path) && !TEST.some((p) => p.test(path)) && !GENERATED.some((p) => p.test(path));
}

function findViolations(files: readonly File[]): Violation[] {
  return files.filter((file) => isSource(file.path)).flatMap(fileViolations);
}

function fileViolations(file: File): Violation[] {
  const kind = file.path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(file.path, file.text, ts.ScriptTarget.Latest, true, kind);
  const lines = file.text.split('\n');
  const out: Violation[] = [];
  const flag = (node: ts.Node, name: string): void => {
    const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
    out.push({ path: file.path, line, name, text: lines[line - 1] ?? '' });
  };
  const visit = (node: ts.Node): void => {
    const name = bareIdName(node);
    if (name !== undefined) flag(node, name);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return out;
}

/** A declaration that holds a value and may carry a type. */
type Declared = ts.ParameterDeclaration | ts.PropertySignature | ts.PropertyDeclaration | ts.VariableDeclaration;

function isDeclared(node: ts.Node): node is Declared {
  return ts.isParameter(node) || ts.isPropertySignature(node) || ts.isPropertyDeclaration(node) || ts.isVariableDeclaration(node);
}

/** The ID name `node` declares bare: a bare type written on it, or a plain zod chain assigned to it. */
function bareIdName(node: ts.Node): string | undefined {
  if (isDeclared(node)) return node.type !== undefined && isBare(node.type) ? idName(node.name) : undefined;
  if (ts.isPropertyAssignment(node)) return isPlainZodChain(node.initializer) ? idName(node.name) : undefined;
  return undefined;
}

/** The declared name when it is one an ID goes by: an identifier or a quoted key. */
function idName(name: ts.Node): string | undefined {
  const text = ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : undefined;
  return text !== undefined && ID_NAMES.has(text) ? text : undefined;
}

/**
 * A bare type: `number`, `string`, or a union of them, with `null` or `undefined` beside them or not.
 * `number | null` is still a bare number that may be absent, so it is bare.
 */
function isBare(type: ts.TypeNode): boolean {
  const members = unionMembers(type);
  const bare = members.filter((t) => t.kind === ts.SyntaxKind.NumberKeyword || t.kind === ts.SyntaxKind.StringKeyword);
  const absent = members.filter(
    (t) => t.kind === ts.SyntaxKind.UndefinedKeyword || (ts.isLiteralTypeNode(t) && t.literal.kind === ts.SyntaxKind.NullKeyword),
  );
  return bare.length > 0 && bare.length + absent.length === members.length;
}

function unionMembers(type: ts.TypeNode): ts.TypeNode[] {
  if (ts.isParenthesizedTypeNode(type)) return unionMembers(type.type);
  if (ts.isUnionTypeNode(type)) return type.types.flatMap(unionMembers);
  return [type];
}

/** The methods that make a chain's output something else than the number or string it read. */
const RETYPING = new Set(['brand', 'pipe', 'transform']);

/**
 * A plain `z.number()…` or `z.string()…` chain (`z.coerce.` included) that never calls `brand`,
 * `pipe` or `transform`: a schema whose output is a bare number or string.
 */
function isPlainZodChain(expression: ts.Expression): boolean {
  let node: ts.Expression = expression;
  for (;;) {
    if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return false;
    const access = node.expression;
    const method = access.name.text;
    if (RETYPING.has(method)) return false;
    if ((method === 'number' || method === 'string') && isZod(access.expression)) return true;
    node = access.expression;
  }
}

/** `z`, or `z.coerce`. */
function isZod(expression: ts.Expression): boolean {
  if (ts.isIdentifier(expression)) return expression.text === 'z';
  return ts.isPropertyAccessExpression(expression) && expression.name.text === 'coerce' && isZod(expression.expression);
}
