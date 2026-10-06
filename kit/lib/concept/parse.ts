/**
 * **A concept can be proven** (PRD 686, slice s1): the one parser for a concept's `concept.md`.
 *
 * `/omni:think-big` records a vast idea as a concept in the inbox, and `/omni:brainstorm --concept`
 * reads it back one area at a time. Pure: markdown text in, a typed record or every fault out, each
 * fault one line a person can act on. What must hold:
 *
 * 1. Front matter holding exactly `concept` (the concept's issue number), `title`, `kind` (one of
 *    {@link CONCEPT_KINDS}) and `scale` (one of {@link CONCEPT_SCALES}), validated by one schema.
 * 2. The six `## ` sections of {@link CONCEPT_SECTIONS}, each present, in that order. Any other
 *    heading is prose the concept may hold.
 * 3. Under **Areas**, a table with the four columns of {@link AREA_COLUMNS}, whose rows are the areas
 *    in build order, the wedge first: kebab-case ids with no duplicate, two to six rows for a vast
 *    concept and one for a lite one, and each `PRD` cell empty or `#<number>`.
 */
import { z } from 'zod';
import { parseFrontMatterLines } from '../front-matter.ts';
import { KIT_MESSAGES } from '../schema/messages.ts';
import { at, defined, group } from '../narrow.ts';
import { parsePrd } from '../ids.ts';
import type { PrdNumber } from '../ids.ts';

/** What the idea changes: a new experience, how the product looks, or how it is built. */
export const CONCEPT_KINDS = ['product', 'identity', 'platform'] as const;

/** A vast idea holds several PRDs; a lite run ends in a concept of one area. */
export const CONCEPT_SCALES = ['vast', 'lite'] as const;

/** The sections of a concept.md, in order. */
export const CONCEPT_SECTIONS = ['The brief', 'The vision', 'Why this one', 'Killed and why', 'Fuel', 'Areas'] as const;

/** The Areas table's columns: `PRD` stays empty until the area's brainstorm fills it. */
export const AREA_COLUMNS = ['id', 'area', 'brief', 'PRD'] as const;

export type ConceptKind = (typeof CONCEPT_KINDS)[number];
export type ConceptScale = (typeof CONCEPT_SCALES)[number];
type AreaColumn = (typeof AREA_COLUMNS)[number];

/** One row of the Areas table, in build order. */
export type ConceptArea = { id: string; area: string; brief: string; prd: PrdNumber | null };

/** A concept.md, parsed. */
export type ConceptRecord = {
  concept: number;
  title: string;
  kind: ConceptKind;
  scale: ConceptScale;
  sections: Record<string, string>;
  areas: ConceptArea[];
};

export type ConceptParse = { ok: true; record: ConceptRecord } | { ok: false; errors: string[] };

/** An area as read from its row: a cell is `undefined` while the table lacks its column. */
type AreaRow = { id: string | undefined; area: string | undefined; brief: string | undefined; prd: PrdNumber | null };

type Section = { name: string; lines: string[] };

const KNOWN_SCALES: readonly unknown[] = CONCEPT_SCALES;
const isScale = (value: unknown): value is ConceptScale => KNOWN_SCALES.includes(value);

/** How many areas each scale allows. */
const AREA_ROWS: Record<ConceptScale, { min: number; max: number; words: string }> = { vast: { min: 2, max: 6, words: 'two to six' }, lite: { min: 1, max: 1, words: 'exactly one' } };

const FRONT_FIELDS = ['concept', 'title', 'kind', 'scale'] as const;
const FRONT_MATTER_BLOCK = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PRD_CELL = /^#([1-9]\d*)$/;
const SEPARATOR_ROW = /^\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?$/;

const FrontMatterSchema = z
  .object({
    concept: z.string().regex(/^[1-9]\d*$/).transform(Number),
    title: z.string().trim().min(1),
    kind: z.enum(CONCEPT_KINDS),
    scale: z.enum(CONCEPT_SCALES),
  })
  .strict();

/** The fault a field's value has, in words. */
function fieldFault(field: (typeof FRONT_FIELDS)[number], value: string | undefined): string {
  if (value === undefined) return `no "${field}" field.`;
  if (field === 'concept') return `concept is "${value}", not a positive whole number (the concept's issue).`;
  if (field === 'title') return 'title is empty.';
  const allowed: readonly string[] = field === 'kind' ? CONCEPT_KINDS : CONCEPT_SCALES;
  return `${field} is "${value}", not one of ${allowed.join(', ')}.`;
}

/** The front matter, typed (`null` when it fails), its faults, and the scale it names when known. */
function frontMatter(raw: string): { data: z.infer<typeof FrontMatterSchema> | null; errors: string[]; scale: ConceptScale | null } {
  const { data, errors: lineErrors } = parseFrontMatterLines(raw);
  const errors = lineErrors.map((message) => `front matter: ${message}.`);
  const scale = isScale(data.scale) ? data.scale : null;
  const parsed = FrontMatterSchema.safeParse(data, { error: KIT_MESSAGES });
  if (parsed.success) return { data: parsed.data, errors, scale };
  for (const issue of parsed.error.issues) {
    if (issue.code === 'unrecognized_keys') {
      for (const key of issue.keys) errors.push(`front matter: unexpected field "${key}"; it holds only concept, title, kind and scale.`);
    }
  }
  const faulty = new Set(parsed.error.issues.map((issue) => issue.path[0]).filter(Boolean));
  for (const field of FRONT_FIELDS.filter((name) => faulty.has(name))) errors.push(`front matter: ${fieldFault(field, data[field])}`);
  return { data: null, errors, scale };
}

/** The body's `## ` sections, in the order written, as `{ name, lines }`; the first of a name wins. */
function sectionsOf(body: string): Section[] {
  const sections: Section[] = [];
  let current: Section | null = null;
  for (const line of body.split(/\r?\n/)) {
    const heading = /^##\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading && !line.startsWith('###')) {
      current = { name: group(heading, 1), lines: [] }; // group 1 always matches
      sections.push(current);
    } else if (/^#\s/.test(line)) {
      current = null;
    } else if (current) {
      current.lines.push(line);
    }
  }
  return sections;
}

function sectionFaults(sections: readonly Section[]): string[] {
  const position = new Map<string, number>();
  sections.forEach((section, index) => {
    if (!position.has(section.name)) position.set(section.name, index);
  });
  const faults = CONCEPT_SECTIONS.filter((name) => !position.has(name)).map((name) => `sections: no "## ${name}" section.`);
  const present = CONCEPT_SECTIONS.filter((name) => position.has(name));
  for (let index = 1; index < present.length; index += 1) {
    const [before, after] = [at(present, index - 1, 'a section'), at(present, index, 'a section')]; // both indexes are inside `present`
    const placeOf = (name: string): number => defined(position.get(name), `the place of "## ${name}"`); // `present` holds only names `position` has
    if (placeOf(after) < placeOf(before)) {
      faults.push(`sections: "## ${before}" comes after "## ${after}"; the order is ${CONCEPT_SECTIONS.join(', ')}.`);
    }
  }
  return faults;
}

/** A table row's cells, trimmed; a `\|` is a pipe inside a cell. */
function cells(line: string): string[] {
  let inner = line.trim();
  if (inner.startsWith('|')) inner = inner.slice(1);
  if (inner.endsWith('|') && !inner.endsWith('\\|')) inner = inner.slice(0, -1);
  return inner.split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, '|'));
}

/** The first table among `lines`: its header's cells and its rows' cells, or `null` with none. */
function firstTable(lines: readonly string[]): { header: string[]; rows: string[][] } | null {
  const start = lines.findIndex((line) => line.trim().startsWith('|'));
  if (start === -1) return null;
  const block: string[] = [];
  for (const line of lines.slice(start)) {
    if (!line.trim().startsWith('|')) break;
    block.push(line.trim());
  }
  const [header = '', ...rest] = block; // the line at `start` opens the block
  return { header: cells(header), rows: rest.filter((line) => !SEPARATOR_ROW.test(line)).map(cells) };
}

/** An id listed twice, once; else an id that is not kebab-case. A missing id column reads `undefined`. */
function idFaults(ids: readonly (string | undefined)[]): string[] {
  const seen = new Set<string>();
  const twice = new Set<string>();
  const faults: string[] = [];
  for (const id of ids) {
    if (id === undefined) continue;
    if (seen.has(id)) {
      if (!twice.has(id)) faults.push(`Areas: id "${id}" is listed twice.`);
      twice.add(id);
    } else if (!KEBAB.test(id)) {
      faults.push(`Areas: id "${id}" is not kebab-case.`);
    }
    seen.add(id);
  }
  return faults;
}

function areasOf(lines: readonly string[], scale: ConceptScale | null): { areas: AreaRow[]; faults: string[] } {
  const table = firstTable(lines);
  if (!table) return { areas: [], faults: [`Areas: no table; it holds one with the columns ${AREA_COLUMNS.slice(0, -1).join(', ')} and ${AREA_COLUMNS.at(-1)}.`] };
  const positions = new Map(AREA_COLUMNS.map((name) => [name, table.header.findIndex((cell) => cell.toLowerCase() === name.toLowerCase())]));
  const column = (name: AreaColumn): number => positions.get(name) ?? -1;
  const faults = AREA_COLUMNS.filter((name) => column(name) === -1).map((name) => `Areas: the table has no "${name}" column.`);
  const cell = (row: readonly string[], name: AreaColumn): string | undefined => (column(name) === -1 ? undefined : (row[column(name)] ?? ''));

  const areas = table.rows.map((row, index): AreaRow => {
    const id = cell(row, 'id');
    const prd = cell(row, 'PRD');
    const filled = PRD_CELL.exec(prd ?? '');
    if (prd && !filled) faults.push(`Areas: the PRD cell of "${id ?? `row ${index + 1}`}" is "${prd}", neither empty nor #<number>.`);
    return { id, area: cell(row, 'area'), brief: cell(row, 'brief'), prd: filled ? parsePrd(at(filled, 1, 'the PRD cell')) : null };
  });
  faults.push(...idFaults(areas.map((area) => area.id)));

  const allowed = scale ? AREA_ROWS[scale] : undefined;
  if (allowed && (areas.length < allowed.min || areas.length > allowed.max)) {
    const count = areas.length === 0 ? 'no area' : `${areas.length} area${areas.length === 1 ? '' : 's'}`;
    faults.push(`Areas: ${count}; a ${scale} concept has ${allowed.words}.`);
  }
  return { areas, faults };
}

/** An area of a table with every column, where each cell is a string. */
function conceptArea({ id, area, brief, prd }: AreaRow): ConceptArea {
  return { id: defined(id, 'the area id'), area: defined(area, 'the area name'), brief: defined(brief, 'the area brief'), prd };
}

/** Parses one concept.md (`text`, the file's text) into a typed record, or every fault it has. */
export function parseConcept(text: string): ConceptParse {
  const block = FRONT_MATTER_BLOCK.exec(text);
  if (!block) return { ok: false, errors: ['no front matter: a concept.md opens with a "---" fenced header.'] };
  const [, raw = '', body = ''] = block; // both groups always match
  const front = frontMatter(raw);
  const sections = sectionsOf(body);
  const errors = [...front.errors, ...sectionFaults(sections)];

  const areasSection = sections.find((section) => section.name === 'Areas');
  const { areas, faults } = areasSection ? areasOf(areasSection.lines, front.scale) : { areas: [], faults: [] };
  errors.push(...faults);
  if (errors.length) return { ok: false, errors };

  const named = new Map<string, string>();
  for (const section of sections) if (!named.has(section.name)) named.set(section.name, section.lines.join('\n').trim());
  // With no fault, the front matter parsed, every section is present and the table has every column.
  const data = defined(front.data, 'the parsed front matter');
  return {
    ok: true,
    record: { ...data, sections: Object.fromEntries(CONCEPT_SECTIONS.map((name) => [name, named.get(name) ?? ''])), areas: areas.map(conceptArea) },
  };
}
