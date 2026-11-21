import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

// A server component cannot hand a function to a client component: React refuses to serialise it, and
// the page fails to load ("A server error occurred") only in a real render, which no render test of the
// part catches. PRD omni-loop-20 s14 met it when the screenshot test first opened the PRD page's
// Specifications and Outbox tabs: each passed `link={Link}` to @omni/ui's SegmentedControl, a client part.
// This test reads every server file of the app and names each such prop.

const UI = new URL('../../../packages/ui/src/', import.meta.url);
const APP = new URL('./', import.meta.url);

const isClient = (source: string) => /^\s*['"]use client['"]/.test(source);

// The @omni/ui parts that are client components: a part's file is named after it.
function clientParts(): Set<string> {
  return new Set(
    readdirSync(UI)
      .filter((f) => f.endsWith('.tsx') && !f.includes('.test.'))
      .filter((f) => isClient(readFileSync(new URL(f, UI), 'utf8')))
      .map((f) => f.replace(/\.tsx$/, '')),
  );
}

function tsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : tsxFiles(path);
    return entry.name.endsWith('.tsx') && !entry.name.includes('.test.') ? [path] : [];
  });
}

// The named imports of one import statement from @omni/ui, else none.
function uiImports(statement: ts.Statement): readonly ts.ImportSpecifier[] {
  if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) return [];
  if (statement.moduleSpecifier.text !== '@omni/ui') return [];
  const bindings = statement.importClause?.namedBindings;
  return bindings && ts.isNamedImports(bindings) ? bindings.elements : [];
}

// The local names of the client parts one file imports from @omni/ui.
function clientImports(tree: ts.SourceFile, client: Set<string>): Set<string> {
  const specs = tree.statements.flatMap((statement) => uiImports(statement));
  return new Set(specs.filter((spec) => client.has((spec.propertyName ?? spec.name).text)).map((spec) => spec.name.text));
}

// A function: an inline arrow or function, or a component such as next/link's Link (a capitalised name).
const isFunction = (value: ts.Expression) =>
  ts.isArrowFunction(value) || ts.isFunctionExpression(value) || (ts.isIdentifier(value) && /^[A-Z]/.test(value.text));

function attributeValue(attribute: ts.JsxAttributeLike): ts.Expression | undefined {
  if (!ts.isJsxAttribute(attribute) || !attribute.initializer || !ts.isJsxExpression(attribute.initializer)) return undefined;
  return attribute.initializer.expression;
}

// The function props of one element, when it is a client part.
function functionProps(node: ts.Node, parts: Set<string>, tree: ts.SourceFile): string[] {
  if (!ts.isJsxOpeningElement(node) && !ts.isJsxSelfClosingElement(node)) return [];
  if (!ts.isIdentifier(node.tagName) || !parts.has(node.tagName.text)) return [];
  const tag = node.tagName.text;
  return node.attributes.properties.flatMap((attribute) => {
    const value = attributeValue(attribute);
    return value && isFunction(value) ? [`<${tag} ${attribute.name?.getText(tree) ?? ''}={${value.getText(tree)}}>`] : [];
  });
}

// Every `<Part prop={fn}>` in one server file, where Part is a client part imported from @omni/ui.
function functionPropsToClientParts(source: string, client: Set<string>, file = 'file.tsx'): string[] {
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const parts = clientImports(tree, client);
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    found.push(...functionProps(node, parts, tree));
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return found;
}

describe('a server component hands no function to a client part of @omni/ui', () => {
  const client = clientParts();

  it('knows the client parts', () => {
    expect(client.has('SegmentedControl')).toBe(true);
    expect(client.has('Tabs')).toBe(false);
  });

  it('names a function prop given to a client part, and leaves the rest', () => {
    const server = `import Link from 'next/link';\nimport { SegmentedControl, Tabs } from '@omni/ui';\n`
      + `export const A = () => <><SegmentedControl label="x" options={[].map((o) => o)} value="a" link={Link} /><Tabs link={Link} /></>;\n`;
    expect(functionPropsToClientParts(server, client)).toEqual(['<SegmentedControl link={Link}>']);
    expect(functionPropsToClientParts(`import { Switch } from '@omni/ui';\nexport const B = () => <Switch onChange={() => 1} />;\n`, client))
      .toEqual(['<Switch onChange={() => 1}>']);
  });

  it('holds for every server file of the app', () => {
    const breaches = tsxFiles(APP.pathname).flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      if (isClient(source)) return [];
      return functionPropsToClientParts(source, client, file).map((found) => `${file.slice(APP.pathname.length)}: ${found}`);
    });
    expect(breaches).toEqual([]);
  });
});
