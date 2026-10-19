import { describe, expect, it } from 'vitest';
import { productHomeTabHref, productHomeTabOf, productHomeTabs } from './tabs';
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

  it('leaves Constellation out of the tab row while its rework is designed, still at /constellation (PRD 2129)', () => {
    const home = { product: { id: 'p-1', name: 'Mobile' }, ledger: { lanes: { 'on-you': [] } }, questions: [] } as unknown as ProductHome;
    expect(productHomeTabs(home).map((t) => t.label)).toEqual([
      'Ledger', 'PRDs', 'Ideas', 'Roadmap', 'Bug fixes', 'Visual fixes', 'Questions', 'Knowledge', 'Repositories & approvers',
    ]);
    expect(productHomeTabHref(home, 'constellation')).toBe('/app/products/p-1/constellation');
  });
});
