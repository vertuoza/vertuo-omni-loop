import { describe, expect, it } from 'vitest';
import { DEFAULT_LOOK, isPitchLook, lookLabel, lookOf, PITCH_LOOKS, productHref, productReducer, rowOf, type ProductRow } from './model';

// A product's pitch look as pure data (PRD 859 s1): the two looks, Arcade poster first and by default;
// a stored row read as the page draws it; a product's own address; and the product page's state.

const ROW: ProductRow = { id: 'p-1', name: 'Vertuoza', look: 'arcade' };

describe('the looks', () => {
  it('are Arcade poster, the default, then Clean keynote', () => {
    expect(PITCH_LOOKS.map((l) => [l.value, l.label])).toEqual([['arcade', 'Arcade poster'], ['keynote', 'Clean keynote']]);
    expect(DEFAULT_LOOK).toBe('arcade');
    expect(lookLabel('keynote')).toBe('Clean keynote');
  });

  it('take only arcade or keynote; anything else reads as the default', () => {
    expect(isPitchLook('keynote')).toBe(true);
    expect(isPitchLook('custom')).toBe(false);
    expect(lookOf('keynote')).toBe('keynote');
    expect(lookOf(null)).toBe('arcade');
    expect(lookOf('Keynote')).toBe('arcade');
  });
});

describe('a product', () => {
  it('reads a stored row, its look defaulting to arcade', () => {
    expect(rowOf({ id: 'p-1', name: 'Vertuoza', pitch_look: 'keynote' })).toEqual({ id: 'p-1', name: 'Vertuoza', look: 'keynote' });
    expect(rowOf({ id: 'p-1', name: 'Vertuoza' })).toEqual(ROW);
  });

  it('has its own page under Settings › Products', () => {
    expect(productHref('p-1')).toBe('/app/settings/products/p-1');
    expect(productHref('a b/c')).toBe('/app/settings/products/a%20b%2Fc');
  });
});

describe('the product page\'s state', () => {
  it('waits while a change is on its way, then shows the saved look', () => {
    const busy = productReducer({ product: ROW, busy: false, refusal: null }, { type: 'busy' });
    expect(busy).toEqual({ product: ROW, busy: true, refusal: null });
    expect(productReducer(busy, { type: 'saved', product: { ...ROW, look: 'keynote' } })).toEqual({ product: { ...ROW, look: 'keynote' }, busy: false, refusal: null });
  });

  it('keeps the look and says why when a change is refused', () => {
    expect(productReducer({ product: ROW, busy: true, refusal: null }, { type: 'refused', message: 'No.' })).toEqual({ product: ROW, busy: false, refusal: 'No.' });
  });
});
