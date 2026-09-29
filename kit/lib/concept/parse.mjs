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
import { parseFrontMatterLines } from '../inbox/inbox.mjs';

/** What the idea changes: a new experience, how the product looks, or how it is built. */
export const CONCEPT_KINDS = /** @type {const} */ (['product', 'identity', 'platform']);

/** A vast idea holds several PRDs; a lite run ends in a concept of one area. */
export const CONCEPT_SCALES = /** @type {const} */ (['vast', 'lite']);

/** The sections of a concept.md, in order. */
export const CONCEPT_SECTIONS = /** @type {const} */ (['The brief', 'The vision', 'Why this one', 'Killed and why', 'Fuel', 'Areas']);

/** The Areas table's columns: `PRD` stays empty until the area's brainstorm fills it. */
export const AREA_COLUMNS = /** @type {const} */ (['id', 'area', 'brief', 'PRD']);

/** How many areas each scale allows. */
const AREA_ROWS = { vast: { min: 2, max: 6, words: 'two to six' }, lite: { min: 1, max: 1, words: 'exactly one' } };

const FRONT_FIELDS = ['concept', 'title', 'kind', 'scale'];
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
function fieldFault(field, value) {
  if (value === undefined) return `no "${field}" field.`;
  if (field === 'concept') return `concept is "${value}", not a positive whole number (the concept's issue).`;
  if (field === 'title') return 'title is empty.';
  const allowed = field === 'kind' ? CONCEPT_KINDS : CONCEPT_SCALES;
  return `${field} is "${value}", not one of ${allowed.join(', ')}.`;
}

/** The front matter, typed (`null` when it fails), its faults, and the scale it names when known. */
function frontMatter(raw) {
  const { data, errors: lineErrors } = parseFrontMatterLines(raw);
  const errors = lineErrors.map((message) => `front matter: ${message}.`);
  const scale = CONCEPT_SCALES.includes(data.scale) ? data.scale : null;
  const parsed = FrontMatterSchema.safeParse(data);
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
function sectionsOf(body) {
  const sections = [];
  let current = null;
  for (const line of body.split(/\r?\n/)) {
    const heading = /^##\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading && !line.startsWith('###')) {
      current = { name: heading[1], lines: [] };
      sections.push(current);
    } else if (/^#\s/.test(line)) {
      current = null;
    } else if (current) {
      current.lines.push(line);
    }
  }
  return sections;
}

function sectionFaults(sections) {
  const at = new Map();
  sections.forEach((section, index) => {
    if (!at.has(section.name)) at.set(section.name, index);
  });
  const faults = CONCEPT_SECTIONS.filter((name) => !at.has(name)).map((name) => `sections: no "## ${name}" section.`);
  const present = CONCEPT_SECTIONS.filter((name) => at.has(name));
  for (let index = 1; index < present.length; index += 1) {
    const [before, after] = [present[index - 1], present[index]];
    if (at.get(after) < at.get(before)) {
      faults.push(`sections: "## ${before}" comes after "## ${after}"; the order is ${CONCEPT_SECTIONS.join(', ')}.`);
    }
  }
  return faults;
}

/** A table row's cells, trimmed; a `\|` is a pipe inside a cell. */
function cells(line) {
  let inner = line.trim();
  if (inner.startsWith('|')) inner = inner.slice(1);
  if (inner.endsWith('|') && !inner.endsWith('\\|')) inner = inner.slice(0, -1);
  return inner.split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, '|'));
}

/** The first table among `lines`: its header's cells and its rows' cells, or `null` with none. */
function firstTable(lines) {
  const start = lines.findIndex((line) => line.trim().startsWith('|'));
  if (start === -1) return null;
  const block = [];
  for (const line of lines.slice(start)) {
    if (!line.trim().startsWith('|')) break;
    block.push(line.trim());
  }
  const [header, ...rest] = block;
  return { header: cells(header), rows: rest.filter((line) => !SEPARATOR_ROW.test(line)).map(cells) };
}

function areasOf(lines, scale) {
  const table = firstTable(lines);
  if (!table) return { areas: [], faults: [`Areas: no table; it holds one with the columns ${AREA_COLUMNS.slice(0, -1).join(', ')} and ${AREA_COLUMNS.at(-1)}.`] };
  const column = Object.fromEntries(AREA_COLUMNS.map((name) => [name, table.header.findIndex((cell) => cell.toLowerCase() === name.toLowerCase())]));
  const faults = AREA_COLUMNS.filter((name) => column[name] === -1).map((name) => `Areas: the table has no "${name}" column.`);
  const cell = (row, name) => (column[name] === -1 ? undefined : (row[column[name]] ?? ''));

  const seen = new Set();
  const twice = new Set();
  const areas = table.rows.map((row, index) => {
    const id = cell(row, 'id');
    const prd = cell(row, 'PRD');
    if (id !== undefined && seen.has(id)) {
      if (!twice.has(id)) faults.push(`Areas: id "${id}" is listed twice.`);
      twice.add(id);
    } else if (id !== undefined && !KEBAB.test(id)) {
      faults.push(`Areas: id "${id}" is not kebab-case.`);
    }
    seen.add(id);
    const filled = PRD_CELL.exec(prd ?? '');
    if (prd && !filled) faults.push(`Areas: the PRD cell of "${id ?? `row ${index + 1}`}" is "${prd}", neither empty nor #<number>.`);
    return { id, area: cell(row, 'area'), brief: cell(row, 'brief'), prd: filled ? Number(filled[1]) : null };
  });

  const allowed = AREA_ROWS[scale];
  if (allowed && (areas.length < allowed.min || areas.length > allowed.max)) {
    const count = areas.length === 0 ? 'no area' : `${areas.length} area${areas.length === 1 ? '' : 's'}`;
    faults.push(`Areas: ${count}; a ${scale} concept has ${allowed.words}.`);
  }
  return { areas, faults };
}

/**
 * Parses one concept.md into a typed record, or every fault it has.
 *
 * @param {string} text the file's text
 * @returns {{ ok: true, record: { concept: number, title: string, kind: string, scale: string,
 *   sections: Record<string, string>, areas: { id: string, area: string, brief: string, prd: number | null }[] } }
 *   | { ok: false, errors: string[] }}
 */
export function parseConcept(text) {
  const block = FRONT_MATTER_BLOCK.exec(text);
  if (!block) return { ok: false, errors: ['no front matter: a concept.md opens with a "---" fenced header.'] };
  const [, raw, body] = block;
  const front = frontMatter(raw);
  const sections = sectionsOf(body);
  const errors = [...front.errors, ...sectionFaults(sections)];

  const areasSection = sections.find((section) => section.name === 'Areas');
  const { areas, faults } = areasSection ? areasOf(areasSection.lines, front.scale) : { areas: [], faults: [] };
  errors.push(...faults);
  if (errors.length) return { ok: false, errors };

  const named = new Map();
  for (const section of sections) if (!named.has(section.name)) named.set(section.name, section.lines.join('\n').trim());
  return {
    ok: true,
    record: { ...front.data, sections: Object.fromEntries(CONCEPT_SECTIONS.map((name) => [name, named.get(name)])), areas },
  };
}
