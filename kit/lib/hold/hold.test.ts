import { describe, expect, it } from 'vitest';
import { exitOf, mergeAfterLines, parsePullRef, refText, rowLine, rowOf, verdictOf } from './hold.ts';

const api41 = { repo: 'demo-org/api', number: 41 };

describe('mergeAfterLines', () => {
  it('reads several lines in the body order, each once', () => {
    const body = 'Adds the field.\n\nMerge after demo-org/api#41\n- Merge after demo-org/auth#7\nMerge after demo-org/api#41\n';
    expect(mergeAfterLines(body, 'demo-org/web').map(refText)).toEqual(['demo-org/api#41', 'demo-org/auth#7']);
  });

  it('takes a line with no repository as the consumer\'s own', () => {
    expect(mergeAfterLines('Merge after #12', 'demo-org/web')).toEqual([{ repo: 'demo-org/web', number: 12 }]);
  });

  it('is empty with no such line', () => {
    expect(mergeAfterLines('Merge after the holidays\nsee demo-org/api#41', 'demo-org/web')).toEqual([]);
  });
});

describe('parsePullRef', () => {
  it('reads owner/repo#n and nothing else', () => {
    expect(parsePullRef('demo-org/api#41')).toEqual(api41);
    expect(parsePullRef('#41')).toBeNull();
    expect(parsePullRef('demo-org/api')).toBeNull();
  });
});

describe('rows and verdict', () => {
  it('holds an open provider', () => {
    const row = rowOf(api41, { state: 'OPEN' });
    expect(rowLine(row)).toBe('demo-org/api#41 open held');
    expect(verdictOf([row]).line).toBe('held: demo-org/api#41 it is not merged yet');
  });

  it('clears a merged one, fails a closed one, never clears an unread one', () => {
    expect(verdictOf([rowOf(api41, { state: 'MERGED' })])).toEqual({ kind: 'clear', line: 'clear' });
    expect(verdictOf([rowOf(api41, { state: 'CLOSED' })]).kind).toBe('fail');
    const unread = verdictOf([rowOf(api41, { failure: 'no access' })]);
    expect(unread.line).toBe('not judged: could not read demo-org/api#41: no access');
    expect(exitOf(unread)).toBe(1);
  });

  it('puts a fail before a held row, and is clear with no row', () => {
    const rows = [rowOf(api41, { state: 'OPEN' }), rowOf({ repo: 'demo-org/auth', number: 7 }, { state: 'CLOSED' })];
    expect(verdictOf(rows).kind).toBe('fail');
    expect(verdictOf([]).kind).toBe('clear');
  });
});

describe('a merged provider\'s probe (s3)', () => {
  const served = { hook: 'demo-org/api:.omni-loop/flow/served.md', mode: 'replace' as const, text: 'Check.' };

  it('names each probe to follow, exit 0, and runs nothing', () => {
    const row = rowOf(api41, { state: 'MERGED' }, { probes: [served] });
    expect(rowLine(row)).toBe('demo-org/api#41 merged · probe demo-org/api:.omni-loop/flow/served.md probe');
    expect(row.probes).toEqual([served]);
    const verdict = verdictOf([row, rowOf({ repo: 'demo-org/auth', number: 7 }, { state: 'MERGED' })]);
    expect(verdict).toEqual({ kind: 'probe', line: 'probe: demo-org/api#41 follow demo-org/api:.omni-loop/flow/served.md' });
    expect(exitOf(verdict)).toBe(0);
  });

  it('is clear when the provider declares no probe', () => {
    expect(rowOf(api41, { state: 'MERGED' }, { probes: [] })).toEqual({ provider: 'demo-org/api#41', what: 'merged · no probe', status: 'clear', why: 'it is merged' });
  });

  it('never clears a probe it could not read', () => {
    const row = rowOf(api41, { state: 'MERGED' }, { failure: 'the probe served.md of demo-org/api cannot be read: HTTP 500' });
    expect(rowLine(row)).toBe('demo-org/api#41 merged · probe not read not judged');
    expect(verdictOf([row]).line).toBe('not judged: the probe served.md of demo-org/api cannot be read: HTTP 500');
  });

  it('puts a held row before a probe, and lists every probe row', () => {
    const other = rowOf({ repo: 'demo-org/auth', number: 7 }, { state: 'MERGED' }, { probes: [{ ...served, hook: 'demo-org/auth:p.md' }] });
    expect(verdictOf([rowOf(api41, { state: 'MERGED' }, { probes: [served] }), rowOf({ repo: 'demo-org/web', number: 3 }, { state: 'OPEN' })]).kind).toBe('held');
    expect(verdictOf([rowOf(api41, { state: 'MERGED' }, { probes: [served] }), other]).line).toBe(
      'probe: demo-org/api#41 follow demo-org/api:.omni-loop/flow/served.md; demo-org/auth#7 follow demo-org/auth:p.md',
    );
  });
});
