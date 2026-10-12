// No `gh` read on the loop's path (PRD 1665, s6): the seven commands that decide what the loop plans or
// runs next (`board`, `next`, `care`, `roadmap`, `statusline`, `dossier`, `flow`) and every kit file
// they import, followed import by import, read the loop's state through `LoopReads` (the Omni page),
// never through `gh`. Each file is read from its syntax tree, so a comment that names a command is no
// call: a call is an argument list (`['pr', 'list', …]`) or a whole command in one string. Their writes
// keep `gh`, and `gh api graphql` is one of them when every GraphQL document of its file is a
// `mutation` (`care reply`'s); a file that also holds a `query` reads through it. The rules are proven
// on fixtures first, then the guard runs on the kit's files.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const kitRoot = fileURLToPath(new URL('..', import.meta.url));

/** The seven commands whose reads decide, from the kit's root. */
const COMMANDS = ['board', 'next', 'care', 'roadmap', 'statusline', 'dossier', 'flow'].map((name) => `bin/commands/${name}.ts`);

/** The `gh` reads the loop's path may not run, each as `<group> <verb>`. */
const READS: readonly (readonly [string, string])[] = [
  ['pr', 'list'],
  ['pr', 'view'],
  ['pr', 'diff'],
  ['pr', 'checks'],
  ['issue', 'view'],
  ['issue', 'list'],
];

/** A GraphQL document that reads: an explicit `query`, or the shorthand `{ field(…) … }`. */
const GRAPHQL_QUERY = /^\s*(?:query\b|\{\s*\w+\s*[({])/;

/** Every string a file's code holds, in order, with its line: string literals and template texts. */
function stringsOf(source: ts.SourceFile): { text: string; line: number; node: ts.Node }[] {
  const found: { text: string; line: number; node: ts.Node }[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      found.push({ text: node.text, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, node });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

/** The string elements of an argument list, in order, as written; any other element is `null`. */
const elementsOf = (array: ts.ArrayLiteralExpression): (string | null)[] =>
  array.elements.map((element) => (ts.isStringLiteralLike(element) ? element.text : null));

/** Whether `words` holds `first` directly followed by `second`. */
const holdsPair = (words: readonly (string | null)[], first: string, second: string): boolean =>
  words.some((word, index) => word === first && words[index + 1] === second);

/** Each `gh` read of one file's text, as `<line> gh <command>`. */
function ghReads(path: string, text: string): string[] {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const strings = stringsOf(source);
  const readsGraphql = strings.some(({ text: s }) => GRAPHQL_QUERY.test(s));
  const found: string[] = [];
  const lineOf = (node: ts.Node) => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
  const visit = (node: ts.Node): void => {
    if (ts.isArrayLiteralExpression(node)) {
      const words = elementsOf(node);
      for (const [group, verb] of READS) if (holdsPair(words, group, verb)) found.push(`${lineOf(node)} gh ${group} ${verb}`);
      if (readsGraphql && holdsPair(words, 'api', 'graphql')) found.push(`${lineOf(node)} gh api graphql`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  for (const { text: s, line } of strings) {
    for (const [group, verb] of READS) if (new RegExp(`\\bgh ${group} ${verb}\\b`).test(s)) found.push(`${line} gh ${group} ${verb}`);
    if (readsGraphql && /\bgh api graphql\b/.test(s)) found.push(`${line} gh api graphql`);
  }
  return found;
}

/** The kit files `path` imports by a relative path, resolved from the kit's root. */
function importsOf(path: string, text: string): string[] {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const out: string[] = [];
  const add = (specifier: ts.Expression | undefined) => {
    if (specifier === undefined || !ts.isStringLiteralLike(specifier) || !specifier.text.startsWith('.')) return;
    out.push(relative(kitRoot, resolve(dirname(join(kitRoot, path)), specifier.text)));
  };
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) add(statement.moduleSpecifier);
  }
  return out;
}

/** The seven commands and every kit file they import, followed import by import, tests left out. */
function loopPath(): string[] {
  const seen = new Set<string>();
  const queue = [...COMMANDS];
  for (let path = queue.shift(); path !== undefined; path = queue.shift()) {
    if (seen.has(path) || path.endsWith('.test.ts') || !path.endsWith('.ts') || !existsSync(join(kitRoot, path))) continue;
    seen.add(path);
    queue.push(...importsOf(path, readFileSync(join(kitRoot, path), 'utf8')));
  }
  return [...seen].sort();
}

describe('the no-gh-reads guard, on fixtures', () => {
  it.each(READS)('finds gh %s %s as an argument list, naming its line', (group, verb) => {
    expect(ghReads('a.ts', `const a = 1;\nexec('gh', ['${group}', '${verb}', '--repo', slug]);\n`)).toEqual([`2 gh ${group} ${verb}`]);
  });

  it.each(READS)('finds gh %s %s as one string', (group, verb) => {
    expect(ghReads('a.ts', `run(\`gh ${group} ${verb} --json number\`);\n`)).toEqual([`1 gh ${group} ${verb}`]);
  });

  it('finds gh api graphql when its file holds a query, in either form', () => {
    const call = "exec('gh', ['api', 'graphql', '--input', '-']);\n";
    expect(ghReads('a.ts', `const Q = \`query($n: Int!) { repository { id } }\`;\n${call}`)).toEqual(['2 gh api graphql']);
    expect(ghReads('a.ts', `const Q = \`{ repository(owner: "a") { id } }\`;\n${call}`)).toEqual(['2 gh api graphql']);
  });

  it("lets gh api graphql write when every document of its file is a mutation (care reply's)", () => {
    expect(ghReads('a.ts', "const M = `mutation($t: ID!) { resolveReviewThread(input: { threadId: $t }) { thread { isResolved } } }`;\nexec('gh', ['api', 'graphql', '--input', '-']);\n")).toEqual([]);
  });

  it('lets a comment name a read, and lets every write and gh repo view through', () => {
    const text = [
      '// Reads used to come from `gh pr list` and `gh issue view`.',
      "exec('gh', ['pr', 'merge', '12', '--squash']);",
      "exec('gh', ['pr', 'edit', '12', '--add-label', 'x']);",
      "exec('gh', ['issue', 'comment', '7', '--body', 'b']);",
      "exec('gh', ['repo', 'view', slug, '--json', 'defaultBranchRef']);",
      "exec('gh', ['api', `repos/${slug}/issues/7/comments`, '--input', '-']);",
    ].join('\n');
    expect(ghReads('a.ts', text)).toEqual([]);
  });
});

describe('the no-gh-reads guard, on the loop path', () => {
  it('follows the seven commands into their helpers', () => {
    const path = loopPath();
    expect(path).toEqual(expect.arrayContaining([...COMMANDS, 'lib/loop-reads/omni.ts', 'lib/roadmap/push.ts', 'lib/now/build-links.ts', 'bin/github.ts']));
  });

  it('finds no gh read in the seven commands or any file they import', () => {
    const found = loopPath().flatMap((path) => ghReads(path, readFileSync(join(kitRoot, path), 'utf8')).map((hit) => `kit/${path}:${hit}`));
    expect(found).toEqual([]);
  });
});
