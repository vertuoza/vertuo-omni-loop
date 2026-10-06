import { describe, expect, it } from 'vitest';
import { defaultPitchSettings } from 'vertuo-omni-plan/kit/lib/pitch/settings.ts';
import { DEFAULT_LOOK, isPitchLook, lookLabel, lookOf, PITCH_LOOKS, pitchedOf, pitchOf, productHref, rowOf, type ProductRow } from './model';

// A product's pitch look as pure data (PRD 859 s1): the two looks, Arcade poster first and by default;
// a stored row read as the page draws it, with its Pitch settings (PRD 1108 s2); a product's own address.

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

describe('a product\'s Pitch settings', () => {
  it('read as stored, filled from the preset and the defaults', () => {
    const pitch = pitchOf({ id: 'p-1', name: 'Vertuoza', pitch_look: 'keynote', pitch: { look: { preset: 'keynote' }, voice: { preset: 'formal' } } });
    expect(pitch).toEqual({ ...defaultPitchSettings('keynote'), voice: { preset: 'formal', instructions: '' } });
  });

  it('read as the look\'s preset when none is stored, or what is stored is out of shape', () => {
    expect(pitchOf({ id: 'p-1', name: 'Vertuoza', pitch_look: 'keynote' })).toEqual(defaultPitchSettings('keynote'));
    expect(pitchOf({ id: 'p-1', name: 'Vertuoza', pitch_look: 'keynote', pitch: null })).toEqual(defaultPitchSettings('keynote'));
    expect(pitchOf({ id: 'p-1', name: 'Vertuoza', pitch_look: 'keynote', pitch: { length: { min: 3 } } })).toEqual(defaultPitchSettings('keynote'));
    expect(pitchOf({ id: 'p-1', name: 'Vertuoza', pitch: {} })).toEqual(defaultPitchSettings('arcade'));
  });

  it('ride with the row on the product\'s own page', () => {
    expect(pitchedOf({ id: 'p-1', name: 'Vertuoza', pitch_look: 'arcade', pitch: {} })).toEqual({ ...ROW, pitch: defaultPitchSettings('arcade') });
  });
});
