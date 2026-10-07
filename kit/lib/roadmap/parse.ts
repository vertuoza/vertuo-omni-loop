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
 *
 * Whether the rows hold together (ids, blockers, waves, specs, targets) is `grade.ts`'s question.
 */
import { z } from 'zod';
import { parseFrontMatterLines } from '../front-matter.ts';
import { IssueNumberSchema, parsePrd } from '../ids.ts';
import type { IssueNumber, PrdNumber } from '../ids.ts';
import { group } from '../narrow.ts';
import { KIT_MESSAGES } from '../schema/messages.ts';

/** The PRDs table's columns; a plan repository's roadmap adds `repos`. */
export const PRD_COLUMNS = ['id', 'PRD', 'title', 'blocked by', 'why', 'wave'] as const;

/** The Open questions table's columns. */
export const QUESTION_COLUMNS = ['id', 'question', 'recommendation', 'blocks', 'kind'] as const;

/** `default` runs on the recommendation; `person` parks what it blocks until a person answers. */
export const QUESTION_KINDS = ['default', 'person'] as const;

export type QuestionKind = (typeof QUESTION_KINDS)[number];

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
};

export type RoadmapParse = { ok: true; roadmap: Roadmap } | { ok: false; errors: string[] };

const FRONT_MATTER_BLOCK = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
const SEPARATOR_ROW = /^\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?$/;
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

type Section = { name: string; lines: string[] };
type Table = { header: string[]; rows: string[][] };

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

/** The body's `## ` sections, in the order written. */
function sectionsOf(body: string): Section[] {
  const sections: Section[] = [];
  let current: Section | null = null;
  for (const line of body.split(/\r?\n/)) {
    const heading = /^##\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading && !line.startsWith('###')) {
      current = { name: group(heading, 1), lines: [] };
      sections.push(current);
    } else if (/^#\s/.test(line)) {
      current = null;
    } else if (current) {
      current.lines.push(line);
    }
  }
  return sections;
}

/** A table row's cells, trimmed; a `\|` is a pipe inside a cell. */
function cells(line: string): string[] {
  let inner = line.trim();
  if (inner.startsWith('|')) inner = inner.slice(1);
  if (inner.endsWith('|') && !inner.endsWith('\\|')) inner = inner.slice(0, -1);
  return inner.split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, '|'));
}

/** The first table among `lines`, or `null` with none. */
function firstTable(lines: readonly string[]): Table | null {
  const start = lines.findIndex((line) => line.trim().startsWith('|'));
  if (start === -1) return null;
  const block: string[] = [];
  for (const line of lines.slice(start)) {
    if (!line.trim().startsWith('|')) break;
    block.push(line.trim());
  }
  const [header = '', ...rest] = block;
  return { header: cells(header), rows: rest.filter((line) => !SEPARATOR_ROW.test(line)).map(cells) };
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
    const label = rowLabel(id, index);
    const rowFaults: string[] = [];
    if (!ID_CELL.test(id)) rowFaults.push(`PRDs: ${label} has the id "${id}", which is empty or holds a space, a comma or a pipe.`);
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
    const label = rowLabel(id, index);
    const rowFaults: string[] = [];
    if (!ID_CELL.test(id)) rowFaults.push(`Open questions: ${label} has the id "${id}", which is empty or holds a space, a comma or a pipe.`);
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

/** Parses one roadmap.md (`text`, the file's text) into a typed record, or every fault it has. */
export function parseRoadmap(text: string): RoadmapParse {
  const block = FRONT_MATTER_BLOCK.exec(text);
  if (!block) return { ok: false, errors: ['no front matter: a roadmap.md opens with a "---" fenced header.'] };
  const [, raw = '', body = ''] = block;
  const front = frontMatter(raw);
  const sections = sectionsOf(body);
  const prds = prdsOf(sections.find((section) => section.name === 'PRDs'));
  const questions = questionsOf(sections.find((section) => section.name === 'Open questions'));
  const errors = [...front.errors, ...prds.faults, ...questions.faults];
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
    },
  };
}

/** The roadmap's waves, in order, each with its rows in table order. */
export function roadmapWaves(roadmap: Pick<Roadmap, 'prds'>): { wave: number; rows: RoadmapRow[] }[] {
  const waves = [...new Set(roadmap.prds.map((row) => row.wave))].sort((a, b) => a - b);
  return waves.map((wave) => ({ wave, rows: roadmap.prds.filter((row) => row.wave === wave) }));
}
