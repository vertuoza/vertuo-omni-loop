// The `omni repair:` record line (PRD 2980 s1): the last one in a job's log wins, and a missing or malformed one reads unreadable.
import { describe, expect, it } from 'vitest';
import { fingerprint } from './fingerprint.ts';
import { repairLine, repairRecordLine, type RepairRecord } from './line.ts';
import type { RepairRetro } from './retro.ts';

const WRITTEN = 'c'.repeat(64);

const retro = (over: Partial<RepairRetro> = {}): RepairRetro => ({
  cause: 'The sum test expects the old rounding.',
  class: 'code',
  place: 'kit/lib/sum.test.ts',
  signature: 'AssertionError: expected 3 to be 4',
  evidence: ['The test failed on the rounding branch only.'],
  proposedFix: 'Round half up in sum().',
  fingerprint: WRITTEN,
  ...over,
});

const record = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  v: 1,
  mission: 12,
  prd: 2950,
  fingerprint: WRITTEN,
  class: 'code',
  retro: retro(),
  fix: 3001,
  report: null,
  ...over,
});

const line = (value: Record<string, unknown>): string => `omni repair: ${JSON.stringify(value)}`;

const report = { kitVersion: '0.0.659', command: '/omni:yolo', class: 'omni-loop', message: 'omni next crashed', fingerprint: WRITTEN };

describe('repairLine', () => {
  it('reads the last record line of a log, a time stamp before it or not', () => {
    const log = ['12:00:00 working', `12:00:01 ${line(record({ fix: 3000 }))}`, 'more output', `12:00:09 ${line(record())}`, 'done'].join('\n');
    const read = repairLine(log);
    expect(read.readable).toBe(true);
    if (!read.readable) return;
    expect(read.record).toMatchObject({ mission: 12, prd: 2950, class: 'code', fix: 3001, report: null });
  });

  it('never takes the fingerprint on trust: it is computed again from the retro', () => {
    const read = repairLine(line(record()));
    const expected = fingerprint(retro());
    expect(read).toMatchObject({ readable: true, record: { fingerprint: expected, retro: { fingerprint: expected } } });
  });

  it('answers unreadable when the log holds no record line', () => {
    expect(repairLine('')).toEqual({ readable: false, reason: 'missing' });
    expect(repairLine('omni pm: {"v":1}\nall done')).toEqual({ readable: false, reason: 'missing' });
  });

  it('answers unreadable when the last record line is malformed, even after a whole one', () => {
    expect(repairLine('omni repair: {not json')).toEqual({ readable: false, reason: 'malformed' });
    expect(repairLine([line(record()), 'omni repair: {"v":1}'].join('\n'))).toEqual({ readable: false, reason: 'malformed' });
    expect(repairLine(line(record({ v: 2 })))).toEqual({ readable: false, reason: 'malformed' });
    expect(repairLine(line(record({ prd: 0 })))).toEqual({ readable: false, reason: 'malformed' });
    expect(repairLine(line(record({ retro: { ...retro(), evidence: ['One. Two.'] } })))).toEqual({ readable: false, reason: 'malformed' });
  });

  it('reads a product PRD by its id, and the repository its fix was opened in (bug #3302)', () => {
    const read = repairLine(line(record({ prd: 'omni-loop-27', repo: 'acme/web' })));
    expect(read).toMatchObject({ readable: true, record: { prd: 'omni-loop-27', repo: 'acme/web', fix: 3001 } });
    expect(repairLine(line(record({ prd: 'omni-loop-0' })))).toEqual({ readable: false, reason: 'malformed' });
    expect(repairLine(line(record({ repo: 'not a repository' })))).toEqual({ readable: false, reason: 'malformed' });
    const flake = { class: 'flake', retro: retro({ class: 'flake' }), fix: null };
    expect(repairLine(line(record({ ...flake, repo: 'acme/web' })))).toEqual({ readable: false, reason: 'malformed' });
  });

  it('answers unreadable when the record contradicts its retro', () => {
    expect(repairLine(line(record({ class: 'flake', fix: null })))).toEqual({ readable: false, reason: 'malformed' });
    expect(repairLine(line(record({ fingerprint: 'd'.repeat(64) })))).toEqual({ readable: false, reason: 'malformed' });
  });

  it('takes a fix only from a code repair, and a report only from an omni-loop one', () => {
    const flake = { class: 'flake', retro: retro({ class: 'flake' }), report: null };
    expect(repairLine(line(record({ ...flake, fix: null }))).readable).toBe(true);
    expect(repairLine(line(record({ ...flake, fix: 3001 })))).toEqual({ readable: false, reason: 'malformed' });

    const omniLoop = { class: 'omni-loop', retro: retro({ class: 'omni-loop' }), fix: null };
    const read = repairLine(line(record({ ...omniLoop, report })));
    expect(read).toMatchObject({ readable: true, record: { report: { message: 'omni next crashed', fingerprint: fingerprint(retro({ class: 'omni-loop' })) } } });
    expect(repairLine(line(record({ ...omniLoop, report: null }))).readable).toBe(true);
    expect(repairLine(line(record({ report: { ...report, class: 'code' } })))).toEqual({ readable: false, reason: 'malformed' });
  });

  it('refuses a report that is not clean', () => {
    const omniLoop = { class: 'omni-loop', retro: retro({ class: 'omni-loop' }), fix: null };
    expect(repairLine(line(record({ ...omniLoop, report: { ...report, message: 'in /home/dev/widgets/a.ts' } })))).toEqual({ readable: false, reason: 'malformed' });
  });
});

describe('repairLine trigger (PRD 3065)', () => {
  it('reads a line with no trigger as a failure', () => {
    expect(repairLine(line(record()))).toMatchObject({ readable: true, record: { trigger: 'failure', prd: 2950 } });
  });

  it('reads a stuck repair, with a PRD or with a null one', () => {
    expect(repairLine(line(record({ trigger: 'stuck' })))).toMatchObject({ readable: true, record: { trigger: 'stuck', prd: 2950 } });
    expect(repairLine(line(record({ trigger: 'stuck', prd: null })))).toMatchObject({ readable: true, record: { trigger: 'stuck', prd: null } });
  });

  it('refuses a failure with a null PRD and an unknown trigger', () => {
    expect(repairLine(line(record({ prd: null })))).toEqual({ readable: false, reason: 'malformed' });
    expect(repairLine(line(record({ trigger: 'failure', prd: null })))).toEqual({ readable: false, reason: 'malformed' });
    expect(repairLine(line(record({ trigger: 'milestone' })))).toEqual({ readable: false, reason: 'malformed' });
  });

  it('writes the stuck line it reads', () => {
    const read = repairLine(line(record({ trigger: 'stuck', prd: null })));
    expect(read.readable).toBe(true);
    if (!read.readable) return;
    expect(repairRecordLine(read.record)).toContain('"trigger":"stuck"');
    expect(repairLine(repairRecordLine(read.record))).toEqual(read);
  });
});

describe('repairRecordLine', () => {
  it('writes the line repairLine reads', () => {
    const read = repairLine(line(record()));
    expect(read.readable).toBe(true);
    if (!read.readable) return;
    const written: RepairRecord = read.record;
    expect(repairRecordLine(written).startsWith('omni repair: {"v":1,')).toBe(true);
    expect(repairLine(repairRecordLine(written))).toEqual(read);
  });
});
