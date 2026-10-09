import { describe, expect, it } from 'vitest';
import { compareRecordings } from './heals.ts';
import type { Recording } from './recording.ts';

const rec = (testId: string, callIndex: number, target: string, file = `${testId}-${callIndex}-${target}.json`): Recording => ({
  file, testId, callIndex, instruction: '', summary: `clicks ${target}`, actions: [{ name: 'click', target }],
});

describe('compareRecordings', () => {
  it('lists healed, new and removed steps, and not an identical one', () => {
    const base = [rec('a', 0, 'Rank'), rec('a', 1, 'Same'), rec('b', 0, 'Gone')];
    const head = [rec('a', 0, 'Position'), rec('a', 1, 'Same'), rec('c', 0, 'Fresh')];
    const out = compareRecordings(base, head);
    expect(out.healed).toEqual([
      { testId: 'a', callIndex: 0, summary: 'clicks Position', old: [{ name: 'click', target: 'Rank' }], new: [{ name: 'click', target: 'Position' }] },
    ]);
    expect(out.new.map((s) => [s.testId, s.callIndex])).toEqual([['c', 0]]);
    expect(out.removed.map((s) => [s.testId, s.callIndex])).toEqual([['b', 0]]);
  });

  it('pairs by test id and call index, never by file name', () => {
    const out = compareRecordings([rec('a', 0, 'Rank', 'hash1.json')], [rec('a', 0, 'Rank', 'hash2.json')]);
    expect(out).toEqual({ healed: [], new: [], removed: [] });
  });

  it('keeps two steps of one test apart when they share a call index but not an instruction', () => {
    const step = (instruction: string, target: string): Recording => ({ ...rec('a', 0, target), instruction });
    const out = compareRecordings([step('x', 'Rank'), step('y', 'Name')], [step('x', 'Position'), step('y', 'Name')]);
    expect(out.healed.map((h) => [h.old[0]?.target, h.new[0]?.target])).toEqual([['Rank', 'Position']]);
    expect(out.new).toEqual([]);
    expect(out.removed).toEqual([]);
  });
});
