import { describe, expect, it } from 'vitest';
import { productHomeTabOf } from './tabs';

// The product home's tabs (PRD 1364 s10): the segment of /app/products/<id>/<segment> each tab opens at.

describe('the product home\'s tab segments', () => {
  it('opens each tab at its own segment', () => {
    expect(['prds', 'ideas', 'roadmap', 'bugs', 'visual', 'questions'].map(productHomeTabOf))
      .toEqual(['prds', 'ideas', 'roadmap', 'bugs', 'visual', 'questions']);
  });

  it('opens no tab at a segment no tab has, the Ledger\'s bare address among them', () => {
    expect(productHomeTabOf('ledger')).toBeNull();
    expect(productHomeTabOf('')).toBeNull();
    expect(productHomeTabOf('Ideas')).toBeNull();
  });
});
