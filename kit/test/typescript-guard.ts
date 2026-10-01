// The ratchet's rules (PRD 725, s29), as a pure function over files, so the guard test can prove
// each rule on fixtures before it runs them on the repository.
//
// - `ts-nocheck`: a comment line that opens with the `@ts-nocheck` directive, in any TypeScript file.
// - `javascript`: a JavaScript source file, outside the bundle, the shim and the rename script.
// - `any` / `as`: an `any` type, an `as` cast or an angle-bracket cast, in source (not a test), on
//   a line with no `// ts-allow: <reason>` comment. `as const` is no cast, nor is an import or an
//   export alias, nor a non-null assertion (settled item s24-02).
// - `empty-reason`: a `// ts-allow:` comment that gives no reason.
import ts from 'typescript';

export type Rule = 'ts-nocheck' | 'javascript' | 'any' | 'as' | 'empty-reason';
export type Violation = { path: string; line: number; rule: Rule; text: string };
export type File = { path: string; text: string };

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
export const ARCADE_UNMARKED = [
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

export function findViolations(files: readonly File[]): Violation[] {
  const out: Violation[] = [];
  for (const file of files) {
    const lines = file.text.split('\n');
    const at = (line: number, rule: Rule): Violation => ({ path: file.path, line, rule, text: lines[line - 1] ?? '' });
    if (JAVASCRIPT.test(file.path)) {
      if (!JAVASCRIPT_KEPT.some((kept) => kept.test(file.path))) out.push(at(1, 'javascript'));
      continue;
    }
    if (!TYPESCRIPT.test(file.path)) continue;
    lines.forEach((line, index) => {
      if (NOCHECK.test(line)) out.push(at(index + 1, 'ts-nocheck'));
    });
    if (TEST.some((test) => test.test(file.path)) || GENERATED.some((generated) => generated.test(file.path))) continue;
    if (ARCADE_UNMARKED.some((folder) => file.path.startsWith(folder))) continue;
    for (const { line, rule } of escapes(file)) {
      const allow = ALLOW.exec(lines[line - 1] ?? '');
      if (!allow) out.push(at(line, rule));
      else if (!allow[1]?.trim()) out.push(at(line, 'empty-reason'));
    }
  }
  return out;
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
