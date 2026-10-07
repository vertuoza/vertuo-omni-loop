import { describe, expect, it } from 'vitest';
import { UNREADABLE } from '../part';
import { headerOf, PEOPLE_ANCHOR, peopleSortOf, SORT_KEYS, sortPeople, type SortKey } from './sort';
import { SOLO, type PersonRow } from './tally';

// The People table's sort (PRD 1017): read from the query, applied to the rows, and each header's link.

const row = (name: string, over: Partial<PersonRow> = {}): PersonRow => ({
  userId: `u-${name}`, name, login: name.toLowerCase(), avatarUrl: null, face: { kind: 'initial', letter: name.slice(0, 1) },
  fleet: SOLO, points: 0, prs: 0, prds: { open: 0, building: 0, shipped: 0 }, answered: 0, rank: null, you: false, ...over,
});
const names = (rows: readonly PersonRow[]) => rows.map((r) => r.name);

describe('peopleSortOf', () => {
  it('is points, descending, with no sort in the query', () => {
    expect(peopleSortOf({})).toEqual({ key: 'points', dir: 'desc' });
  });

  it('reads each key in its natural direction', () => {
    const natural: Record<SortKey, 'asc' | 'desc'> = { rank: 'asc', name: 'asc', fleet: 'asc', points: 'desc', prs: 'desc', prds: 'desc', questions: 'desc' };
    expect(SORT_KEYS).toEqual(['rank', 'name', 'fleet', 'points', 'prs', 'prds', 'questions']);
    for (const key of SORT_KEYS) expect(peopleSortOf({ sort: key })).toEqual({ key, dir: natural[key] });
  });

  it('reads dir=asc and dir=desc', () => {
    expect(peopleSortOf({ sort: 'prs', dir: 'asc' })).toEqual({ key: 'prs', dir: 'asc' });
    expect(peopleSortOf({ sort: 'name', dir: 'desc' })).toEqual({ key: 'name', dir: 'desc' });
  });

  it('takes an unknown sort as points and an unknown dir as the natural one, with no error', () => {
    expect(peopleSortOf({ sort: 'shoe-size', dir: 'asc' })).toEqual({ key: 'points', dir: 'asc' });
    expect(peopleSortOf({ sort: 'name', dir: 'sideways' })).toEqual({ key: 'name', dir: 'asc' });
    expect(peopleSortOf({ sort: ['prs', 'name'], dir: ['up'] })).toEqual({ key: 'prs', dir: 'desc' });
    expect(peopleSortOf({ sort: 'toString' })).toEqual({ key: 'points', dir: 'desc' });
  });
});

describe('sortPeople', () => {
  const ada = row('Ada', { points: 125, prs: 3, rank: 1, fleet: { name: 'octo', label: 'OCTO', color: null, mascot: null }, prds: { open: 0, building: 1, shipped: 2 }, answered: 4 });
  const bea = row('bea', { points: 50, prs: 8, rank: 2, fleet: { name: 'apex', label: 'APEX', color: null, mascot: null }, prds: { open: 5, building: 0, shipped: 2 }, answered: 9 });
  const cy = row('Cy', { points: 50, prs: 1, rank: 2, prds: { open: 0, building: 3, shipped: 0 }, answered: 0 });
  const dee = row('Dee', { points: null, prs: null, rank: null, login: null, answered: 2 });
  const rows = [dee, cy, bea, ada];

  it('orders each key in its natural direction, a dash last', () => {
    expect(names(sortPeople(rows, { key: 'points', dir: 'desc' }))).toEqual(['Ada', 'bea', 'Cy', 'Dee']);
    expect(names(sortPeople(rows, { key: 'rank', dir: 'asc' }))).toEqual(['Ada', 'bea', 'Cy', 'Dee']);
    expect(names(sortPeople(rows, { key: 'name', dir: 'asc' }))).toEqual(['Ada', 'bea', 'Cy', 'Dee']);
    expect(names(sortPeople(rows, { key: 'fleet', dir: 'asc' }))).toEqual(['bea', 'Ada', 'Cy', 'Dee']);
    expect(names(sortPeople(rows, { key: 'prs', dir: 'desc' }))).toEqual(['bea', 'Ada', 'Cy', 'Dee']);
    expect(names(sortPeople(rows, { key: 'prds', dir: 'desc' }))).toEqual(['Ada', 'bea', 'Cy', 'Dee']);
    expect(names(sortPeople(rows, { key: 'questions', dir: 'desc' }))).toEqual(['bea', 'Ada', 'Dee', 'Cy']);
  });

  it('reverses each key, a dash still last', () => {
    expect(names(sortPeople(rows, { key: 'points', dir: 'asc' }))).toEqual(['bea', 'Cy', 'Ada', 'Dee']);
    expect(names(sortPeople(rows, { key: 'rank', dir: 'desc' }))).toEqual(['bea', 'Cy', 'Ada', 'Dee']);
    expect(names(sortPeople(rows, { key: 'name', dir: 'desc' }))).toEqual(['Dee', 'Cy', 'bea', 'Ada']);
    expect(names(sortPeople(rows, { key: 'fleet', dir: 'desc' }))).toEqual(['Cy', 'Dee', 'Ada', 'bea']);
    expect(names(sortPeople(rows, { key: 'prs', dir: 'asc' }))).toEqual(['Cy', 'Ada', 'bea', 'Dee']);
    expect(names(sortPeople(rows, { key: 'prds', dir: 'asc' }))).toEqual(['Dee', 'Cy', 'bea', 'Ada']);
    expect(names(sortPeople(rows, { key: 'questions', dir: 'asc' }))).toEqual(['Cy', 'Dee', 'Ada', 'bea']);
  });

  it('compares PRDs by shipped, then building, then open', () => {
    const a = row('A', { prds: { open: 9, building: 0, shipped: 1 } });
    const b = row('B', { prds: { open: 0, building: 2, shipped: 1 } });
    const c = row('C', { prds: { open: 0, building: 0, shipped: 2 } });
    expect(names(sortPeople([a, b, c], { key: 'prds', dir: 'desc' }))).toEqual(['C', 'B', 'A']);
  });

  it('puts an unreadable value last in both directions', () => {
    const lost = row('Lost', { points: UNREADABLE, prs: UNREADABLE, prds: UNREADABLE, answered: UNREADABLE });
    const zero = row('Zero');
    for (const key of ['points', 'prs', 'prds', 'questions'] as const) {
      for (const dir of ['asc', 'desc'] as const) expect(names(sortPeople([lost, zero], { key, dir })), `${key} ${dir}`).toEqual(['Zero', 'Lost']);
    }
  });

  it('breaks ties by the default order (points, PRs, name), whatever the direction', () => {
    const solo = [row('zed', { points: 10, prs: 1 }), row('Amy', { points: 10, prs: 1 }), row('Max', { points: 30, prs: 0 }), row('Kim', { points: 10, prs: 5 })];
    expect(names(sortPeople(solo, { key: 'fleet', dir: 'asc' }))).toEqual(['Max', 'Kim', 'Amy', 'zed']);
    expect(names(sortPeople(solo, { key: 'fleet', dir: 'desc' }))).toEqual(['Max', 'Kim', 'Amy', 'zed']);
  });

  it('leaves the rows it was given as they were', () => {
    const given = [...rows];
    sortPeople(given, { key: 'name', dir: 'desc' });
    expect(given).toEqual(rows);
  });
});

describe('headerOf', () => {
  const query = { period: '30d', fleet: 'octo' };

  it('links another key in its natural direction, with no dir, keeping the query, at the table', () => {
    expect(headerOf('/app/workspace', query, { key: 'points', dir: 'desc' }, 'prs'))
      .toEqual({ href: '/app/workspace?period=30d&fleet=octo&sort=prs#board-people', sorted: null });
    expect(headerOf('/app/workspace', { ...query, sort: 'prs', dir: 'asc' }, { key: 'prs', dir: 'asc' }, 'name'))
      .toEqual({ href: '/app/workspace?period=30d&fleet=octo&sort=name#board-people', sorted: null });
    expect(PEOPLE_ANCHOR).toBe('board-people');
  });

  it('links the current key to its other direction', () => {
    expect(headerOf('/p', query, { key: 'points', dir: 'desc' }, 'points'))
      .toEqual({ href: '/p?period=30d&fleet=octo&sort=points&dir=asc#board-people', sorted: 'descending' });
    expect(headerOf('/p', { sort: 'points', dir: 'asc' }, { key: 'points', dir: 'asc' }, 'points'))
      .toEqual({ href: '/p?sort=points#board-people', sorted: 'ascending' });
    expect(headerOf('/p', { sort: 'name' }, { key: 'name', dir: 'asc' }, 'name'))
      .toEqual({ href: '/p?sort=name&dir=desc#board-people', sorted: 'ascending' });
  });
});
