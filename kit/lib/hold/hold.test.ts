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
