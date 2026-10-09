/**
 * **A roadmap is read** (PRD 1162, slice s4): the one parser for a roadmap's `roadmap.md`.
 *
 * A roadmap is a milestone delivered by a set of PRDs ordered by their blockers. Pure: markdown text
 * in, a typed record or every fault out, each fault one line a person can act on. What must hold:
 *
 * 1. Front matter holding `roadmap` (the roadmap issue's number), `title` and `milestone`, and
 *    optionally `product`, `target` (a `YYYY-MM-DD` date a person gave) and `source` (where it was
 *    read from); nothing else.
 * 2. A `## PRDs` section whose first table has the columns of {@link PRD_COLUMNS}, plus `repos` in a
 *    plan repository's roadmap. A `PRD` cell is `#<number>`, a `wave` a positive whole number, a
 *    `repos` or `blocked by` cell a comma-separated list, and a dash or an empty cell means none.
 * 3. An optional `## Open questions` section; its table, when it has one, has the columns of
 *    {@link QUESTION_COLUMNS}, and each `kind` is one of {@link QUESTION_KINDS}.
 * 4. An optional `## Prerequisites` section (PRD 1218); its table, when it has one, has the columns
 *    of {@link PREREQUISITE_COLUMNS} (plus `repos` in a plan repository), each `category` one of
 *    {@link PREREQUISITE_CATEGORIES}, each `who` one of {@link PREREQUISITE_WHO}, and `blocks` is
 *    `all` or a list of ids. Under the table, a `### <id>` card per row, its lines labelled as
 *    {@link CARD_LINES} says; a card for no row is refused.
 *
 * Whether the rows hold together (ids, blockers, waves, specs, targets) is `grade.ts`'s question.
 */
import { z } from 'zod';
import { parseFrontMatterLines } from '../front-matter.ts';
import { IssueNumberSchema, parsePrd } from '../ids.ts';
import type { IssueNumber, PrdNumber } from '../ids.ts';
import { firstTable, sectionsOf } from '../markdown-body.ts';
import type { MarkdownSection as Section, MarkdownTable as Table } from '../markdown-body.ts';
import { group } from '../narrow.ts';
import { KIT_MESSAGES } from '../schema/messages.ts';

/** The PRDs table's columns; a plan repository's roadmap adds `repos`. */
const PRD_COLUMNS = ['id', 'PRD', 'title', 'blocked by', 'why', 'wave'] as const;

/** The Open questions table's columns. */
const QUESTION_COLUMNS = ['id', 'question', 'recommendation', 'blocks', 'kind'] as const;

/** `default` runs on the recommendation; `person` parks what it blocks until a person answers. */
const QUESTION_KINDS = ['default', 'person'] as const;

export type QuestionKind = (typeof QUESTION_KINDS)[number];

/** The Prerequisites table's columns; a plan repository's roadmap may add `repos`. */
const PREREQUISITE_COLUMNS = ['id', 'category', 'need', 'check', 'fix', 'blocks', 'who'] as const;

/** Where a prerequisite holds: the machine, a registry, a grant, GitHub, a service. */
export const PREREQUISITE_CATEGORIES = ['local', 'access', 'permissions', 'github', 'services'] as const;

/** `agent` checks and fixes it, `check` is checked and fixed by a person, `person` is ticked by one. */
export const PREREQUISITE_WHO = ['agent', 'check', 'person'] as const;

export type PrerequisiteCategory = (typeof PREREQUISITE_CATEGORIES)[number];
export type PrerequisiteWho = (typeof PREREQUISITE_WHO)[number];

/** An author card's four lines; a line the card does not write is `null`. */
export type PrerequisiteCard = { why: string | null; command: string | null; whatItDoes: string | null; whoCanDoIt: string | null };

/** A card's labels, as written, by the field each fills. */
export const CARD_LINES = [
  ['why', 'Why'],
  ['command', 'Command'],
  ['whatItDoes', 'What it does'],
  ['whoCanDoIt', 'Who can do it'],
] as const satisfies readonly (readonly [keyof PrerequisiteCard, string])[];

/**
 * One prerequisite. `check` and `fix` are the cells unquoted (`base:<name>` or a shell command), `null`
 * when empty; `blocks` is `'all'` or PRD row ids; `repos` is `null` when the table has no `repos`
 * column; `card` is its `### <id>` card, `null` when it has none.
 */
export type RoadmapPrerequisite = {
  id: string;
  category: PrerequisiteCategory;
  need: string;
  check: string | null;
  fix: string | null;
  blocks: 'all' | string[];
  who: PrerequisiteWho;
  repos: string[] | null;
  card: PrerequisiteCard | null;
};

/** One PRD of the roadmap. `repos` is `null` when the table has no `repos` column. */
export type RoadmapRow = {
  id: string;
  prd: PrdNumber;
  title: string;
  repos: string[] | null;
  blockedBy: string[];
  why: string | null;
  wave: number;
};

/** One open question, and the rows it blocks. */
export type RoadmapQuestion = { id: string; question: string; recommendation: string; blocks: string[]; kind: QuestionKind };

/** A roadmap.md, parsed. */
export type Roadmap = {
  roadmap: IssueNumber;
  title: string;
  milestone: string;
  product: string | null;
  target: string | null;
  source: string | null;
  /** Whether the PRDs table has a `repos` column. */
  repos: boolean;
  prds: RoadmapRow[];
  questions: RoadmapQuestion[];
  /** The `## Prerequisites` rows, none without the section. Always set by the parser; optional so a
   * roadmap built by hand (a test's) need not name it. */
  prerequisites?: RoadmapPrerequisite[];
};

export type RoadmapParse = { ok: true; roadmap: Roadmap } | { ok: false; errors: string[] };

const FRONT_MATTER_BLOCK = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
const PRD_CELL = /^#([1-9]\d*)$/;
const WAVE_CELL = /^[1-9]\d*$/;
/** A cell that means "none": empty, a dash of any width, or the word. */
const NONE_CELL = /^(?:|-|–|—|none)$/i;
const ID_CELL = /^[^\s,|]+$/;

const optionalText = z.string().trim().min(1).optional();
const FrontMatterSchema = z
  .object({
    roadmap: z.string().regex(/^[1-9]\d*$/, "the roadmap issue's number").transform(Number).pipe(IssueNumberSchema),
    title: z.string().trim().min(1),
    milestone: z.string().trim().min(1),
    product: optionalText,
    target: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'a YYYY-MM-DD date').optional(),
    source: optionalText,
  })
  .strict();

/** The front matter, typed (`null` when it fails), and its faults. */
function frontMatter(raw: string): { data: z.infer<typeof FrontMatterSchema> | null; errors: string[] } {
  const { data, errors: lineErrors } = parseFrontMatterLines(raw);
  const errors = lineErrors.map((message) => `front matter: ${message}.`);
  const parsed = FrontMatterSchema.safeParse(data, { error: KIT_MESSAGES });
  if (parsed.success) return { data: parsed.data, errors };
  for (const issue of parsed.error.issues) {
    if (issue.code === 'unrecognized_keys') {
      for (const key of issue.keys) {
        errors.push(`front matter: unexpected field "${key}"; it holds roadmap, title, milestone, and an optional product, target and source.`);
      }
      continue;
    }
    const field = String(issue.path[0] ?? '(front matter)');
    const value = data[field];
    errors.push(value === undefined ? `front matter: no "${field}" field.` : `front matter: ${field} is "${value}": ${issue.message}.`);
  }
  return { data: null, errors };
}

/** A comma-separated cell's entries; a "none" cell has none. */
function listCell(cell: string): string[] {
  if (NONE_CELL.test(cell)) return [];
  return cell.split(',').map((entry) => entry.trim()).filter((entry) => entry !== '');
}

/** Reads a table's cells by column name; `faults` names each column the table lacks. */
function columns(table: Table, wanted: readonly string[], where: string) {
  const position = (name: string) => table.header.findIndex((cell) => cell.toLowerCase() === name.toLowerCase());
  const faults = wanted.filter((name) => position(name) === -1).map((name) => `${where}: the table has no "${name}" column.`);
  const cell = (row: readonly string[], name: string): string => row[position(name)] ?? '';
  return { faults, has: (name: string) => position(name) !== -1, cell };
}

/** The label a fault names a row by: its id, else its place. */
function rowLabel(id: string, index: number): string {
  return id === '' ? `row ${index + 1}` : id;
}

/** A row's label, and its first fault when its id is empty or holds a space, a comma or a pipe. */
function rowOpening(id: string, index: number, where: string): { label: string; rowFaults: string[] } {
  const label = rowLabel(id, index);
  const rowFaults = ID_CELL.test(id) ? [] : [`${where}: ${label} has the id "${id}", which is empty or holds a space, a comma or a pipe.`];
  return { label, rowFaults };
}

/** The faults of a list cell's entries that are no id. */
function idListFaults(entries: readonly string[], where: string): string[] {
  return entries.filter((entry) => !ID_CELL.test(entry)).map((entry) => `${where} "${entry}", which is no id.`);
}

function prdsOf(section: Section | undefined): { rows: RoadmapRow[]; repos: boolean; faults: string[] } {
  if (!section) return { rows: [], repos: false, faults: ['sections: no "## PRDs" section.'] };
  const table = firstTable(section.lines);
  if (!table) return { rows: [], repos: false, faults: [`PRDs: no table; it holds one with the columns ${PRD_COLUMNS.join(', ')}.`] };
  const { faults, has, cell } = columns(table, PRD_COLUMNS, 'PRDs');
  if (faults.length > 0) return { rows: [], repos: false, faults };
  const repos = has('repos');
  const rows: RoadmapRow[] = [];
  table.rows.forEach((row, index) => {
    const id = cell(row, 'id');
    const { label, rowFaults } = rowOpening(id, index, 'PRDs');
    const prdCell = PRD_CELL.exec(cell(row, 'PRD'));
    if (!prdCell) rowFaults.push(`PRDs: ${label} has the PRD cell "${cell(row, 'PRD')}", not #<number>.`);
    const title = cell(row, 'title');
    if (title === '') rowFaults.push(`PRDs: ${label} has no title.`);
    const waveCell = cell(row, 'wave');
    if (!WAVE_CELL.test(waveCell)) rowFaults.push(`PRDs: ${label} has the wave "${waveCell}", not a positive whole number.`);
    const blockedBy = listCell(cell(row, 'blocked by'));
    rowFaults.push(...idListFaults(blockedBy, `PRDs: ${label} is blocked by`));
    const why = cell(row, 'why');
    faults.push(...rowFaults);
    if (rowFaults.length > 0 || !prdCell) return;
    rows.push({
      id,
      prd: parsePrd(group(prdCell, 1)),
      title,
      repos: repos ? listCell(cell(row, 'repos')) : null,
      blockedBy,
      why: NONE_CELL.test(why) ? null : why,
      wave: Number(waveCell),
    });
  });
  return { rows, repos, faults };
}

function questionsOf(section: Section | undefined): { questions: RoadmapQuestion[]; faults: string[] } {
  const table = section ? firstTable(section.lines) : null;
  if (!table) return { questions: [], faults: [] };
  const { faults, cell } = columns(table, QUESTION_COLUMNS, 'Open questions');
  if (faults.length > 0) return { questions: [], faults };
  const questions: RoadmapQuestion[] = [];
  table.rows.forEach((row, index) => {
    const id = cell(row, 'id');
    const { label, rowFaults } = rowOpening(id, index, 'Open questions');
    const question = cell(row, 'question');
    if (question === '') rowFaults.push(`Open questions: ${label} asks nothing: its question is empty.`);
    const kind = cell(row, 'kind');
    const known: readonly string[] = QUESTION_KINDS;
    if (!known.includes(kind)) rowFaults.push(`Open questions: ${label} has the kind "${kind}", not one of ${QUESTION_KINDS.join(', ')}.`);
    const blocks = listCell(cell(row, 'blocks'));
    rowFaults.push(...idListFaults(blocks, `Open questions: ${label} blocks`));
    faults.push(...rowFaults);
    if (rowFaults.length > 0) return;
    const typed = QUESTION_KINDS.find((name) => name === kind) ?? 'default';
    questions.push({ id, question, recommendation: cell(row, 'recommendation'), blocks, kind: typed });
  });
  return { questions, faults };
}

/** A cell with its surrounding backticks dropped; a "none" cell is `null`. */
function codeCell(cell: string): string | null {
  if (NONE_CELL.test(cell)) return null;
  return /^`([^`]*)`$/.exec(cell)?.[1]?.trim() ?? cell;
}

const CARD_HEADING = /^###\s+(.+?)\s*#*\s*$/;
const CARD_LINE = /^\s*[-*]\s+\*\*(.+?):\*\*\s*(.*)$/;

/** The field a card's label fills, or `null` for a label that is not one of its four. */
function cardField(label: string): keyof PrerequisiteCard | null {
  const wanted = label.trim().toLowerCase();
  return CARD_LINES.find(([, name]) => name.toLowerCase() === wanted)?.[0] ?? null;
}

/** One card from the lines under its heading: each labelled line, its indented lines joined on. */
function cardOf(lines: readonly string[]): PrerequisiteCard {
  const card: PrerequisiteCard = { why: null, command: null, whatItDoes: null, whoCanDoIt: null };
  let field: keyof PrerequisiteCard | null = null;
  for (const line of lines) {
    const labelled = CARD_LINE.exec(line);
    if (labelled) {
      field = cardField(group(labelled, 1));
      if (field !== null) card[field] = group(labelled, 2).trim();
    } else if (line.trim() === '') {
      field = null;
    } else if (field !== null) {
      card[field] = `${card[field] ?? ''} ${line.trim()}`.trim();
    }
  }
  return { ...card, command: card.command === null ? null : codeCell(card.command) };
}

/** The `### <id>` cards among a section's lines, by id. */
function cardsOf(lines: readonly string[]): Map<string, PrerequisiteCard> {
  const blocks: { id: string; lines: string[] }[] = [];
  for (const line of lines) {
    const heading = CARD_HEADING.exec(line);
    if (heading) blocks.push({ id: group(heading, 1), lines: [] });
    else blocks.at(-1)?.lines.push(line);
  }
  return new Map(blocks.map(({ id, lines: under }) => [id, cardOf(under)]));
}

/** One of `names` when `value` is one, else `null`. */
function oneOf<T extends string>(names: readonly T[], value: string): T | null {
  return names.find((name) => name === value) ?? null;
}

type Cell = (row: readonly string[], name: string) => string;
const WHERE = 'Prerequisites';

/** The faults of a cell that must be one of `names`, by its column's name. */
function enumFault(value: string, names: readonly string[], column: string, label: string): string[] {
  return names.includes(value) ? [] : [`${WHERE}: ${label} has the ${column} "${value}", not one of ${names.join(', ')}.`];
}

/** One prerequisite row: the record when it holds, and its faults. */
function prerequisiteRow(row: readonly string[], index: number, cell: Cell): { record: Omit<RoadmapPrerequisite, 'repos' | 'card'> | null; faults: string[] } {
  const id = cell(row, 'id');
  const { label, rowFaults } = rowOpening(id, index, WHERE);
  const category = oneOf(PREREQUISITE_CATEGORIES, cell(row, 'category'));
  const who = oneOf(PREREQUISITE_WHO, cell(row, 'who'));
  const need = cell(row, 'need');
  const blocksCell = cell(row, 'blocks');
  const blocks = blocksCell.toLowerCase() === 'all' ? 'all' : listCell(blocksCell);
  const faults = [
    ...rowFaults,
    ...enumFault(cell(row, 'category'), PREREQUISITE_CATEGORIES, 'category', label),
    ...enumFault(cell(row, 'who'), PREREQUISITE_WHO, 'who', label),
    ...(need === '' ? [`${WHERE}: ${label} needs nothing: its need is empty.`] : []),
    ...(blocks === 'all' ? [] : idListFaults(blocks, `${WHERE}: ${label} blocks`)),
  ];
  if (faults.length > 0 || category === null || who === null) return { record: null, faults };
  return { record: { id, category, need, check: codeCell(cell(row, 'check')), fix: codeCell(cell(row, 'fix')), blocks, who }, faults };
}

function prerequisitesOf(section: Section | undefined): { prerequisites: RoadmapPrerequisite[]; faults: string[] } {
  const table = section ? firstTable(section.lines) : null;
  if (!section || !table) return { prerequisites: [], faults: [] };
  const { faults, has, cell } = columns(table, PREREQUISITE_COLUMNS, WHERE);
  if (faults.length > 0) return { prerequisites: [], faults };
  const cards = cardsOf(section.lines);
  const ids = new Set(table.rows.map((row) => cell(row, 'id')));
  const prerequisites: RoadmapPrerequisite[] = [];
  table.rows.forEach((row, index) => {
    const { record, faults: rowFaults } = prerequisiteRow(row, index, cell);
    faults.push(...rowFaults);
    if (record === null) return;
    prerequisites.push({ ...record, repos: has('repos') ? listCell(cell(row, 'repos')) : null, card: cards.get(record.id) ?? null });
  });
  for (const id of cards.keys()) if (!ids.has(id)) faults.push(`${WHERE}: the card "### ${id}" is for no row of the table.`);
  return { prerequisites, faults };
}

/** Parses one roadmap.md (`text`, the file's text) into a typed record, or every fault it has. */
export function parseRoadmap(text: string): RoadmapParse {
  const block = FRONT_MATTER_BLOCK.exec(text);
  if (!block) return { ok: false, errors: ['no front matter: a roadmap.md opens with a "---" fenced header.'] };
  const [, raw = '', body = ''] = block;
  const front = frontMatter(raw);
  const sections = sectionsOf(body);
  const prds = prdsOf(sections.find((section) => section.name === 'PRDs'));
  const questions = questionsOf(sections.find((section) => section.name === 'Open questions'));
  const prerequisites = prerequisitesOf(sections.find((section) => section.name === 'Prerequisites'));
  const errors = [...front.errors, ...prds.faults, ...questions.faults, ...prerequisites.faults];
  if (errors.length > 0 || front.data === null) return { ok: false, errors };
  const { roadmap, title, milestone, product, target, source } = front.data;
  return {
    ok: true,
    roadmap: {
      roadmap,
      title,
      milestone,
      product: product ?? null,
      target: target ?? null,
      source: source ?? null,
      repos: prds.repos,
      prds: prds.rows,
      questions: questions.questions,
      prerequisites: prerequisites.prerequisites,
    },
  };
}

/** The roadmap's waves, in order, each with its rows in table order. */
export function roadmapWaves(roadmap: Pick<Roadmap, 'prds'>): { wave: number; rows: RoadmapRow[] }[] {
  const waves = [...new Set(roadmap.prds.map((row) => row.wave))].sort((a, b) => a - b);
  return waves.map((wave) => ({ wave, rows: roadmap.prds.filter((row) => row.wave === wave) }));
}
