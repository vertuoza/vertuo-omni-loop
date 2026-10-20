import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { sure } from '../../arcade/test/sure';
import { sortRows } from '../../nav/sortable-list';
import { PersonaView, PersonasTable } from './PersonasList';
import { personaRowOf, personaRowsOf, personaSortOf, type StoredAuthoredPersona } from './personas-section';

// The Personas section's rows, their sort and their pages (PRD 2240 s4).

const AVATAR = { v: 1 as const, skin: 2, hair: 1, hairColor: 1, outfit: 2, accessory: 1 };
const stored = (n: number, over: Partial<StoredAuthoredPersona> = {}): StoredAuthoredPersona => ({
  id: `pe-${n}`, product_id: 'p-1', ordinal: n, name: `Person ${n}`, stance: 'neutral', trade: 'plumber', avatar: AVATAR, who: null, usage: null,
  created_by: 'u-anna', created_at: `2026-10-0${n}T09:00:00Z`, ...over,
});
const STORED = [
  stored(1, { name: 'Marc', stance: 'skeptical', trade: 'plumber' }),
  stored(2, { name: 'Sofia', stance: 'excited', trade: 'office', created_by: null }),
  stored(3, { name: 'Yves', stance: 'neutral', trade: 'electrician', created_by: 'u-bob' }),
];
const ROWS = personaRowsOf(STORED, { 'u-anna': 'anna' });
const ids = (query: Record<string, string> = {}) => sortRows(ROWS, personaSortOf(query)).map((r) => r.persona.id);

describe('the rows', () => {
  it('read each persona with its author, a missing one as none', () => {
    expect(ROWS.map((r) => r.by)).toEqual([{ user: 'u-anna', login: 'anna' }, null, { user: 'u-bob', login: null }]);
    expect(personaRowOf(ROWS, 'pe-2')?.persona.name).toBe('Sofia');
    expect(personaRowOf(ROWS, 'pe-9')).toBeNull();
  });
});

describe('the sort', () => {
  it('opens newest first', () => {
    expect(ids()).toEqual(['pe-3', 'pe-2', 'pe-1']);
  });

  it('sorts every column both ways, an empty author last whichever the direction', () => {
    expect(ids({ sort: 'name' })).toEqual(['pe-1', 'pe-2', 'pe-3']);
    expect(ids({ sort: 'name', dir: 'desc' })).toEqual(['pe-3', 'pe-2', 'pe-1']);
    expect(ids({ sort: 'stance' })).toEqual(['pe-2', 'pe-3', 'pe-1']);
    expect(ids({ sort: 'trade' })).toEqual(['pe-3', 'pe-2', 'pe-1']);
    expect(ids({ sort: 'trade', dir: 'desc' })).toEqual(['pe-1', 'pe-2', 'pe-3']);
    expect(ids({ sort: 'by' })).toEqual(['pe-1', 'pe-3', 'pe-2']);
    expect(ids({ sort: 'by', dir: 'desc' })).toEqual(['pe-3', 'pe-1', 'pe-2']);
    expect(ids({ sort: 'created', dir: 'asc' })).toEqual(['pe-1', 'pe-2', 'pe-3']);
  });

  it('falls back to newest first for a column it does not know', () => {
    expect(ids({ sort: 'nonsense' })).toEqual(ids());
  });
});

const list = (query: Record<string, string> = {}, rows = ROWS) => renderToStaticMarkup(createElement(PersonasTable, { product: 'p-1', rows, query, add: null }));

describe('the list page', () => {
  it('marks the header in use with aria-sort and draws the five columns', () => {
    const page = list({ sort: 'name', dir: 'desc' });
    expect(page).toMatch(/<th scope="col"[^>]*aria-sort="descending"[^>]*><a[^>]*>Name/);
    expect(page.match(/aria-sort=/g)).toHaveLength(1);
    expect([...page.matchAll(/<th scope="col"[^>]*><a[^>]*>([^<]*)/g)].map((m) => m[1])).toEqual(['Name', 'Stance', 'Trade', 'Created by', 'Created']);
  });

  it('opens each persona\'s page, the sort kept, and shows an author as @login or a dash', () => {
    const page = list({ sort: 'name' });
    expect(page).toContain('href="/app/products/p-1/knowledge/personas/pe-2?sort=name"');
    expect(page).toContain('@anna');
    expect(page).toContain('—');
  });

  it('says so when there is no persona', () => {
    expect(list({}, [])).toContain('No personas yet');
  });
});

describe('a persona\'s page', () => {
  it('shows who made it and when, under a link back to the list with the sort kept', () => {
    const page = renderToStaticMarkup(createElement(PersonaView, { row: sure(ROWS[0], 'ROWS[0]'), back: '/back?sort=name', controls: 'the card' }));
    expect(page).toContain('href="/back?sort=name"');
    expect(page).toContain('← Personas');
    expect(page).toContain('Marc');
    expect(page).toContain('@anna');
    expect(page).toContain('2026-10-01');
    expect(page).toContain('the card');
  });
});
