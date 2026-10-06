import { describe, expect, it } from 'vitest';
import { parseSliceId } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { sliceOf } from './slice-of.ts';

describe('sliceOf — the slice a sub-PR head branch names', () => {
  const template = 'feat/widget--{slice}';

  it('reads the slice id the branch names', () => {
    expect(sliceOf('feat/widget--s2', template)).toBe(parseSliceId('s2'));
    expect(sliceOf('feat/widget--s12', template)).toBe(parseSliceId('s12'));
  });

  it('reads none from another branch, or from a slice part that is no slice id (PRD 1049)', () => {
    expect(sliceOf('feat/other--s2', template)).toBeNull();
    expect(sliceOf('feat/widget--', template)).toBeNull();
    expect(sliceOf('feat/widget--s1/x', template)).toBeNull();
    expect(sliceOf('feat/widget--fix-it', template)).toBeNull();
  });
});
