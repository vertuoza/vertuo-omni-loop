import { describe, expect, it } from 'vitest';
import { expectedVerdict, readVerdict, verdictLine } from './verdict.ts';

describe('readVerdict', () => {
  it.each([
    ['a pass', 'ran 12 tests\nomni-hook do-work.test: pass\n', { ok: true, note: null }],
    ['a pass with blank lines after it', 'omni-hook do-work.test: pass\n\n  \n', { ok: true, note: null }],
    ['a pass carrying a note', 'merged\nomni-hook do-work.test: pass #1203', { ok: true, note: '#1203' }],
    ['a fail with its why', 'omni-hook do-work.test: fail 2 tests red', { ok: false, why: '2 tests red' }],
    ['a fail with no why', 'omni-hook do-work.test: fail', { ok: false, why: 'fail' }],
    ['no verdict line', 'ran 12 tests\nall green\n', { ok: false, why: 'no verdict' }],
    ['empty output', '', { ok: false, why: 'no verdict' }],
    ['a verdict that is not the last line', 'omni-hook do-work.test: pass\nmore output', { ok: false, why: 'no verdict' }],
    ['a malformed verdict', 'omni-hook do-work.test: green', { ok: false, why: 'no verdict' }],
    ['another point\'s verdict', 'omni-hook pr.open: pass', { ok: false, why: 'no verdict — the last line is pr.open\'s verdict' }],
  ])('reads %s', (_name, output, expected) => {
    expect(readVerdict('do-work.test', output)).toEqual(expected);
  });

  it('reads CRLF output', () => {
    expect(readVerdict('pr.open', 'https://github.com/a/b/pull/7\r\nomni-hook pr.open: pass\r\n')).toEqual({ ok: true, note: null });
  });
});

describe('wait, a verdict of merge-after.served only (PRD 2746)', () => {
  it.each([
    ['a pass', 'omni-hook merge-after.served: pass', { ok: true, note: null }],
    ['a wait with its why', 'schema has no field yet\nomni-hook merge-after.served: wait the field is not deployed', { ok: false, wait: true, why: 'the field is not deployed' }],
    ['a wait with no why', 'omni-hook merge-after.served: wait', { ok: false, wait: true, why: 'not served yet' }],
    ['a fail with its why', 'omni-hook merge-after.served: fail the release was rolled back', { ok: false, why: 'the release was rolled back' }],
  ])('reads %s at merge-after.served', (_name, output, expected) => {
    expect(readVerdict('merge-after.served', output)).toEqual(expected);
  });

  it('refuses wait at every other point', () => {
    expect(readVerdict('do-work.test', 'omni-hook do-work.test: wait tests still running')).toEqual({ ok: false, why: 'wait is not a verdict of do-work.test: it takes pass or fail' });
  });

  it('names wait among the verdicts a hook of merge-after.served may end with, and nowhere else', () => {
    expect(expectedVerdict('merge-after.served')).toBe('omni-hook merge-after.served: pass | omni-hook merge-after.served: wait <why> | omni-hook merge-after.served: fail <why>');
    expect(expectedVerdict('do-work.test')).toBe('omni-hook do-work.test: pass | omni-hook do-work.test: fail <why>');
  });
});

describe('verdictLine', () => {
  it('prints ok, ok with its note, not ok with the point and why, or wait with the point and why', () => {
    expect(verdictLine('do-work.test', { ok: true, note: null })).toBe('ok');
    expect(verdictLine('wave.merge', { ok: true, note: '#1203' })).toBe('ok #1203');
    expect(verdictLine('do-work.test', { ok: false, why: 'no verdict' })).toBe('not ok do-work.test no verdict');
    expect(verdictLine('merge-after.served', { ok: false, wait: true, why: 'not deployed' })).toBe('wait merge-after.served not deployed');
  });
});
