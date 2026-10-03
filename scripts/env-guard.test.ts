// The environment guard (PRD 1059, s4; ADR-0057): the environment is read through the runtime's env
// module, as feature groups, and nowhere else. Any access to `process.env` in a source file's syntax
// tree fails here, naming the file and line: a member read (`process.env.X`), an index
// (`process.env[name]`), a spread (`{ ...process.env }`), the object passed or assigned as a value
// (`f(process.env)`, `const env = process.env`), `env` taken out of `process` by destructuring or
// imported from `node:process`. Only the env modules below may. Text is not code: a string or a
// comment that spells `process.env` (a generated shell script, a bundler's `define` key) is not a
// read. Source files only, chosen as the ID guard chooses them: tests and generated files are
// exempt. No allowlist beyond the env modules, no comment escape. The rules are proven on fixtures
// first, then the guard runs on every file git tracks.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

const found = (path: string, text: string): string[] => findViolations([{ path, text }]).map((v) => `${v.path}:${v.line}`);

describe('the environment guard, on fixtures', () => {
  it('refuses a member read, naming the file, the line and the code', () => {
    expect(findViolations([{ path: 'kit/lib/a.ts', text: 'export const a = 1;\nexport const key = process.env.OPENROUTER_API_KEY;\n' }])).toEqual([
      { path: 'kit/lib/a.ts', line: 2, text: 'export const key = process.env.OPENROUTER_API_KEY;' },
    ]);
  });

  it('refuses an index, a spread, the object passed on and the object assigned', () => {
    expect(found('kit/lib/a.ts', 'export const read = (name: string) => process.env[name];\n')).toEqual(['kit/lib/a.ts:1']);
    expect(found('game/a.ts', 'export const child = { ...process.env, GH_TOKEN: "t" };\n')).toEqual(['game/a.ts:1']);
    expect(found('scripts/a.ts', 'declare function f(env: object): void;\nf(process.env);\n')).toEqual(['scripts/a.ts:2']);
    expect(found('apps/omni-app/src/a.ts', 'export const env = process.env;\n')).toEqual(['apps/omni-app/src/a.ts:1']);
    expect(found('apps/galaxy/src/a.tsx', 'export const A = () => <p>{process.env.NEXT_PUBLIC_SUPABASE_URL}</p>;\n')).toEqual(['apps/galaxy/src/a.tsx:1']);
  });

  it('refuses the other ways to reach it: a quoted key, globalThis, destructuring and an import', () => {
    expect(found('kit/lib/a.ts', "export const e = process['env'];\n")).toEqual(['kit/lib/a.ts:1']);
    expect(found('kit/lib/a.ts', 'export const e = globalThis.process.env.HOME;\n')).toEqual(['kit/lib/a.ts:1']);
    expect(found('kit/lib/a.ts', 'const { env } = process;\nexport const home = env.HOME;\n')).toEqual(['kit/lib/a.ts:1']);
    expect(found('kit/lib/a.ts', "import { env } from 'node:process';\nexport const home = env.HOME;\n")).toEqual(['kit/lib/a.ts:1']);
    expect(found('kit/lib/a.ts', "import { env as e } from 'process';\nexport const home = e.HOME;\n")).toEqual(['kit/lib/a.ts:1']);
  });

  it('flags every access, one per line it is on', () => {
    expect(found('kit/lib/a.ts', 'export const a = process.env.A;\nexport const b = [process.env.B, process.env.C];\n')).toEqual([
      'kit/lib/a.ts:1',
      'kit/lib/a.ts:2',
      'kit/lib/a.ts:2',
    ]);
  });

  it('lets the env modules read it', () => {
    const read = 'export const processEnv = () => process.env;\nexport const runtime = () => process.env.NEXT_RUNTIME;\n';
    for (const path of ENV_MODULES) expect(found(path, read)).toEqual([]);
    expect(found('apps/galaxy/src/env.client.ts', 'export const url = process.env.NEXT_PUBLIC_SUPABASE_URL;\n')).toEqual([]);
  });

  it('reads text as text: a string, a template, a comment and a bundler define key are not reads', () => {
    const text = [
      '// process.env.FOO is read by the env module',
      "export const script = `appendFileSync(process.env.FAKE_GH_LOG, args.join(' '))`;",
      "export const config = { define: { 'process.env.NODE_ENV': '\"production\"' } };",
      "export const said = 'process.env[name]';",
      'export const other = { env: 1 }.env;',
      'export const proc = { process: 1 }.process;',
      '',
    ].join('\n');
    expect(found('kit/lib/a.ts', text)).toEqual([]);
  });

  it('lets a test and a generated file read it', () => {
    expect(found('kit/lib/a.test.ts', 'const key = process.env.KEY;\n')).toEqual([]);
    expect(found('apps/omni-app/test/scenario.ts', 'export const golden = process.env.UPDATE_GOLDEN;\n')).toEqual([]);
    expect(found('supabase/database.types.ts', 'export const x = process.env.X;\n')).toEqual([]);
    expect(found('kit/lib/a.md', 'process.env.X\n')).toEqual([]);
  });

  it('reads no comment as an escape, and no other module named env as an env module', () => {
    expect(found('kit/lib/a.ts', '// env-guard-allow\nexport const a = process.env.A; // allow\n')).toEqual(['kit/lib/a.ts:2']);
    expect(found('kit/lib/env/group.ts', 'export const a = process.env.A;\n')).toEqual(['kit/lib/env/group.ts:1']);
    expect(found('apps/other/src/env.ts', 'export const a = process.env.A;\n')).toEqual(['apps/other/src/env.ts:1']);
  });
});

describe('the environment guard, on the whole repository', () => {
  it('finds no process.env outside the env modules in any source file git tracks', () => {
    const paths = execFileSync('git', ['ls-files', '-z'], { cwd: repoRoot, encoding: 'utf8' }).split('\0').filter(Boolean);
    const files = paths.filter(isSource).map((path) => ({ path, text: readFileSync(join(repoRoot, path), 'utf8') }));
    expect(files.length).toBeGreaterThan(500);
    expect(findViolations(files).map((v) => `${v.path}:${v.line}: ${v.text.trim()}`)).toEqual([]);
  });

  it('names env modules that exist', () => {
    const paths = new Set(execFileSync('git', ['ls-files', '-z', ...ENV_MODULES], { cwd: repoRoot, encoding: 'utf8' }).split('\0').filter(Boolean));
    expect(ENV_MODULES.filter((path) => !paths.has(path))).toEqual([]);
  });
});

type Violation = { path: string; line: number; text: string };
type File = { path: string; text: string };

/** The env modules, one per runtime (ADR-0057): the only source files that read `process.env`. */
const ENV_MODULES: readonly string[] = [
  // The kit, the game and the scripts.
  'kit/lib/env/read.ts',
  // The GitHub App.
  'apps/omni-app/src/env.ts',
  // The arcade, on the server.
  'apps/galaxy/src/env.ts',
  // The arcade, in the browser: literal `process.env.NEXT_PUBLIC_*` reads, which Next inlines at build.
  'apps/galaxy/src/env.client.ts',
];

/** Files no person writes. */
const GENERATED = [/^supabase\/database\.types\.ts$/];

/** A test, or a file in a `test/` folder that serves tests only. */
const TEST = [/\.(?:test|spec)\.[cm]?tsx?$/, /(?:^|\/)test\//];

const TYPESCRIPT = /\.(?:[cm]?ts|tsx)$/;

/** Whether a file is source the guard reads: TypeScript, not a test, not generated (as the ID guard chooses). */
function isSource(path: string): boolean {
  return TYPESCRIPT.test(path) && !TEST.some((p) => p.test(path)) && !GENERATED.some((p) => p.test(path));
}

function findViolations(files: readonly File[]): Violation[] {
  return files.filter((file) => isSource(file.path) && !ENV_MODULES.includes(file.path)).flatMap(fileViolations);
}

function fileViolations(file: File): Violation[] {
  const kind = file.path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(file.path, file.text, ts.ScriptTarget.Latest, true, kind);
  const lines = file.text.split('\n');
  const out: Violation[] = [];
  const visit = (node: ts.Node): void => {
    if (readsEnv(node)) {
      const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
      out.push({ path: file.path, line, text: lines[line - 1] ?? '' });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return out;
}

/** The modules `env` can be imported from. */
const PROCESS_MODULES = new Set(['process', 'node:process']);

/**
 * Whether `node` reaches the process's environment: `process.env` or `process['env']` (on `process`
 * or `globalThis.process`), `{ env } = process`, or `env` imported from `node:process`. Every read,
 * index, spread or pass of the object goes through one of these.
 */
function readsEnv(node: ts.Node): boolean {
  if (ts.isPropertyAccessExpression(node)) return node.name.text === 'env' && isProcess(node.expression);
  if (ts.isElementAccessExpression(node)) {
    return ts.isStringLiteralLike(node.argumentExpression) && node.argumentExpression.text === 'env' && isProcess(node.expression);
  }
  if (ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name)) {
    return node.initializer !== undefined && isProcess(node.initializer) && node.name.elements.some(bindsEnv);
  }
  if (ts.isImportSpecifier(node)) {
    const imported = (node.propertyName ?? node.name).text;
    const from = node.parent.parent.parent.moduleSpecifier;
    return imported === 'env' && ts.isStringLiteral(from) && PROCESS_MODULES.has(from.text);
  }
  return false;
}

/** `process`, or `globalThis.process`. */
function isProcess(expression: ts.Expression): boolean {
  if (ts.isIdentifier(expression)) return expression.text === 'process';
  return ts.isPropertyAccessExpression(expression) && expression.name.text === 'process' && ts.isIdentifier(expression.expression) && expression.expression.text === 'globalThis';
}

/** A binding element that takes `env` out of the object. */
function bindsEnv(element: ts.BindingElement): boolean {
  const key = element.propertyName ?? element.name;
  return (ts.isIdentifier(key) || ts.isStringLiteral(key)) && key.text === 'env';
}
