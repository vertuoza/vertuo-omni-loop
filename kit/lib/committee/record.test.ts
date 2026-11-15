// PRD 2896 s9: the committee's record line, the one line of its job's log the App reads back. It carries the files the
// committee read, by hash, what the escalation list named and each verdict; never a line of the log, a person's words or a
// credential (L-GDPR-2).
import { describe, expect, it } from 'vitest';
import { parsePrd } from '../ids.ts';
import { committeeLine, committeeOf, type CommitteeRecord } from './record.ts';

const prd = parsePrd(2896);
const sha = (c: string) => c.repeat(64);

const record = (over: Partial<CommitteeRecord> = {}): CommitteeRecord => ({
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

  it('refuses a file read that is no sha256, more than ten reasons, or a reason over 300 characters', () => {
    expect(committeeOf(committeeLine(record({ read: [{ kind: 'spec', sha256: 'abc' }] })), prd)).toBeNull();
    expect(committeeOf(committeeLine(record({ escalations: Array.from({ length: 11 }, () => 'why') })), prd)).toBeNull();
    expect(committeeOf(committeeLine(record({ escalations: ['x'.repeat(301)] })), prd)).toBeNull();
  });
});
