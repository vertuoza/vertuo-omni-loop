// PRD 2898, s1: a spec's acceptance criteria as numbered scenarios. Each is a heading
// `### AC-<n> · <kind>` followed by a ```gherkin block holding its Scenario and its Given, When and
// Then lines; the kind says what proves it (`test`, a vitest test titled `AC-<n>: …`, or `e2e`, the
// scenario run against the pull request's preview). A spec of plain bullets holds none, and is no
// problem here: `omni check inbox` reads it as before, and the ready rule fails its check 3.
//
// Pure: text in, criteria and problems out. A heading inside a fence (an example in the spec's own
// prose) is never one.

/** What proves a criterion: a vitest test, or the scenario run with e2e against the preview. */
export const AC_KINDS = ['test', 'e2e'] as const;

/** A criterion's kind. */
type AcKind = (typeof AC_KINDS)[number];

/** The keywords of a scenario's steps. */
const STEP_KEYWORDS = ['Given', 'When', 'Then', 'And', 'But'] as const;

/** The three a scenario must hold, each at least once. */
const REQUIRED_STEPS = ['Given', 'When', 'Then'] as const;

/** One step of a scenario: its keyword and the words after it. */
type ScenarioStep = { keyword: (typeof STEP_KEYWORDS)[number]; text: string };

/** One criterion, read whole. */
export type Criterion = {
  number: number;
  kind: AcKind;
  /** The words after `Scenario:`, or null when the block names none. */
  scenario: string | null;
  steps: ScenarioStep[];
  /** The gherkin block's lines, verbatim, blank lines left out. */
  lines: string[];
};

/** Why one criterion cannot be read: `criterion` names it (`AC-3`, or `AC` with no number), `line`
 * is its heading's, counted from 1. */
type CriterionProblem = { criterion: string; line: number; problem: string };

/** The criteria a spec holds, in its order, and what is wrong with the others. */
export type ParsedCriteria = { criteria: Criterion[]; problems: CriterionProblem[] };

const HEADING = /^###\s+AC\b(.*)$/;
const ANY_HEADING = /^#{1,6}\s/;
const FENCE = /^\s*(`{3,}|~{3,})\s*([^\s`]*)/;
const NUMBERED = /^-(\d+)\b\s*(.*)$/;
const KIND = /^·\s*(\S+)\s*$/;
const STEP = new RegExp(`^(${STEP_KEYWORDS.join('|')})\\b\\s*(.*)$`);
const SCENARIO = /^Scenario(?: Outline)?:\s*(.*)$/;
const TITLE = /^AC-([1-9]\d*):/;

/** A line of the spec, by where it sits: prose, a fence's opening line (with its info string), a line
 * inside a fence, or a fence's closing line. */
type Line = { text: string; index: number; kind: 'prose' | 'open' | 'inside' | 'close'; info: string };

/** A fence marker on a line: its character, its length and its info string. */
type Fence = { char: string; length: number; info: string };

function fenceOf(line: string): Fence | null {
  const match = FENCE.exec(line);
  if (!match) return null;
  const marker = match[1] ?? '';
  return { char: marker.charAt(0), length: marker.length, info: match[2] ?? '' };
}

/** Whether `fence` closes the fence `open` opened: the same character, at least as long, no info. */
function closes(open: Fence, fence: Fence | null): boolean {
  return fence !== null && fence.char === open.char && fence.length >= open.length && fence.info === '';
}

/** Every line, with where it sits. */
function readLines(text: string): Line[] {
  let open: Fence | null = null;
  return text.split('\n').map((raw, index): Line => {
    const text = raw.replace(/\r$/, '');
    const fence = fenceOf(text);
    if (open === null) {
      open = fence;
      return { text, index, kind: fence === null ? 'prose' : 'open', info: fence?.info ?? '' };
    }
    if (closes(open, fence)) {
      open = null;
      return { text, index, kind: 'close', info: '' };
    }
    return { text, index, kind: 'inside', info: '' };
  });
}

/** Where the first ```gherkin block from `start` opens, before the next heading; null when none does. */
function gherkinOpening(lines: readonly Line[], start: number): number | null {
  for (const line of lines.slice(start)) {
    if (line.kind === 'open' && line.info === 'gherkin') return line.index;
    if (line.kind === 'prose' && ANY_HEADING.test(line.text)) return null;
  }
  return null;
}

/** The lines of the first ```gherkin block from `start` up to the next heading, blank ones left out,
 * or null. */
function gherkinBlock(lines: readonly Line[], start: number): string[] | null {
  const opening = gherkinOpening(lines, start);
  if (opening === null) return null;
  const block: string[] = [];
  for (const line of lines.slice(opening + 1)) {
    if (line.kind !== 'inside') break;
    if (line.text.trim() !== '') block.push(line.text);
  }
  return block;
}

/** The step one line of a block holds, or null. */
function stepOf(line: string): ScenarioStep | null {
  const step = STEP.exec(line);
  const keyword = STEP_KEYWORDS.find((word) => word === step?.[1]);
  return keyword === undefined ? null : { keyword, text: (step?.[2] ?? '').trim() };
}

/** The scenario's name and steps, read from its block's lines. */
function readScenario(block: readonly string[]): { scenario: string | null; steps: ScenarioStep[] } {
  const named = block.map((line) => SCENARIO.exec(line.trim())).find((match) => match !== null);
  const steps = block.map((line) => stepOf(line.trim())).filter((step) => step !== null);
  return { scenario: (named?.[1] ?? '').trim() || null, steps };
}

/** What a heading's text after `AC` says: its number and its kind, or the problem with it. */
function readHeading(rest: string): { number: number; kind: AcKind } | { number: number | null; problem: string } {
  const numbered = NUMBERED.exec(rest);
  if (!numbered) return { number: null, problem: 'an AC- heading with no number: write ### AC-<n> · test' };
  const number = Number(numbered[1]);
  const name = `AC-${number}`;
  const kind = KIND.exec((numbered[2] ?? '').trim());
  if (!kind) return { number, problem: `${name} has no kind: write ### ${name} · test or ### ${name} · e2e` };
  const word = kind[1] ?? '';
  const known = AC_KINDS.find((candidate) => candidate === word);
  if (known === undefined) return { number, problem: `${name} has the kind "${word}": its kind is ${AC_KINDS.join(' or ')}` };
  return { number, kind: known };
}

/** The criterion a well-formed heading opens, or the problem with its block. */
function readBody(lines: readonly Line[], at: number, { number, kind }: { number: number; kind: AcKind }): Criterion | string {
  const name = `AC-${number}`;
  const block = gherkinBlock(lines, at + 1);
  if (block === null) return `${name} has no gherkin scenario: a \`\`\`gherkin block under its heading`;
  const { scenario, steps } = readScenario(block);
  const missing = REQUIRED_STEPS.filter((keyword) => !steps.some((step) => step.keyword === keyword));
  if (missing.length > 0) return `${name} has ${missing.map((keyword) => `no ${keyword}`).join(', ')}`;
  return { number, kind, scenario, steps, lines: block };
}

/** How a problem names the criterion a heading's text after `AC` opens: `AC-3`, or `AC` with no number. */
function criterionName(rest: string): string {
  const numbered = NUMBERED.exec(rest);
  return numbered ? `AC-${Number(numbered[1])}` : 'AC';
}

/** The criterion the heading on line `at` opens, or the problem with it; `seen` holds the numbers read. */
function readCriterion(lines: readonly Line[], at: number, rest: string, seen: Set<number>): Criterion | string {
  const read = readHeading(rest);
  if (read.number !== null && seen.has(read.number)) return `AC-${read.number} is written twice`;
  if (read.number !== null) seen.add(read.number);
  return 'problem' in read ? read.problem : readBody(lines, at, read);
}

/**
 * The criteria a spec's `### AC-<n> · <kind>` headings hold, and each problem with one: a heading
 * with no number, a number written twice (its first criterion is kept), a kind missing or not one of
 * `AC_KINDS`, no ```gherkin block before the next heading, or a scenario without a Given, a When or
 * a Then. A criterion with a problem is left out of `criteria`.
 */
export function parseCriteria(spec: string): ParsedCriteria {
  const lines = readLines(spec);
  const parsed: ParsedCriteria = { criteria: [], problems: [] };
  const seen = new Set<number>();
  for (const line of lines) {
    const heading = line.kind === 'prose' ? HEADING.exec(line.text) : null;
    if (heading === null) continue;
    const rest = heading[1] ?? '';
    const read = readCriterion(lines, line.index, rest, seen);
    if (typeof read !== 'string') parsed.criteria.push(read);
    else parsed.problems.push({ criterion: criterionName(rest), line: line.index + 1, problem: read });
  }
  return parsed;
}

/** The criterion a test title proves: `AC-3: …` is 3; any other title proves none. */
export function acNumberOfTitle(title: string): number | null {
  const match = TITLE.exec(title);
  return match ? Number(match[1]) : null;
}
