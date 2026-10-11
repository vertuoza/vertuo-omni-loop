// PRD 1559, s1: the DESIGN.md reader. The file is in Google's DESIGN.md format
// (https://github.com/google-labs-code/design.md): YAML front matter holding the token groups
// (`colors`, `typography`, `rounded`, `spacing`, `components`), then prose sections. The kit reads
// three things from it: the tokens, the closed list of parts (each `###` entry under `## Components`,
// with its Summary, Variants, States, Tokens, Accessibility, Do, Don't and Code lines) and omni-loop's
// own `## Reference screens` section (the library screens a builder copies). A line is written
// `- **Label:** value`, `**Label**: value` or `Label: value`; Do and Don't may also hold an indented
// sub-list. A `{group.token}` reference that does not resolve, and a file in another shape, are named
// in `problems`: the reader never throws on what the file says.
import { parse } from 'yaml';
import { messageOf } from '../../narrow.ts';

/** One part of the closed list, as its `###` entry says it. */
export type Part = {
  readonly name: string;
  readonly summary: string | null;
  readonly variants: readonly string[];
  readonly states: readonly string[];
  /** The tokens it binds, each a dotted path (`colors.primary`), braces dropped. */
  readonly tokens: readonly string[];
  readonly accessibility: string | null;
  readonly do: readonly string[];
  readonly dont: readonly string[];
  /** The paths of its implementation, in any framework. */
  readonly code: readonly string[];
};

/** A library screen DESIGN.md names for a builder to copy, and its one line on what it shows. */
export type ReferenceScreen = { readonly screen: string; readonly note: string | null };

/** A `{group.token}` reference that names no token, and where it was written. */
export type Unresolved = { readonly reference: string; readonly where: string };

export type DesignSystem = {
  /** The front matter as written: each token group by name; empty when it does not read. */
  readonly tokens: Readonly<Record<string, unknown>>;
  readonly parts: readonly Part[];
  readonly referenceScreens: readonly ReferenceScreen[];
  readonly unresolved: readonly Unresolved[];
  /** One line per thing in the file that does not read, unresolved references last. */
  readonly problems: readonly string[];
};

const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;
const SECTION = /^##\s+(.+?)\s*#*\s*$/;
const PART = /^###\s+(.+?)\s*#*\s*$/;
const FENCE = /^\s*(```|~~~)/;
const BULLET = /^\s*[-*]\s+(.*)$/;
const SUB_ITEM = /^\s+[-*]\s+(.*)$/;
const LINE = /^\*{0,2}([A-Za-z][A-Za-z'’ ]*?)\*{0,2}\s*:\s*\*{0,2}\s*(.*)$/;
const REFERENCE = /\{([A-Za-z0-9_.-]+)\}/g;
const NOTHING = new Set(['', '—', '-', 'none']);

type Field = 'summary' | 'variants' | 'states' | 'tokens' | 'accessibility' | 'do' | 'dont' | 'code';

const FIELDS: Readonly<Record<string, Field>> = {
  summary: 'summary',
  variants: 'variants',
  states: 'states',
  tokens: 'tokens',
  accessibility: 'accessibility',
  do: 'do',
  "don't": 'dont',
  dont: 'dont',
  code: 'code',
};

/** Fields whose inline value is a comma list; Do and Don't hold sentences, one per line. */
const COMMA_LISTS = new Set<Field>(['variants', 'states', 'tokens', 'code']);

const isMap = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);

/** A list entry with its backticks and braces dropped. */
const clean = (entry: string): string => entry.replace(/`/g, '').trim().replace(/^\{(.*)\}$/, '$1').trim();

function splitList(value: string): string[] {
  return value
    .split(/[,·]/)
    .map(clean)
    .filter((entry) => !NOTHING.has(entry.toLowerCase()));
}

function readFrontMatter(text: string): { tokens: Record<string, unknown>; body: string; problems: string[]; read: boolean } {
  const match = FRONT_MATTER.exec(text);
  if (!match) return { tokens: {}, body: text, problems: ['no front matter of design tokens'], read: false };
  const body = text.slice(match[0].length);
  let value: unknown;
  try {
    value = parse(match[1] ?? '');
  } catch (error) {
    return { tokens: {}, body, problems: [`front matter does not read: ${messageOf(error).split('\n')[0]}`], read: false };
  }
  if (!isMap(value)) return { tokens: {}, body, problems: ['front matter is not a map of token groups'], read: false };
  return { tokens: value, body, problems: [], read: true };
}

/** The body's `##` sections, each heading's lines, headings inside a code fence left as text. */
function sections(body: string): Map<string, string[]> {
  const found = new Map<string, string[]>();
  let current: string[] | null = null;
  let fenced = false;
  for (const line of body.split(/\r?\n/)) {
    if (FENCE.test(line)) fenced = !fenced;
    const heading = fenced ? null : SECTION.exec(line);
    if (heading && !line.startsWith('###')) {
      const key = (heading[1] ?? '').toLowerCase();
      current = found.get(key) ?? [];
      found.set(key, current);
      continue;
    }
    current?.push(line);
  }
  return found;
}

type Draft = { name: string; summary: string[]; accessibility: string[]; variants: string[]; states: string[]; tokens: string[]; do: string[]; dont: string[]; code: string[] };

const draft = (name: string): Draft => ({ name, summary: [], accessibility: [], variants: [], states: [], tokens: [], do: [], dont: [], code: [] });

function finish(part: Draft): Part {
  const text = (lines: string[]) => (lines.length ? lines.join(' ') : null);
  return {
    name: part.name,
    summary: text(part.summary),
    variants: part.variants,
    states: part.states,
    tokens: part.tokens,
    accessibility: text(part.accessibility),
    do: part.do,
    dont: part.dont,
    code: part.code,
  };
}

function add(part: Draft, field: Field, value: string, inline: boolean): void {
  const entries = inline && COMMA_LISTS.has(field) ? splitList(value) : [clean(value)].filter((entry) => !NOTHING.has(entry.toLowerCase()));
  part[field].push(...entries);
}

/** The lines outside any code fence. */
function unfenced(lines: readonly string[]): string[] {
  let fenced = false;
  return lines.filter((line) => {
    if (FENCE.test(line)) fenced = !fenced;
    return !fenced && !FENCE.test(line);
  });
}

/** Each `###` entry's name and lines, in the file's order; lines before the first entry dropped. */
function entries(lines: readonly string[]): { name: string; lines: string[] }[] {
  const found: { name: string; lines: string[] }[] = [];
  for (const line of unfenced(lines)) {
    const heading = PART.exec(line);
    if (heading) found.push({ name: heading[1] ?? '', lines: [] });
    else found.at(-1)?.lines.push(line);
  }
  return found;
}

/** The field a label names, or null for a label the format does not know. */
function fieldOf(label: string): Field | null {
  const key = label.toLowerCase().replace(/’/g, "'").trim();
  return (Object.hasOwn(FIELDS, key) ? FIELDS[key] : undefined) ?? null;
}

/** A `Label: value` line, list marker and bold dropped; null for a line of another shape. */
function labelled(line: string): { label: string; value: string } | null {
  const bullet = BULLET.exec(line);
  const match = LINE.exec(bullet ? String(bullet[1]) : line.trim());
  return match ? { label: String(match[1]), value: String(match[2]) } : null;
}

/** One entry read into a part; each line with a label the format does not know is a problem. */
function readEntry(name: string, lines: readonly string[]): { part: Part; problems: string[] } {
  const part = draft(name);
  const problems: string[] = [];
  let field: Field | null = null;
  for (const line of lines) {
    const sub = field && SUB_ITEM.exec(line);
    if (field && sub) {
      add(part, field, String(sub[1]), false);
      continue;
    }
    const read = labelled(line);
    if (!read) continue;
    field = fieldOf(read.label);
    if (field) add(part, field, read.value, true);
    else problems.push(`part ${name}: unknown line "${read.label}"`);
  }
  return { part: finish(part), problems };
}

function readParts(lines: readonly string[]): { parts: Part[]; problems: string[] } {
  const parts: Part[] = [];
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const entry of entries(lines)) {
    const key = entry.name.toLowerCase();
    if (seen.has(key)) {
      problems.push(`part ${entry.name} is listed twice: the second is skipped`);
      continue;
    }
    seen.add(key);
    const read = readEntry(entry.name, entry.lines);
    parts.push(read.part);
    problems.push(...read.problems);
  }
  return { parts, problems };
}

const QUOTED_SCREEN = /^`([^`]+)`\s*(?:[—–:-]\s*)?(.*)$/;
const PLAIN_SCREEN = /^(\S+?)(?::\s+|\s+[—–-]\s+)(.*)$/;

/** One Reference screens bullet: the screen's name, backticked or bare, then its note after a dash or a colon. */
function referenceScreen(item: string): ReferenceScreen {
  const match = QUOTED_SCREEN.exec(item) ?? PLAIN_SCREEN.exec(item);
  const screen = (match?.[1] ?? item).trim();
  return { screen, note: match?.[2]?.trim() || null };
}

function readReferenceScreens(lines: readonly string[]): ReferenceScreen[] {
  return lines.flatMap((line) => {
    const item = BULLET.exec(line)?.[1]?.trim();
    return item ? [referenceScreen(item)] : [];
  });
}

/** The token a dotted path names, or undefined when there is none. */
function lookup(tokens: Readonly<Record<string, unknown>>, path: string): unknown {
  let value: unknown = tokens;
  for (const key of path.split('.')) {
    if (!isMap(value) || !Object.hasOwn(value, key)) return undefined;
    value = value[key];
  }
  return value;
}

/** Each `{reference}` written in the front matter's values, with the dotted path of the value. */
function frontMatterReferences(value: unknown, where: string): Unresolved[] {
  if (typeof value === 'string') return [...value.matchAll(REFERENCE)].map((match) => ({ reference: match[1] ?? '', where }));
  if (Array.isArray(value)) return value.flatMap((entry, index) => frontMatterReferences(entry, `${where}.${index}`));
  if (isMap(value)) return Object.entries(value).flatMap(([key, entry]) => frontMatterReferences(entry, where ? `${where}.${key}` : key));
  return [];
}

/** Reads a DESIGN.md's text: its tokens, its parts, its reference screens and what does not read. */
export function parseDesignSystem(text: string): DesignSystem {
  const front = readFrontMatter(text);
  const body = sections(front.body);
  const components = body.get('components');
  const { parts, problems: partProblems } = components ? readParts(components) : { parts: [], problems: ['no Components section: no part is listed'] };
  const referenceScreens = readReferenceScreens(body.get('reference screens') ?? []);
  const unresolved = front.read
    ? [
        ...frontMatterReferences(front.tokens, ''),
        ...parts.flatMap((part) => part.tokens.filter((token) => token.includes('.')).map((reference) => ({ reference, where: `part ${part.name}` }))),
      ].filter(({ reference }) => lookup(front.tokens, reference) === undefined)
    : [];
  return {
    tokens: front.tokens,
    parts,
    referenceScreens,
    unresolved,
    problems: [...front.problems, ...partProblems, ...unresolved.map(({ reference, where }) => `unresolved reference {${reference}} in ${where}`)],
  };
}
