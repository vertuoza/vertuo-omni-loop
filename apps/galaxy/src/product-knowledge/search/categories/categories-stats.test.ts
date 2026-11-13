import { describe, expect, it } from 'vitest';
import {
  NOT_CATEGORIZED, UNCATEGORIZED, categoriesOf, categoryLabel, hasCategory, openCategoryOf, type CategorizedRow,
} from './categories-stats';

// The Categories view's numbers (PRD omni-loop-7 s4), pure, from fixture rows.

const NOW = Date.parse('2026-11-13T12:00:00Z');
const DAY = 86_400_000;
const ago = (days: number) => new Date(NOW - days * DAY).toISOString();

let n = 0;
const row = (over: Partial<CategorizedRow>): CategorizedRow => ({
  id: `r${String(++n)}`, query: 'q', mode: 'meaning', total: 1, hitIds: ['a'], openedRank: null, askedAt: ago(1),
  category: null, groupId: null, ...over,
});

const rows: CategorizedRow[] = [
  row({ category: 'quotes', groupId: 'g1', query: 'can a quote be sent without a payment term', openedRank: 1, askedAt: ago(2) }),
  row({ category: 'quotes', groupId: 'g1', query: 'can a quote go out with no payment term', openedRank: 4, askedAt: ago(1) }),
  row({ category: 'quotes', groupId: 'g1', query: 'quote with no payment term', total: 0, mode: 'words', askedAt: ago(3) }),
  row({ category: 'quotes', groupId: 'g2', query: 'who signs a quote', openedRank: 7 }),
  row({ category: 'crm', groupId: 'g3', query: 'merge two contacts', total: 0 }),
  row({ category: 'crm', groupId: 'g3', query: 'merge contacts', mode: 'words', openedRank: 2 }),
  row({ category: null, groupId: 'g4', query: 'delete an invoice' }),
  row({ category: 'quotes', groupId: 'g2', query: 'old one', askedAt: ago(40) }),
];
const heads = [
  { id: 'g1', question: 'can a quote be sent without a payment term' },
  { id: 'g2', question: 'who signs a quote' },
  { id: 'g3', question: 'merge two contacts' },
  { id: 'g4', question: 'delete an invoice' },
];

describe('the categories of a period', () => {
  it('list each category by searches, with its zero-hit rate, words-fallback rate and opened@5', () => {
    const cats = categoriesOf(rows, heads, 30, NOW);
    expect(cats.map((c) => [c.category, c.searches])).toEqual([['quotes', 4], ['crm', 2], [null, 1]]);
    const [quotes, crm] = cats;
    expect(quotes).toMatchObject({ zeroHit: 1 / 4, words: 1 / 4, opened: 3, openedAt5: 2 / 3 });
    expect(crm).toMatchObject({ zeroHit: 1 / 2, words: 1 / 2, opened: 1, openedAt5: 1 });
  });

  it('count only the searches of the period: 7, 30 or 90 days', () => {
    expect(categoriesOf(rows, heads, 90, NOW)[0]?.searches).toBe(5);
    expect(categoriesOf(rows, heads, 7, NOW).reduce((sum, c) => sum + c.searches, 0)).toBe(7);
  });

  it('hold their groups by count, each with its first question, its count and its worst opened rank', () => {
    const [quotes] = categoriesOf(rows, heads, 30, NOW);
    expect(quotes?.groups.map((g) => [g.key, g.question, g.count, g.worstOpened])).toEqual([
      ['g1', 'can a quote be sent without a payment term', 3, 4],
      ['g2', 'who signs a quote', 1, 7],
    ]);
  });

  it('give each group its questions, newest first', () => {
    const g1 = categoriesOf(rows, heads, 30, NOW)[0]?.groups[0];
    expect(g1?.rows.map((r) => r.query)).toEqual([
      'can a quote go out with no payment term', 'can a quote be sent without a payment term', 'quote with no payment term',
    ]);
  });

  it('put a search with no category yet under Not categorized', () => {
    const cats = categoriesOf(rows, heads, 30, NOW);
    const none = cats.find((c) => c.category === null);
    expect(none?.groups.map((g) => g.question)).toEqual(['delete an invoice']);
    expect(categoryLabel(null, [])).toBe(NOT_CATEGORIZED);
  });

  it('show a search not grouped yet as a group of its own, its question first, and a group with no head by its oldest question', () => {
    const cats = categoriesOf([
      row({ id: 'lone', category: 'crm', groupId: null, query: 'export contacts' }),
      row({ category: 'crm', groupId: 'gx', query: 'newer', askedAt: ago(1) }),
      row({ category: 'crm', groupId: 'gx', query: 'older', askedAt: ago(2) }),
    ], [], 30, NOW);
    expect(cats[0]?.groups.map((g) => [g.key, g.question, g.count])).toEqual([['gx', 'older', 2], ['search:lone', 'export contacts', 1]]);
  });

  it('have no opened rank or rate when nothing was opened', () => {
    const [only] = categoriesOf([row({ category: 'crm', groupId: 'g' })], [], 30, NOW);
    expect(only).toMatchObject({ openedAt5: null, opened: 0 });
    expect(only?.groups[0]?.worstOpened).toBeNull();
  });

  it('are none when the period holds no row', () => {
    expect(categoriesOf(rows, heads, 7, NOW + 400 * DAY)).toEqual([]);
  });
});

describe('a category', () => {
  it('is named by its domain when the product holds it, Other for other, and its key otherwise', () => {
    const domains = [{ key: 'quotes', name: 'Quotes' }];
    expect(categoryLabel('quotes', domains)).toBe('Quotes');
    expect(categoryLabel('other', domains)).toBe('Other');
    expect(categoryLabel('crm', domains)).toBe('crm');
  });

  it('is known to be set once any search of the period holds one', () => {
    expect(hasCategory(categoriesOf(rows, heads, 30, NOW))).toBe(true);
    expect(hasCategory(categoriesOf([row({}), row({ groupId: 'g' })], [], 30, NOW))).toBe(false);
    expect(hasCategory(categoriesOf([row({ category: 'crm', askedAt: ago(20) }), row({})], [], 7, NOW))).toBe(false);
  });

  it('opened is the one ?category= names, the uncategorized one by its key, or the first', () => {
    const cats = categoriesOf(rows, heads, 30, NOW);
    expect(openCategoryOf(cats, { category: 'crm' })?.category).toBe('crm');
    expect(openCategoryOf(cats, { category: UNCATEGORIZED })?.category).toBeNull();
    expect(openCategoryOf(cats, { category: 'nope' })?.category).toBe('quotes');
    expect(openCategoryOf(cats, {})?.category).toBe('quotes');
    expect(openCategoryOf([], {})).toBeNull();
  });
});
