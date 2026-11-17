// `nextFreeId` (PRD 3015, s1): the next free id of a register prefix, one past the highest number any place holds.
import { describe, expect, it } from 'vitest';
import { nextFreeId } from './next-id.ts';

describe('nextFreeId', () => {
  it('returns one past the highest number across every set, naming where it came from', () => {
    const found = nextFreeId('BR-PIPELINE', [
      { where: 'tree', ids: ['BR-PIPELINE-45', 'BR-PIPELINE-3'] },
      { where: 'base', ids: ['BR-PIPELINE-46'] },
      { where: '#12', ids: ['BR-PIPELINE-47', 'BR-PIPELINE-2'] },
    ]);
    expect(found).toEqual({ id: 'BR-PIPELINE-48', past: [{ where: '#12', id: 'BR-PIPELINE-47' }] });
  });

  it('names every place that holds the highest number', () => {
    const found = nextFreeId('BR-PIPELINE', [
      { where: 'tree', ids: ['BR-PIPELINE-9'] },
      { where: 'base', ids: ['BR-PIPELINE-9'] },
    ]);
    expect(found.id).toBe('BR-PIPELINE-10');
    expect(found.past).toEqual([
      { where: 'tree', id: 'BR-PIPELINE-9' },
      { where: 'base', id: 'BR-PIPELINE-9' },
    ]);
  });

  it('ignores the ids of other prefixes, a longer code included', () => {
    const found = nextFreeId('BR-PIPELINE', [
      { where: 'tree', ids: ['BR-PIPELINE-4', 'N-PIPELINE-90', 'BR-PRODUCT-80', 'BR-PIPELINE-X-70', 'not an id'] },
    ]);
    expect(found).toEqual({ id: 'BR-PIPELINE-5', past: [{ where: 'tree', id: 'BR-PIPELINE-4' }] });
  });

  it('starts at 1 when no place holds the prefix', () => {
    expect(nextFreeId('P-GATE', [{ where: 'tree', ids: ['P-PRODUCT-1'] }])).toEqual({ id: 'P-GATE-1', past: [] });
    expect(nextFreeId('P-GATE', [])).toEqual({ id: 'P-GATE-1', past: [] });
  });

  it('numbers a number past nine as a number, not as text', () => {
    expect(nextFreeId('N-PRODUCT', [{ where: 'tree', ids: ['N-PRODUCT-9', 'N-PRODUCT-17'] }]).id).toBe('N-PRODUCT-18');
  });

  it.each(['', 'pipeline', 'BR', 'BR-PIPELINE-4', 'BR-', 'XX-PIPELINE'])('refuses %j, which idParts cannot split', (prefix) => {
    expect(() => nextFreeId(prefix, [])).toThrow(/not a register prefix/);
  });
});
