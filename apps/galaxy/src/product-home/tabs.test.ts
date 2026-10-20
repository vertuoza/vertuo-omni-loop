import { describe, expect, it } from 'vitest';
import { ledeOf, productHomeTabHref, productHomeTabOf, productHomeTabs, tabShown } from './tabs';
import type { ProductHome } from './product-home.service';

// The product home's tabs (PRD 1364 s10): the segment of /app/products/<id>/<segment> each tab opens at.

describe('the product home\'s tab segments', () => {
  it('opens each tab at its own segment', () => {
    expect(['constellation', 'prds', 'ideas', 'roadmap', 'bugs', 'visual', 'questions'].map(productHomeTabOf))
      .toEqual(['constellation', 'prds', 'ideas', 'roadmap', 'bugs', 'visual', 'questions']);
  });

  it('opens no tab at a segment no tab has, the Ledger\'s bare address among them', () => {
    expect(productHomeTabOf('ledger')).toBeNull();
    expect(productHomeTabOf('')).toBeNull();
    expect(productHomeTabOf('Ideas')).toBeNull();
  });

  it('draws Constellation second in the tab row, at /constellation (PRD 2174)', () => {
    const home = { product: { id: 'p-1', name: 'Mobile' }, ledger: { lanes: { 'on-you': [] } }, questions: [], archived: null } as unknown as ProductHome;
    expect(productHomeTabs(home).map((t) => t.label)).toEqual([
      'Ledger', 'Constellation', 'PRDs', 'Ideas', 'Roadmap', 'Bug fixes', 'Visual fixes', 'Questions', 'Knowledge', 'Repositories & approvers',
    ]);
    expect(productHomeTabHref(home, 'constellation')).toBe('/app/products/p-1/constellation');
  });
});

describe('an archived product\'s tabs (PRD 2232 s1)', () => {
  const home = { product: { id: 'p-1', name: 'Mobile' }, ledger: { lanes: { 'on-you': [] } }, questions: [], archived: { at: '2026-10-18T09:00:00Z', by: 'olga' } } as unknown as ProductHome;

  it('keeps only the tabs that change nothing: no Questions to answer, no Knowledge or Repositories & approvers to edit', () => {
    expect(productHomeTabs(home).map((t) => t.label)).toEqual(['Ledger', 'Constellation', 'PRDs', 'Ideas', 'Roadmap', 'Bug fixes', 'Visual fixes']);
  });

  it('opens the Ledger in place of a tab it leaves out, and every other tab as asked', () => {
    expect(tabShown(home, 'questions')).toBe('ledger');
    expect(tabShown(home, 'prds')).toBe('prds');
    const live = { ...home, archived: null } as unknown as ProductHome;
    expect(tabShown(live, 'questions')).toBe('questions');
  });
});

describe('the Ledger\'s lede', () => {
  it('reads in seven words (PRD 2232\'s word pass)', () => {
    expect(ledeOf('ledger')).toBe('What waits on whom across its PRDs.');
  });
});
