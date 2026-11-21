#!/usr/bin/env node
// node scripts/design-ratchet.ts [<path>…] [--base <ref>] — the design ratchet (PRD omni-loop-11),
// as `layering/` (ADR-0095) and `fallow/` are: stylelint.config.ts runs on every app-page stylesheet
// git tracks under apps/galaxy/src/, and an ESLint rule set of its own (never `pnpm lint`'s) runs on
// every tracked .tsx there: an inline `style` prop is an `inline-style` breach, and a raw <button>,
// <table>, <dialog>, <input> or <textarea>, or a className naming a class a
// packages/ui/src/*.meta.ts lists under `replaces`, is a `raw-component` breach, and a raw <select>
// is a `raw-select` breach of its own (use `Select` from @omni/ui; the baseline holds no such line,
// PRD 3129). The arcade (arcade/,
// play-dock/) and HOME (home/) are left out, as they keep their own surface tokens. `design/baseline.json` lists the breaches that exist, one line
// per file and rule (`<path> <rule>`), sorted, and may only shrink. The ratchet fails on
//
//   1. a breach the baseline does not list: write the value as a token;
//   2. a baseline line whose breach is gone: delete the line;
//   3. a baseline line the base's baseline does not hold (the merge-base of HEAD with origin/main, or
//      with the ref --base names): the baseline grew. A baseline absent at the base is no growth.
//
// Given paths (files or folders), it reads only its stylesheets among them, and judges only the
// baseline lines under them; the growth check reads the whole baseline whatever the paths.
//
// Exit codes: 0 clean, 1 a ratchet failure, 2 a malformed argument or baseline, or a base git cannot read.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import type { Rule } from 'eslint';
import { z } from 'zod';

export const BASELINE = 'design/baseline.json';
const DEFAULT_BASE = 'origin/main';
const ROOT = 'apps/galaxy/src/';
/** The arcade and HOME keep their own surface tokens: the ratchet never reads them. */
const OUT: readonly string[] = ['apps/galaxy/src/arcade/', 'apps/galaxy/src/play-dock/', 'apps/galaxy/src/home/'];

/** One breach: where it is, the rule it breaks, and the linter's words for it. */
type Finding = { path: string; line: number; rule: string; text: string };

/** Lints the files it reads among those (paths from the root) and answers every breach. */
type Linter = (paths: readonly string[]) => Promise<Finding[]>;

/** The two questions the ratchet asks git; `null` when git cannot answer. */
export interface Git {
  /** The commit HEAD and `ref` share. */
  mergeBase: (ref: string) => string | null;
  /** The baseline's text at `commit`; `null` when it is absent there. */
  show: (commit: string) => string | null;
}

export interface Deps {
  /** Every file git tracks (paths from the root). */
  tracked: () => string[];
  lint: Linter;
  /** The working tree's baseline text; `null` when the file is absent. */
  baseline: () => string | null;
  git: Git;
}

/** `design/baseline.json`: the breaches that exist, `<path> <rule>`. */
const BaselineSchema = z.strictObject({ breaches: z.array(z.string().regex(/^apps\/galaxy\/src\/\S+ [a-z][a-z-]*$/)) });

/** A file the ratchet reads, a stylesheet or a TSX: under apps/galaxy/src/, the arcade and HOME left out. */
function isRead(path: string): boolean {
  return (path.endsWith('.css') || path.endsWith('.tsx')) && path.startsWith(ROOT) && !OUT.some((prefix) => path.startsWith(prefix));
}

/** Whether `path` is one of `paths` or under one of them; every path is, when none is given. */
function within(path: string, paths: readonly string[]): boolean {
  return paths.length === 0 || paths.some((given) => path === given || path.startsWith(given.endsWith('/') ? given : `${given}/`));
}

const fileOf = (line: string) => line.slice(0, line.lastIndexOf(' '));

/** The baseline's lines for these findings: one per file and rule, sorted. */
function lines(findings: readonly Finding[]): string[] {
  return [...new Set(findings.map((finding) => `${finding.path} ${finding.rule}`))].sort();
}

/** The breaches of a baseline text; `null` when it is absent; an error message when malformed. */
function parseBaseline(text: string | null, where: string): string[] | null | { error: string } {
  if (text === null) return null;
  try {
    return BaselineSchema.parse(JSON.parse(text)).breaches;
  } catch {
    return { error: `design ratchet: ${where} is not { "breaches": ["<path> <rule>", …] }` };
  }
}

/** Splits the arguments into paths and a base ref; `null` when one is malformed. */
function readArgs(argv: readonly string[]): { paths: string[]; base: string } | null {
  try {
    const { values, positionals } = parseArgs({ args: [...argv], options: { base: { type: 'string' } }, allowPositionals: true, strict: true });
    const base = values.base ?? DEFAULT_BASE;
    if (base === '' || base.startsWith('-')) return null;
    return { paths: positionals.map((path) => path.replace(/^\.\//, '')), base };
  } catch {
    return null;
  }
}

const usage = 'usage: node scripts/design-ratchet.ts [<path>…] [--base <ref>]';
const plural = (n: number, one: string, many: string) => `${String(n)} ${n === 1 ? one : many}`;

/** The baseline in the working tree and at the base (`null`: absent there), or why it cannot be read. */
function readBaselines(deps: Deps, base: string): { listed: string[]; atBase: string[] | null } | { error: string } {
  const baseline = parseBaseline(deps.baseline(), BASELINE);
  if (baseline !== null && !Array.isArray(baseline)) return baseline;
  const commit = deps.git.mergeBase(base);
  if (commit === null) return { error: `design ratchet: cannot read the base ${base} (no merge-base with HEAD): fetch it, or name another with --base` };
  const atBase = parseBaseline(deps.git.show(commit), `${BASELINE} at ${base}`);
  if (atBase !== null && !Array.isArray(atBase)) return atBase;
  return { listed: baseline ?? [], atBase };
}

/** What the ratchet refuses: each failure's heading line, then its lines; empty when nothing is. */
function judge(findings: readonly Finding[], listed: readonly string[], atBase: readonly string[] | null, paths: readonly string[], base: string): string[] {
  const now = lines(findings);
  const known = new Set(listed);
  const present = new Set(now);
  // A baseline absent at the base is no growth.
  const before = new Set(atBase ?? listed);
  const unlisted = now.filter((line) => !known.has(line));
  const stale = listed.filter((line) => within(fileOf(line), paths) && !present.has(line));
  const grown = listed.filter((line) => !before.has(line));
  const out: string[] = [];
  if (unlisted.length > 0) {
    out.push(`design ratchet: ${plural(unlisted.length, 'breach', 'breaches')} ${BASELINE} does not list — write the value as a token:`);
    for (const line of unlisted) out.push(line, ...findings.filter((f) => `${f.path} ${f.rule}` === line).map((f) => `  ${f.path}:${String(f.line)}  ${f.text}`));
  }
  if (stale.length > 0) out.push(`design ratchet: ${plural(stale.length, 'line', 'lines')} of ${BASELINE} whose breach is gone — delete:`, ...stale);
  if (grown.length > 0) out.push(`design ratchet: ${BASELINE} grew against ${base} — it may only shrink; these lines are not at the base:`, ...grown);
  if (listed.join('\n') !== [...known].sort().join('\n')) out.push(`design ratchet: ${BASELINE} must be sorted, one line per file and rule`);
  return out;
}

/** Runs the ratchet: its exit code and the lines it prints. */
export async function main(argv: readonly string[], deps: Deps): Promise<{ code: 0 | 1 | 2; lines: string[] }> {
  const args = readArgs(argv);
  if (!args) return { code: 2, lines: [usage] };
  const baselines = readBaselines(deps, args.base);
  if ('error' in baselines) return { code: 2, lines: [baselines.error] };
  const files = deps.tracked().filter((path) => isRead(path) && within(path, args.paths)).sort();
  const findings = await deps.lint(files);
  const failures = judge(findings, baselines.listed, baselines.atBase, args.paths, args.base);
  if (failures.length > 0) return { code: 1, lines: failures };
  const breaches = plural(lines(findings).length, 'breach', 'breaches');
  return { code: 0, lines: [`design ratchet: ${plural(files.length, 'file', 'files')} read, ${breaches}, each listed in ${BASELINE}`] };
}

/** stylelint with stylelint.config.ts over the stylesheets `read` hands it, one at a time by its text. */
export function stylelintSheets(read: (path: string) => string): Linter {
  const root = fileURLToPath(new URL('..', import.meta.url));
  return async (all) => {
    const paths = all.filter((path) => path.endsWith('.css'));
    if (paths.length === 0) return [];
    // Loaded here, not at the top, so a run with nothing to read never loads stylelint.
    const { default: stylelint } = await import('stylelint');
    const findings: Finding[] = [];
    // By its text, never a glob: a path may hold `[` or `*`.
    for (const path of paths) {
      const { results } = await stylelint.lint({ code: read(path), codeFilename: join(root, path), configFile: join(root, 'stylelint.config.ts') });
      for (const result of results) {
        for (const warning of result.warnings) findings.push({ path, line: warning.line, rule: warning.rule, text: warning.text });
      }
    }
    return findings;
  };
}

/** The elements a page never writes raw: `@omni/ui` has the component. */
const RAW_ELEMENTS = ['button', 'table', 'dialog', 'input', 'textarea'];

/** The classes `@omni/ui` components replace: the `replaces` of every packages/ui/src/*.meta.ts. */
export function replacedClasses(read: (path: string) => string, list: () => string[]): string[] {
  const classes = list().flatMap((file) => {
    const match = /replaces:\s*\[([^\]]*)\]/.exec(read(file));
    return [...(match?.[1] ?? '').matchAll(/'([^']+)'/g)].map((found) => found[1] ?? '');
  });
  return [...new Set(classes)].filter(Boolean);
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** ESLint with a rule set of its own over the TSX files `paths` holds: `inline-style`, `raw-component` and `raw-select`. */
export function eslintPages(read: (path: string) => string, replaced: readonly string[]): Linter {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const classPattern = replaced.length === 0 ? null : new RegExp(`(?<![\\w-])(?:${replaced.map(escape).join('|')})(?![\\w-])`);
  return async (all) => {
    const paths = all.filter((path) => path.endsWith('.tsx'));
    if (paths.length === 0) return [];
    // Loaded here, not at the top, so a run with nothing to read never loads ESLint.
    const { ESLint } = await import('eslint');
    const { default: tseslint } = await import('typescript-eslint');
    const rules: Record<string, Rule.RuleModule> = {
      'inline-style': {
        meta: { type: 'problem', schema: [], messages: { style: 'an inline style prop: write the value as a token in a stylesheet' } },
        create: (context) => ({
          JSXAttribute(node: Rule.Node & { name: { name?: unknown } }) {
            if (node.name.name === 'style') context.report({ node, messageId: 'style' });
          },
        }),
      },
      'raw-select': {
        meta: { type: 'problem', schema: [], messages: { select: 'a raw <select>: use Select from @omni/ui' } },
        create: (context) => ({
          JSXOpeningElement(node: Rule.Node & { name: { type: string; name?: string } }) {
            if (node.name.type === 'JSXIdentifier' && node.name.name === 'select') context.report({ node, messageId: 'select' });
          },
        }),
      },
      'raw-component': {
        meta: { type: 'problem', schema: [], messages: { raw: 'a raw element or a class a @omni/ui component replaces: use the component' } },
        create: (context) => ({
          JSXOpeningElement(node: Rule.Node & { name: { type: string; name?: string } }) {
            if (node.name.type === 'JSXIdentifier' && RAW_ELEMENTS.includes(node.name.name ?? '')) context.report({ node, messageId: 'raw' });
          },
          JSXAttribute(node: Rule.Node & { name: { name?: unknown }; value?: Rule.Node | null }) {
            if (node.name.name === 'className' && node.value && classPattern?.test(context.sourceCode.getText(node.value))) context.report({ node, messageId: 'raw' });
          },
        }),
      },
    };
    const eslint = new ESLint({
      cwd: root,
      overrideConfigFile: true,
      overrideConfig: [
        {
          files: ['**/*.tsx'],
          languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } } },
          linterOptions: { noInlineConfig: true },
          plugins: { design: { rules } },
          rules: { 'design/inline-style': 'error', 'design/raw-component': 'error', 'design/raw-select': 'error' },
        },
      ],
    });
    const findings: Finding[] = [];
    for (const path of paths) {
      for (const result of await eslint.lintText(read(path), { filePath: join(root, path) })) {
        for (const message of result.messages) {
          findings.push({ path, line: message.line, rule: (message.ruleId ?? 'parse').replace(/^design\//, ''), text: message.message });
        }
      }
    }
    return findings;
  };
}

function realDeps(root: string): Deps {
  const git = (args: readonly string[]): string | null => {
    try {
      return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    } catch {
      return null;
    }
  };
  const read = (path: string) => readFileSync(join(root, path), 'utf8');
  return {
    tracked: () => (git(['ls-files', '-z', '--', ROOT]) ?? '').split('\0').filter(Boolean),
    lint: async (paths) => [
      ...(await stylelintSheets(read)(paths)),
      ...(await eslintPages(read, replacedClasses(read, () => readdirSync(join(root, 'packages/ui/src')).filter((file) => file.endsWith('.meta.ts')).map((file) => `packages/ui/src/${file}`)))(paths)),
    ],
    baseline: () => {
      try {
        return read(BASELINE);
      } catch {
        return null;
      }
    },
    git: {
      mergeBase: (ref) => {
        const commit = git(['merge-base', 'HEAD', ref])?.trim();
        return commit === undefined || commit === '' ? null : commit;
      },
      show: (commit) => git(['show', `${commit}:${BASELINE}`]),
    },
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const { code, lines: printed } = await main(process.argv.slice(2), realDeps(fileURLToPath(new URL('..', import.meta.url))));
  for (const line of printed) console.log(line);
  process.exit(code);
}
