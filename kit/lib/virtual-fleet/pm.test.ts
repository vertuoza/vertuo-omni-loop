// The PM's own PRDs (PRD 2896 s12): which skill it is sent, its line, the cap a roadmap writes under, and the record the App reads.
// The PM's plan and replan (PRD omni-loop-21 s9): the line each is sent as, and the line read back.
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { parseProductPrdId, PrdNumberSchema, type PrdNumber, type ProductPrdId } from '../ids.ts';
import { checkRunnerLine, missionRefusal } from '../runner/line.ts';
import { fitCap, isPmSkill, keptIdsOf, keptOf, lastRecordOf, notWrittenWords, planJobLine, planOfLine, pmJobLine, pmLine, pmRecordOf, pmSkillFor, readPmRecord, type PmRecord } from './pm.ts';

const prd = (n: number): PrdNumber => PrdNumberSchema.parse(n);
const record = (over: Partial<PmRecord> = {}): PmRecord => ({ v: 1, mission: 12, skill: 'roadmap', cap: 3, prds: [prd(2950), prd(2951)], unwritten: [], ...over });

describe('pmSkillFor', () => {
  it('sends nothing when no PRD is left under the cap', () => {
    for (const left of [0, -1, 0.5, Number.NaN]) expect(pmSkillFor(left, false), String(left)).toBeNull();
  });

  it('sends a brainstorm for one PRD and a roadmap for several', () => {
    expect(pmSkillFor(1, false)).toBe('brainstorm');
    expect(pmSkillFor(2, false)).toBe('roadmap');
    expect(pmSkillFor(10, false)).toBe('roadmap');
  });

  it('sends their mega forms in a plan repository', () => {
    expect(pmSkillFor(1, true)).toBe('mega-brainstorm');
    expect(pmSkillFor(4, true)).toBe('mega-roadmap');
  });
});

describe('pmSkillFor, a goal-only mission (PRD omni-loop-24)', () => {
  it('AC-3: sends the roadmap first, at any cap, even for one PRD', () => {
    expect(pmSkillFor(1, false, true)).toBe('roadmap');
    expect(pmSkillFor(10, false, true)).toBe('roadmap');
    expect(pmSkillFor(1, true, true)).toBe('mega-roadmap');
    expect(pmSkillFor(10, true, true)).toBe('mega-roadmap');
    expect(pmSkillFor(1, false, false)).toBe('brainstorm');
  });

  it('sends nothing when no PRD is left under the cap', () => {
    expect(pmSkillFor(0, false, true)).toBeNull();
    expect(pmSkillFor(Number.NaN, true, true)).toBeNull();
  });
});

describe('pmJobLine', () => {
  it('is a line a runner takes, on a mission at alone only', () => {
    const line = pmJobLine('roadmap', 12, 3);
    expect(line).toBe('/omni:roadmap --mission 12 --cap 3');
    const checked = checkRunnerLine(line);
    expect(checked).toMatchObject({ ok: true, skill: 'roadmap', args: '--mission 12 --cap 3' });
    expect(missionRefusal('roadmap', { level: 'alone' })).toBeNull();
    expect(isPmSkill('roadmap')).toBe(true);
    expect(isPmSkill('yolo')).toBe(false);
  });
});

describe('fitCap', () => {
  it('writes the rows that fit, in order, and leaves the rest', () => {
    expect(fitCap(['a', 'b', 'c', 'd'], 2)).toEqual({ written: ['a', 'b'], unwritten: ['c', 'd'] });
    expect(fitCap(['a'], 3)).toEqual({ written: ['a'], unwritten: [] });
    expect(fitCap(['a', 'b'], 0)).toEqual({ written: [], unwritten: ['a', 'b'] });
  });

  it('names what the cap left in the page\'s words', () => {
    expect(notWrittenWords(3)).toBe('not written: the cap is 3');
  });
});

describe('pmRecordOf', () => {
  it('reads the last whole record of its mission, a time stamp before it or not', () => {
    const log = ['12:00:00 working', `12:00:01 ${pmLine(record({ prds: [prd(1)] }))}`, pmLine(record()), pmLine(record({ mission: 13 }))].join('\n');
    expect(pmRecordOf(log, 12)).toEqual(record());
  });

  it('reads none from a log with no record, a broken one, or one of another shape', () => {
    expect(pmRecordOf('nothing here', 12)).toBeNull();
    expect(pmRecordOf('omni pm: {not json', 12)).toBeNull();
    expect(pmRecordOf(`omni pm: ${JSON.stringify({ ...record(), skill: 'yolo' })}`, 12)).toBeNull();
    expect(pmRecordOf(`omni pm: ${JSON.stringify({ ...record(), cap: 11 })}`, 12)).toBeNull();
    expect(pmRecordOf(`omni pm: ${JSON.stringify({ ...record(), unwritten: ['two\nlines'] })}`, 12)).toBeNull();
  });
});

describe('keptOf', () => {
  it('keeps at most the cap the App sent, in order, never a PRD the mission holds, and counts the rest unwritten', () => {
    const wrote = record({ cap: 5, prds: [prd(1), prd(2), prd(2), prd(3), prd(4)], unwritten: ['Refunds by card'] });
    expect(keptOf(wrote, 2, new Set([prd(1)]))).toEqual({ added: [prd(2), prd(3)], unwritten: ['PRD 4', 'Refunds by card'] });
  });

  it('keeps the record\'s own cap when it is lower than the one sent', () => {
    expect(keptOf(record({ cap: 1 }), 3, new Set())).toEqual({ added: [prd(2950)], unwritten: ['PRD 2951'] });
  });
});

describe('planJobLine and planOfLine', () => {
  const product = parseProductPrdId('omni-loop-15');

  it('AC-3: plans a repository PRD with /omni:plan and a product PRD with mega-brainstorm --plan-only, lines a runner takes', () => {
    expect(planJobLine(prd(7), 'plan')).toBe('/omni:plan 7');
    expect(planJobLine(product, 'plan')).toBe('/omni:mega-brainstorm --product omni-loop --plan-only omni-loop-15');
    for (const line of [planJobLine(prd(7), 'plan'), planJobLine(product, 'replan')]) expect(checkRunnerLine(line), line).toMatchObject({ ok: true });
    expect(missionRefusal('mega-brainstorm', { level: 'alone' })).toBeNull();
  });

  it('AC-4: replans with the same skill, its line ending --replan', () => {
    expect(planJobLine(prd(7), 'replan')).toBe('/omni:plan 7 --replan');
    expect(planJobLine(product, 'replan')).toBe('/omni:mega-brainstorm --product omni-loop --plan-only omni-loop-15 --replan');
  });

  it('reads each line back to its PRD and kind', () => {
    for (const [id, kind] of [[prd(7), 'plan'], [prd(7), 'replan'], [product, 'plan'], [product, 'replan']] as const) {
      expect(planOfLine(planJobLine(id, kind)), `${String(id)} ${kind}`).toEqual({ prd: id, kind });
    }
  });

  it('reads no plan from the PM\'s own job, another skill, or a line whose PRD does not read', () => {
    for (const line of [
      pmJobLine('mega-brainstorm', 12, 1),
      '/omni:yolo 7',
      '/omni:plan 0',
      '/omni:plan 7 --mission 12',
      '/omni:plan omni-loop-15',
      '/omni:mega-brainstorm --product mobile --plan-only omni-loop-15',
      '/omni:mega-brainstorm --product omni-loop --plan-only 15',
    ]) expect(planOfLine(line), line).toBeNull();
  });
});

describe('the PM\'s record and line on a product (PRD omni-loop-26)', () => {
  const id = (text: string) => parseProductPrdId(text);

  it('AC-2: reads a record of two product PRDs', () => {
    const log = pmLine(record({ prds: [id('omni-loop-31'), id('omni-loop-32')] }));
    expect(pmRecordOf(log, 12)?.prds).toEqual(['omni-loop-31', 'omni-loop-32']);
    expect(readPmRecord(JSON.parse(log.slice('omni pm: '.length)))).toMatchObject({ ok: true });
  });

  it('AC-2: refuses a record mixing a PRD number and a product id, naming the entry', () => {
    const mixed = { ...record(), prds: ['omni-loop-31', 2950] };
    expect(readPmRecord(mixed)).toEqual({ ok: false, reason: 'prds mixes PRD numbers and product ids: 2950' });
    expect(readPmRecord({ ...record(), prds: [2950, 'omni-loop-31'] })).toEqual({ ok: false, reason: 'prds mixes PRD numbers and product ids: "omni-loop-31"' });
    expect(pmRecordOf(`omni pm: ${JSON.stringify(mixed)}`, 12)).toBeNull();
  });

  it('refuses a record whose product ids do not read, or that names none of a known shape', () => {
    expect(readPmRecord({ ...record(), prds: ['Omni-31'] })).toMatchObject({ ok: false });
    expect(readPmRecord({ ...record(), prds: ['omni-loop-31', 'omni-loop-31', 'omni-loop-31', 'omni-loop-31', 'omni-loop-31', 'omni-loop-31', 'omni-loop-31', 'omni-loop-31', 'omni-loop-31', 'omni-loop-31', 'omni-loop-31'] })).toMatchObject({ ok: false });
    expect(readPmRecord('nope')).toMatchObject({ ok: false });
  });

  it('keeps a product record\'s ids as keptOf keeps numbers: once each, at most the cap, never one held', () => {
    const wrote = record({ cap: 5, prds: [id('omni-loop-31'), id('omni-loop-32'), id('omni-loop-32'), id('omni-loop-33')] });
    expect(keptIdsOf(wrote, 1, new Set([id('omni-loop-31')]))).toEqual({ added: ['omni-loop-32'], unwritten: ['PRD omni-loop-33'] });
    expect(keptOf(wrote, 5, new Set())).toEqual({ added: [], unwritten: [] });
    expect(keptIdsOf(record(), 5, new Set())).toEqual({ added: [], unwritten: [] });
  });

  it('AC-1: adds --product <key> to the PM\'s line for a product, and leaves it unchanged without one', () => {
    expect(pmJobLine('roadmap', 12, 3, 'omni-loop')).toBe('/omni:roadmap --mission 12 --cap 3 --product omni-loop');
    expect(pmJobLine('brainstorm', 12, 1, 'omni-loop')).toBe('/omni:brainstorm --mission 12 --cap 1 --product omni-loop');
    expect(pmJobLine('roadmap', 12, 3)).toBe('/omni:roadmap --mission 12 --cap 3');
    expect(pmJobLine('roadmap', 12, 3, null)).toBe('/omni:roadmap --mission 12 --cap 3');
    expect(checkRunnerLine(pmJobLine('roadmap', 12, 3, 'omni-loop'))).toMatchObject({ ok: true, skill: 'roadmap', args: '--mission 12 --cap 3 --product omni-loop' });
    expect(planOfLine(pmJobLine('roadmap', 12, 3, 'omni-loop'))).toBeNull();
  });

  it('refuses a product key that does not read', () => {
    for (const key of ['Omni', 'omni-31', '', 'a b']) expect(() => pmJobLine('roadmap', 12, 3, key), key).toThrow(/product key/);
  });
});

describe('lastRecordOf', () => {
  const schema = z.object({ n: z.number() });
  it('reads the last whole record of a prefix that matches, a time stamp before it or not', () => {
    const log = ['omni x: {"n":1}', '12:00:00 omni x: {"n":2}', 'omni x: {"n":3', 'omni y: {"n":4}'].join('\n');
    expect(lastRecordOf(log, 'omni x: ', schema, () => true)).toEqual({ n: 2 });
    expect(lastRecordOf(log, 'omni x: ', schema, (one) => one.n === 1)).toEqual({ n: 1 });
    expect(lastRecordOf(log, 'omni z: ', schema, () => true)).toBeNull();
  });
});

describe('the plan line names its mission (bug #3273)', () => {
  const product = parseProductPrdId('omni-loop-15');
  /** The plan line with the mission it is sent for (bug #3273). */
  const lineFor = planJobLine as (prd: ProductPrdId, kind: 'plan' | 'replan', mission?: number) => string;

  it('ends a product PRD\'s plan line with --mission <m>, so the PM knows to print its plan approval', () => {
    expect(lineFor(product, 'plan', 12)).toBe('/omni:mega-brainstorm --product omni-loop --plan-only omni-loop-15 --mission 12');
    expect(lineFor(product, 'replan', 12)).toBe('/omni:mega-brainstorm --product omni-loop --plan-only omni-loop-15 --replan --mission 12');
  });

  it('reads that line back, and a runner takes it', () => {
    for (const kind of ['plan', 'replan'] as const) {
      const line = lineFor(product, kind, 12);
      expect(planOfLine(line), line).toEqual({ prd: product, kind });
      expect(checkRunnerLine(line), line).toMatchObject({ ok: true });
    }
  });
});
