import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

// The app speaks of the agent, never of one product (PRD 1915). Every non-test `.ts`/`.tsx` file
// of `apps/galaxy/src` and `apps/galaxy/app` is parsed with TypeScript's own parser, and the word
// "Claude", in any case, is refused in the four places a person can read it: JSX text, a JSX
// attribute's string, a string literal and a template literal's text. Comments and identifiers are
// code, not words, and are never read; so is a name inside a literal (`claude_session_id`,
// `claudeSessionId`: a column and an API field). A name that stays is a fact, not the product's
// voice: each one is in ALLOWED below, with its reason. The guide's two diagrams are read as text,
// and refuse "claude" anywhere.

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const SCANNED = ['apps/galaxy/src', 'apps/galaxy/app'];
const SOURCE = /\.tsx?$/;
const TEST = /\.test\.tsx?$/;
const DIAGRAMS = ['docs/guide/diagrams/loop.svg', 'docs/guide/diagrams/roadmap.svg'];
/** The word, alone: `claude_session_id` and `claudeSessionId` are names, not words. */
const WORD = /\bclaude\b/i;

/** A model id, as a provider names it (`claude-sonnet-4-6`, `anthropic/claude-haiku-4.5`). */
const MODEL_ID = /^(?:anthropic\/)?claude-[a-z0-9.-]+$/;

/** A name that stays: its file, the literal when the rest of the file is still refused, why, and a literal it lets through. */
type Allowed = { file: string; literal?: RegExp; reason: string; sample: string };

const ALLOWED: readonly Allowed[] = [
  {
    file: 'apps/galaxy/src/agent-connect/tokens/model.ts', sample: 'Claude Code',
    reason: 'the Connect agent setup: its Claude Code row and `claude mcp add`, Claude Code\'s own command',
  },
  {
    file: 'apps/galaxy/src/agent-connect/tokens/ConnectAgentCard.tsx', sample: 'in Cursor, Claude Code or any MCP client',
    reason: 'the Connect agent hint names the editors the setup has a row for, Cursor and any MCP client beside Claude Code',
  },
  { file: 'apps/galaxy/src/ask/prices.ts', literal: MODEL_ID, sample: 'claude-sonnet-4-6', reason: 'the price table is keyed by model id' },
  { file: 'apps/galaxy/src/ask/classify.ts', literal: MODEL_ID, sample: 'anthropic/claude-haiku-4.5', reason: 'the model the classifier calls, by its id' },
  { file: 'apps/galaxy/src/business/suggest.ts', literal: MODEL_ID, sample: 'anthropic/claude-haiku-4.5', reason: 'the model the suggestion calls, by its id' },
  { file: 'apps/galaxy/src/ask/page/demo.ts', literal: MODEL_ID, sample: 'claude-opus-4-8', reason: 'demo model ids: a round\'s cost line shows the model as sent' },
  { file: 'apps/galaxy/src/home/poster/Poster.tsx', literal: /^CLAUDE CODE$/, sample: 'CLAUDE CODE', reason: 'HOME\'s works-with line names each agent the loop runs on' },
  {
    file: 'apps/galaxy/src/releases/words.ts', literal: /plugin for Claude Code, skills for any coding agent/,
    sample: 'its plugin for Claude Code, skills for any coding agent, the app',
    reason: 'the release notes list the product as shipped: a plugin for Claude Code beside skills for any coding agent (PRD 1915\'s own words)',
  },
  {
    file: 'apps/galaxy/src/releases/demo.ts',
    literal: /^(?:The omni plugin for Claude Code gives the loop its commands|Answer Claude on a page|Ask mode shows the questions Claude asks|Ask mode keeps one session per Claude Code terminal|Every question Claude asks is kept for good)/,
    sample: 'Answer Claude on a page, not in a terminal',
    reason: 'the demo\'s initial release repeats the shipped release notes word for word (releases/demo.test.ts): a record of what shipped then, not the voice of the app',
  },
  {
    file: 'apps/galaxy/src/dossier/store.fake.ts', literal: /^A Claude session id is 1 to 200 characters\.$/,
    sample: 'A Claude session id is 1 to 200 characters.',
    reason: 'the fake repeats the database\'s refusal (20261004090000_workspace_gate.sql) word for word; its words change with a migration, which PRD 1915 leaves out',
  },
  {
    file: 'apps/galaxy/src/working/store.fake.ts', literal: /^This Claude session is another account's\.$/,
    sample: 'This Claude session is another account\'s.',
    reason: 'the fake repeats the database\'s refusal (20261020090000_working_pings.sql) word for word; its words change with a migration, which PRD 1915 leaves out',
  },
];

type Kind = 'JSX text' | 'JSX attribute' | 'string literal' | 'template text';
type Finding = { at: string; kind: Kind; text: string };

function literalOf(node: ts.Node): { kind: Kind; text: string } | null {
  if (ts.isJsxText(node)) return { kind: 'JSX text', text: node.text };
  if (ts.isStringLiteral(node)) return { kind: ts.isJsxAttribute(node.parent) ? 'JSX attribute' : 'string literal', text: node.text };
  if (ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
    return { kind: 'template text', text: node.text };
  }
  return null;
}

const allowed = (path: string, text: string, list: readonly Allowed[]) =>
  list.some((a) => a.file === path && (!a.literal || a.literal.test(text.trim())));

/** Every literal of `source` a person could read that says "Claude", outside `list`. */
function findClaude(path: string, source: string, list: readonly Allowed[] = ALLOWED): Finding[] {
  if (!WORD.test(source)) return [];
  const kind = path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, kind);
  const found: Finding[] = [];
  const visit = (node: ts.Node) => {
    const literal = literalOf(node);
    if (literal && WORD.test(literal.text) && !allowed(path, literal.text, list)) {
      const line = file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;
      found.push({ at: `${path}:${String(line)}`, kind: literal.kind, text: literal.text.trim() });
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

const scanned = () => execFileSync('git', ['ls-files', '--', ...SCANNED], { cwd: ROOT, encoding: 'utf8' })
  .split('\n')
  .filter((p) => SOURCE.test(p) && !TEST.test(p));

const said = (findings: Finding[]) => findings.map((f) => `${f.at} (${f.kind}): ${f.text}`);

describe('the app speaks of the agent', () => {
  it('finds "Claude" in JSX text, a JSX attribute, a string literal and a template, in any case', () => {
    const source = [
      'export const A = <p title="Ask claude">Claude is working</p>;',
      "export const B = 'Send to CLAUDE';",
      'export const C = `$' + '{n} questions Claude asked`;',
      'export const D = `Claude asks $' + '{n} questions`;',
    ].join('\n');
    expect(findClaude('apps/galaxy/src/x.tsx', source, []).map((f) => f.kind))
      .toEqual(['JSX attribute', 'JSX text', 'string literal', 'template text', 'template text']);
  });

  it('names the file and line of what it finds', () => {
    expect(findClaude('apps/galaxy/src/x.ts', "const a = 1;\nexport const B = 'Claude asks';", []))
      .toEqual([{ at: 'apps/galaxy/src/x.ts:2', kind: 'string literal', text: 'Claude asks' }]);
  });

  it('reads no comment, no identifier and no name inside a literal', () => {
    const source = [
      '// Claude asks',
      '/** Claude */',
      'export const claudeSessionId = x.claude_session_id;',
      "export const q = db.select('id, claude_session_id').eq('claudeSessionId', 1);",
    ].join('\n');
    expect(findClaude('apps/galaxy/src/x.ts', source, [])).toEqual([]);
  });

  it('lets each allowlist entry through, with its reason, and only its literal when it names one', () => {
    for (const entry of ALLOWED) {
      const source = `export const X = ${JSON.stringify(entry.sample)};`;
      expect(findClaude(entry.file, source, []), entry.file).toHaveLength(1);
      expect(findClaude(entry.file, source), entry.file).toEqual([]);
      expect(entry.reason.length, entry.file).toBeGreaterThan(0);
      if (entry.literal) expect(findClaude(entry.file, "export const Y = 'Claude is working';"), entry.file).toHaveLength(1);
    }
  });

  it('finds no "Claude" left in a user-visible literal of the app', () => {
    const found = scanned().flatMap((p) => findClaude(p, readFileSync(`${ROOT}${p}`, 'utf8')));
    expect(said(found)).toEqual([]);
  });

  it('names only files that still exist in its allowlist', () => {
    const files = new Set(scanned());
    expect(ALLOWED.map((a) => a.file).filter((f) => !files.has(f))).toEqual([]);
  });

  it('finds no "Claude" in the guide\'s two diagrams', () => {
    for (const path of DIAGRAMS) expect(readFileSync(`${ROOT}${path}`, 'utf8'), path).not.toMatch(/claude/i);
  });
});
