import { describe, expect, it } from 'vitest';
import { ledeOf, productHomeTabs, tabShown } from './tabs';
import type { ProductHome } from './product-home.service';

// An archived product's tabs (PRD 2232 s1): read-only, it keeps the tabs that change nothing, and opens
// the Ledger in place of one it leaves out. And the Ledger's lede, cut to seven words by PRD 2232's word
// pass.

const home = { product: { id: 'p-1', name: 'Mobile' }, ledger: { lanes: { 'on-you': [] } }, questions: [], archived: { at: '2026-10-18T09:00:00Z', by: 'olga' } } as unknown as ProductHome;

describe('an archived product\'s tabs', () => {
  it('keeps only the tabs that change nothing: no Questions to answer, no Knowledge or Repositories & approvers to edit', () => {
    expect(productHomeTabs(home).map((t) => t.label)).toEqual(['Ledger', 'Constellation', 'PRDs', 'Ideas', 'Roadmap', 'Bug fixes', 'Visual fixes']);
  });

  it('opens the Ledger in place of a tab it leaves out, and every other tab as asked', () => {
    expect(tabShown(home, 'questions')).toBe('ledger');
    expect(tabShown(home, 'prds')).toBe('prds');
    const live = { ...home, archived: null } as unknown as ProductHome;
    expect(tabShown(live, 'questions')).toBe('questions');
    expect(productHomeTabs(live).map((t) => t.label)).toContain('Repositories & approvers');
  });
});

describe('the Ledger\'s lede', () => {
  it('reads in seven words', () => {
    expect(ledeOf('ledger')).toBe('What waits on whom across its PRDs.');
  });
});
