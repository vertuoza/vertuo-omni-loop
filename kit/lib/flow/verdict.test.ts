import { describe, expect, it } from 'vitest';
import { readVerdict, verdictLine } from './verdict.ts';

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

describe('verdictLine', () => {
  it('prints ok, ok with its note, or not ok with the point and why', () => {
    expect(verdictLine('do-work.test', { ok: true, note: null })).toBe('ok');
    expect(verdictLine('wave.merge', { ok: true, note: '#1203' })).toBe('ok #1203');
    expect(verdictLine('do-work.test', { ok: false, why: 'no verdict' })).toBe('not ok do-work.test no verdict');
  });
});
