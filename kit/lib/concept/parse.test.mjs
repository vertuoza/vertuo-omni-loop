import { describe, expect, it } from 'vitest';
import { AREA_COLUMNS, CONCEPT_KINDS, CONCEPT_SCALES, CONCEPT_SECTIONS, parseConcept } from './parse.mjs';

const FRONT = { concept: '712', title: 'One agenda for every employee', kind: 'product', scale: 'vast' };
const AREAS = [
  '| id | area | brief | PRD |',
  '|---|---|---|---|',
  '| day-view | The living day view | One screen for the whole day | |',
  '| crew-sync | Crew sync | The crew sees the same day | #731 |',
];

/** A concept.md: front matter (a field set to `undefined` is left out), the six sections, the table. */
function conceptText({ front = {}, sections = CONCEPT_SECTIONS, areas = AREAS } = {}) {
  const fm = Object.entries({ ...FRONT, ...front }).filter(([, value]) => value !== undefined);
  const body = sections.flatMap((name) => [`## ${name}`, '', ...(name === 'Areas' ? areas : [`What ${name} says.`]), '']);
  return ['---', ...fm.map(([key, value]) => `${key}: ${value}`), '---', '', ...body].join('\n');
}

const row = (id, prd = '') => `| ${id} | Area ${id} | Brief of ${id} | ${prd} |`;
const table = (...rows) => [AREAS[0], AREAS[1], ...rows];

function errorsOf(text) {
  const parsed = parseConcept(text);
  expect(parsed.ok).toBe(false);
  return parsed.errors;
}

describe('parseConcept — a valid concept.md', () => {
  it('parses into its front matter, its sections and its areas in build order', () => {
    const parsed = parseConcept(conceptText());
    expect(parsed.ok, JSON.stringify(parsed.errors)).toBe(true);
    expect(parsed.record).toMatchObject({ concept: 712, title: 'One agenda for every employee', kind: 'product', scale: 'vast' });
    expect(parsed.record.areas).toEqual([
      { id: 'day-view', area: 'The living day view', brief: 'One screen for the whole day', prd: null },
      { id: 'crew-sync', area: 'Crew sync', brief: 'The crew sees the same day', prd: 731 },
    ]);
    expect(parsed.record.sections['The vision']).toBe('What The vision says.');
  });

  it('names the kinds, the scales, the six sections in order and the four columns', () => {
    expect(CONCEPT_KINDS).toEqual(['product', 'identity', 'platform']);
    expect(CONCEPT_SCALES).toEqual(['vast', 'lite']);
    expect(CONCEPT_SECTIONS).toEqual(['The brief', 'The vision', 'Why this one', 'Killed and why', 'Fuel', 'Areas']);
    expect(AREA_COLUMNS).toEqual(['id', 'area', 'brief', 'PRD']);
  });

  it('takes every kind, a lite concept with one area, and six areas for a vast one', () => {
    for (const kind of CONCEPT_KINDS) expect(parseConcept(conceptText({ front: { kind } })).ok, kind).toBe(true);
    expect(parseConcept(conceptText({ front: { scale: 'lite' }, areas: table(row('wedge')) })).ok).toBe(true);
    expect(parseConcept(conceptText({ areas: table(...['a', 'b', 'c', 'd', 'e', 'f'].map((id) => row(id))) })).ok).toBe(true);
  });

  it('reads a quoted title, a sub-heading inside a section, and a table set among prose', () => {
    const text = conceptText({ front: { title: '"A: quoted title"' }, areas: ['The wedge comes first.', '', ...AREAS, '', 'Then the rest.'] })
      .replace('What The vision says.', 'What The vision says.\n\n### Its wow moments\n\n- one');
    const parsed = parseConcept(text);
    expect(parsed.ok, JSON.stringify(parsed.errors)).toBe(true);
    expect(parsed.record.title).toBe('A: quoted title');
    expect(parsed.record.areas.map((area) => area.id)).toEqual(['day-view', 'crew-sync']);
  });
});

describe('parseConcept — each invalid case, refused by name', () => {
  it('no front matter', () => {
    expect(errorsOf('# a concept\n')).toEqual(['no front matter: a concept.md opens with a "---" fenced header.']);
  });

  it.each(['concept', 'title', 'kind', 'scale'])('a missing %s field', (field) => {
    expect(errorsOf(conceptText({ front: { [field]: undefined } }))).toEqual([`front matter: no "${field}" field.`]);
  });

  it('an unknown field', () => {
    expect(errorsOf(conceptText({ front: { status: 'draft' } }))).toEqual([
      'front matter: unexpected field "status"; it holds only concept, title, kind and scale.',
    ]);
  });

  it.each(['seven', '0', '-3', '7.5'])('concept "%s", not a number', (value) => {
    expect(errorsOf(conceptText({ front: { concept: value } }))).toEqual([
      `front matter: concept is "${value}", not a positive whole number (the concept's issue).`,
    ]);
  });

  it('an unknown kind', () => {
    expect(errorsOf(conceptText({ front: { kind: 'feature' } }))).toEqual([
      'front matter: kind is "feature", not one of product, identity, platform.',
    ]);
  });

  it('an unknown scale', () => {
    expect(errorsOf(conceptText({ front: { scale: 'huge' } }))).toEqual(['front matter: scale is "huge", not one of vast, lite.']);
  });

  it('a missing section', () => {
    expect(errorsOf(conceptText({ sections: CONCEPT_SECTIONS.filter((name) => name !== 'Fuel') }))).toEqual([
      'sections: no "## Fuel" section.',
    ]);
  });

  it('a misordered section', () => {
    const sections = ['The brief', 'Why this one', 'The vision', 'Killed and why', 'Fuel', 'Areas'];
    expect(errorsOf(conceptText({ sections }))).toEqual([
      'sections: "## The vision" comes after "## Why this one"; the order is The brief, The vision, Why this one, Killed and why, Fuel, Areas.',
    ]);
  });

  it('no Areas table', () => {
    expect(errorsOf(conceptText({ areas: ['The areas are to come.'] }))).toEqual([
      'Areas: no table; it holds one with the columns id, area, brief and PRD.',
    ]);
  });

  it.each(AREA_COLUMNS)('an Areas table with no %s column', (column) => {
    const keep = AREA_COLUMNS.map((name) => name !== column);
    const cut = (line) => {
      const cells = line.split('|').slice(1, -1);
      return `|${cells.filter((_, index) => keep[index]).join('|')}|`;
    };
    expect(errorsOf(conceptText({ areas: AREAS.map(cut) }))).toEqual([`Areas: the table has no "${column}" column.`]);
  });

  it.each(['Day-View', 'day_view', 'day view', '-day', 'day--view'])('a non-kebab id, "%s"', (id) => {
    expect(errorsOf(conceptText({ areas: table(row(id), row('crew-sync')) }))).toEqual([`Areas: id "${id}" is not kebab-case.`]);
  });

  it('an empty id', () => {
    expect(errorsOf(conceptText({ areas: table('| | Area | Brief | |', row('crew-sync')) }))).toEqual(['Areas: id "" is not kebab-case.']);
  });

  it('a duplicate id', () => {
    expect(errorsOf(conceptText({ areas: table(row('day-view'), row('crew-sync'), row('day-view')) }))).toEqual([
      'Areas: id "day-view" is listed twice.',
    ]);
  });

  it('an id listed three times, named once', () => {
    expect(errorsOf(conceptText({ areas: table(row('day-view'), row('day-view'), row('day-view')) }))).toEqual([
      'Areas: id "day-view" is listed twice.',
    ]);
  });

  it('seven areas for a vast concept', () => {
    const areas = table(...['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id) => row(id)));
    expect(errorsOf(conceptText({ areas }))).toEqual(['Areas: 7 areas; a vast concept has two to six.']);
  });

  it('no area for a vast concept', () => {
    expect(errorsOf(conceptText({ areas: table() }))).toEqual(['Areas: no area; a vast concept has two to six.']);
  });

  it('one area for a vast concept', () => {
    expect(errorsOf(conceptText({ areas: table(row('day-view')) }))).toEqual(['Areas: 1 area; a vast concept has two to six.']);
  });

  it('two areas for a lite concept', () => {
    expect(errorsOf(conceptText({ front: { scale: 'lite' } }))).toEqual(['Areas: 2 areas; a lite concept has exactly one.']);
  });

  it.each(['731', '#', '#7a', 'PRD 731', '# 731'])('a PRD cell "%s", neither empty nor #<number>', (cell) => {
    expect(errorsOf(conceptText({ areas: table(row('day-view', cell), row('crew-sync')) }))).toEqual([
      `Areas: the PRD cell of "day-view" is "${cell}", neither empty nor #<number>.`,
    ]);
  });

  it('names every fault at once', () => {
    const text = conceptText({ front: { kind: 'feature', status: 'x' }, areas: table(row('Day'), row('Day')) });
    expect(errorsOf(text)).toHaveLength(4);
  });
});
