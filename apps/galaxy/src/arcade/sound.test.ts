import { describe, expect, it } from 'vitest';
import { MASCOTS } from '@omni/design';
import { writtenMotif } from './sound';

// A fleet's motif is keyed by its mascot, never by its name (PRD 400): a workspace names its own
// fleets, and the mascot is what the motif was written for.
describe('writtenMotif', () => {
  it('gives a fleet with the beaver mascot the beaver motif, whatever its name', () => {
    expect(writtenMotif({ name: 'dam-builders', mascot: 'beaver' })).toBe('beaver');
    expect(writtenMotif({ name: 'zz-top', mascot: 'beaver' })).toBe('beaver');
  });

  it('never plays a written motif by a fleet\'s name alone', () => {
    expect(writtenMotif({ name: 'beaver', mascot: null })).toBeNull();
    expect(writtenMotif({ name: 'beaver', mascot: 'octopod' })).toBe('octopod');
  });

  it('has a written motif only for mascots of the library, and none for an unknown one', () => {
    expect(writtenMotif({ name: 'x', mascot: 'dragon' })).toBeNull();
    for (const m of ['beaver', 'octopod', 'picsou', 'pirate']) {
      expect(MASCOTS).toContain(m);
      expect(writtenMotif({ name: 'x', mascot: m })).toBe(m);
    }
  });
});
