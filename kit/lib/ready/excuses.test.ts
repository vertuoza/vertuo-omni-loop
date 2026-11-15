// PRD 2898, s1: what excuses a finding of the ready checks 4 and 5 — an item's `excuses:` paths and
// its settled verdict, and nothing else (BL-ASK-1).
import { describe, expect, it } from 'vitest';
import { parseOutboxItemId } from '../ids.ts';
import type { SettledEntry } from '../outbox/settle.ts';
import { excuse, excuseItems } from './excuses.ts';
import type { ExcuseItem } from './excuses.ts';

const id = (text: string) => parseOutboxItemId(text);

/** An item's text whose front matter excuses `paths`. */
function itemText(item: string, paths: readonly string[] | null): string {
  return [
    '---', `id: ${item}`, 'prd: 2898', 'slice: s1', 'rank: high', 'bears-on: none', 'raised: 2026-11-15', 'wave: 1',
    ...(paths === null ? [] : [`excuses: [${paths.join(', ')}]`]), '---', '', '## What I had to decide', '', 'x', '',
  ].join('\n');
}

/** A settled entry of `item`, with its verdict, its answer and its item's text. */
function entry(item: string, verdict: string, paths: readonly string[] | null, answerText = 'A'): SettledEntry {
  return { id: id(item), verdict, closed: false, fields: { Verdict: verdict }, answerText, itemText: itemText(item, paths), became: [] };
}

describe('excuseItems (PRD 2898)', () => {
  it('reads each settled entry\'s verdict and the paths its item excuses, and each open item as unanswered', () => {
    const items = excuseItems({
      settled: [entry('s1-01-a', 'agreed', ['a.ts']), entry('s1-02-b', 'adopted', null)],
      open: [{ id: id('s2-01-c'), text: itemText('s2-01-c', ['c.ts']) }],
    });
    expect(items).toEqual([
      { item: 's1-01-a', verdict: 'agreed', excuses: ['a.ts'] },
      { item: 's1-02-b', verdict: 'adopted', excuses: [] },
      { item: 's2-01-c', verdict: null, excuses: ['c.ts'] },
    ]);
  });

  it('never reads an answer\'s words: a prose yes on a drifted entry is still drifted', () => {
    const [read] = excuseItems({ settled: [entry('s1-01-a', 'drifted', ['a.ts'], 'Yes, keep a.ts, that is fine')], open: [] });
    expect(read?.verdict).toBe('drifted');
  });

  it('reads an open item that is also settled as its settled entry', () => {
    const items = excuseItems({ settled: [entry('s1-01-a', 'agreed', ['a.ts'])], open: [{ id: id('s1-01-a'), text: itemText('s1-01-a', ['a.ts']) }] });
    expect(items).toEqual([{ item: 's1-01-a', verdict: 'agreed', excuses: ['a.ts'] }]);
  });
});

describe('excuse (PRD 2898)', () => {
  const items = (verdict: string | null, paths: readonly string[] = ['kit/x.test.ts']): ExcuseItem[] => [{ item: id('s1-01-a'), verdict, excuses: paths }];

  it('excuses a loosening finding only by an agreed item naming the exact path', () => {
    expect(excuse('kit/x.test.ts', items('agreed'), 'loosening')).toEqual({ excused: true, item: 's1-01-a' });
    expect(excuse('kit/x.test.ts', items('adopted'), 'loosening')).toEqual({ excused: false, note: 's1-01-a names it, but was adopted, never answered by a person' });
  });

  it('excuses an area finding by an agreed or an adopted item naming the exact path', () => {
    expect(excuse('kit/x.test.ts', items('agreed'), 'area')).toEqual({ excused: true, item: 's1-01-a' });
    expect(excuse('kit/x.test.ts', items('adopted'), 'area')).toEqual({ excused: true, item: 's1-01-a' });
  });

  it('excuses nothing through a drifted, an open or an unknown verdict, saying which item names the path', () => {
    for (const check of ['loosening', 'area'] as const) {
      expect(excuse('kit/x.test.ts', items('drifted'), check)).toEqual({ excused: false, note: 's1-01-a names it, but its answer drifted from what was built' });
      expect(excuse('kit/x.test.ts', items(null), check)).toEqual({ excused: false, note: 's1-01-a names it, but is still open' });
      expect(excuse('kit/x.test.ts', items('Agreed'), check)).toEqual({ excused: false, note: 's1-01-a names it, but its verdict reads "Agreed"' });
    }
  });

  it('excuses nothing through an item without the path: a folder, a neighbour or no field at all', () => {
    for (const paths of [['kit/'], ['kit/y.test.ts'], [], ['kit/x.test.tsx']]) {
      expect(excuse('kit/x.test.ts', items('agreed', paths), 'loosening')).toEqual({ excused: false, note: null });
    }
  });

  it('takes the first item that excuses it, past one that does not', () => {
    const both: ExcuseItem[] = [{ item: id('s1-01-a'), verdict: 'drifted', excuses: ['a.ts'] }, { item: id('s2-01-b'), verdict: 'agreed', excuses: ['a.ts'] }];
    expect(excuse('a.ts', both, 'loosening')).toEqual({ excused: true, item: 's2-01-b' });
  });
});
