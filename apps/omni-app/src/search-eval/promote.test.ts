// The promotion's choice (PRD omni-loop-8 s4), pure, with fixture groups: each product's 5 most-asked groups of each
// category not yet in the set, each once. Every question and id is fictional.
import { describe, expect, it } from 'vitest';
import { countGroups, pickGroups, TOP_GROUPS, WINDOW_DAYS, type GroupCount, type LoggedSearch } from './promote.ts';

const search = (groupId: string, category: string | null, productId = 'p-1'): LoggedSearch => ({ groupId, productId, workspaceId: 'w-1', category });
const many = (n: number, groupId: string, category: string | null, productId = 'p-1'): LoggedSearch[] => Array.from({ length: n }, () => search(groupId, category, productId));
const group = (groupId: string, category: string, count: number, productId = 'p-1'): GroupCount => ({ groupId, productId, workspaceId: 'w-1', category, count });

describe('the settings', () => {
  it('are the top 5 groups of a category over 30 days', () => {
    expect([TOP_GROUPS, WINDOW_DAYS]).toEqual([5, 30]);
  });
});

describe('countGroups', () => {
  it('counts each group\'s searches and gives it the category most of them carry', () => {
    const counts = countGroups([...many(2, 'g-1', 'quotes'), search('g-1', 'invoices'), ...many(2, 'g-2', 'invoices'), search('g-2', null)]);
    expect(counts).toEqual([group('g-1', 'quotes', 3), group('g-2', 'invoices', 3)]);
  });

  it('gives a tie of categories to the first by name', () => {
    expect(countGroups([search('g-1', 'quotes'), search('g-1', 'invoices')])).toEqual([group('g-1', 'invoices', 2)]);
  });

  it('leaves out a group none of whose searches has a category', () => {
    expect(countGroups([...many(4, 'g-1', null), search('g-2', 'quotes')])).toEqual([group('g-2', 'quotes', 1)]);
  });
});

describe('pickGroups', () => {
  const six = ['a', 'b', 'c', 'd', 'e', 'f'].map((id, i) => group(`g-${id}`, 'quotes', 10 - i));

  it('takes each category\'s 5 most-asked groups', () => {
    expect(pickGroups(six, new Set()).map((g) => g.groupId)).toEqual(['g-a', 'g-b', 'g-c', 'g-d', 'g-e']);
  });

  it('takes the 5 of each category and of each product on their own', () => {
    const picked = pickGroups([group('g-1', 'quotes', 3), group('g-2', 'invoices', 9), group('g-3', 'quotes', 2, 'p-2')], new Set());
    expect(picked.map((g) => [g.productId, g.category, g.groupId])).toEqual([
      ['p-1', 'invoices', 'g-2'],
      ['p-1', 'quotes', 'g-1'],
      ['p-2', 'quotes', 'g-3'],
    ]);
  });

  it('never takes a group that joined the set, a removed question\'s included, and does not reach past the top 5 for it', () => {
    expect(pickGroups(six, new Set(['g-a', 'g-c'])).map((g) => g.groupId)).toEqual(['g-b', 'g-d', 'g-e']);
  });

  it('takes none twice: a second pick with the first one\'s groups joined takes nothing', () => {
    const first = pickGroups(six, new Set());
    expect(pickGroups(six, new Set(first.map((g) => g.groupId)))).toEqual([]);
  });

  it('breaks a tie by group id, so the day\'s pick is stable', () => {
    expect(pickGroups([group('g-b', 'quotes', 4), group('g-a', 'quotes', 4)], new Set(), 1).map((g) => g.groupId)).toEqual(['g-a']);
  });

  it('answers nothing for no group', () => {
    expect(pickGroups([], new Set())).toEqual([]);
  });
});
