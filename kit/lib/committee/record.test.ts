// PRD 2896 s9: the committee's record line, the one line of its job's log the App reads back. It carries the files the
// committee read, by hash, what the escalation list named and each verdict; never a line of the log, a person's words or a
// credential (L-GDPR-2).
import { describe, expect, it } from 'vitest';
import { parseOutboxItemId, parsePrd } from '../ids.ts';
import { answerOf, committeeLine, committeeOf, type ApprovalRecord } from './record.ts';

const prd = parsePrd(2896);
const sha = (c: string) => c.repeat(64);

const record = (over: Partial<ApprovalRecord> = {}): ApprovalRecord => ({
  v: 1,
  prd,
  kind: 'approve',
  author: null,
  read: [{ kind: 'spec', sha256: sha('a') }, { kind: 'plan', sha256: sha('b') }, { kind: 'before-after', sha256: sha('c') }],
  escalations: [],
  verdicts: [
    { role: 'pm', answer: 'yes', sentence: 'In scope.' },
    { role: 'architect', answer: 'yes', sentence: 'Reversible.' },
    { role: 'reviewer', answer: 'yes', sentence: 'Tested.' },
  ],
  outcome: 'carried',
  ...over,
});

describe('the record line', () => {
  it('reads back what it wrote', () => {
    const line = committeeLine(record());
    expect(line.startsWith('omni committee: ')).toBe(true);
    expect(line).not.toContain('\n');
    expect(committeeOf(`12:00:01 something\n12:00:02 ${line}\n`, prd)).toEqual(record());
  });

  it('reads the last record for the PRD, a runner\'s stamp left out', () => {
    const first = committeeLine(record({ outcome: 'escalated', escalations: ['it bears on the Legal entry L-GDPR-4'] }));
    const second = committeeLine(record());
    expect(committeeOf(`${first}\n09:10:11 ${second}`, prd)?.outcome).toBe('carried');
  });

  it('reads nothing for another PRD, a line that is no record, or a record that does not parse', () => {
    expect(committeeOf(committeeLine(record()), parsePrd(2871))).toBeNull();
    expect(committeeOf('omni committee: not json', prd)).toBeNull();
    expect(committeeOf('omni committee: {"v":1,"prd":2896,"kind":"approve"}', prd)).toBeNull();
    expect(committeeOf('', prd)).toBeNull();
  });

  it('reads an answer only as an answer, for its own item (PRD 2896 s10)', () => {
    const answered = { ...record(), kind: 'answer' as const, item: parseOutboxItemId('s3-01-keep-the-cap'), option: 'A', read: [{ kind: 'item', sha256: sha('d') }] };
    const log = `${committeeLine(answered)}\n`;
    expect(answerOf(log, prd, 's3-01-keep-the-cap')).toEqual(answered);
    expect(answerOf(log, prd, 's3-02-another')).toBeNull();
    expect(answerOf(log, parsePrd(2871), 's3-01-keep-the-cap')).toBeNull();
    // An approval's reader never takes an answer, nor an answer's an approval.
    expect(committeeOf(log, prd)).toBeNull();
    expect(answerOf(committeeLine(record()), prd, 's3-01-keep-the-cap')).toBeNull();
  });

  it('refuses an answer whose option is no single capital letter, or whose item is no item id', () => {
    const answered = { ...record(), kind: 'answer' as const, item: parseOutboxItemId('s3-01-keep-the-cap'), option: 'AB' };
    expect(answerOf(committeeLine(answered), prd, 's3-01-keep-the-cap')).toBeNull();
    expect(answerOf(`omni committee: ${JSON.stringify({ ...answered, option: 'A', item: 'no item' })}`, prd, 'no item')).toBeNull();
  });

  it('refuses a file read that is no sha256, more than ten reasons, or a reason over 300 characters', () => {
    expect(committeeOf(committeeLine(record({ read: [{ kind: 'spec', sha256: 'abc' }] })), prd)).toBeNull();
    expect(committeeOf(committeeLine(record({ escalations: Array.from({ length: 11 }, () => 'why') })), prd)).toBeNull();
    expect(committeeOf(committeeLine(record({ escalations: ['x'.repeat(301)] })), prd)).toBeNull();
  });
});
