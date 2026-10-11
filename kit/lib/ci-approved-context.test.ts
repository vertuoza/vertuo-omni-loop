// `ci.approvedContext` (PRD 1612, s1): the name of the check run the omni-loop App posts on a PRD's
// pull requests, `omni/approved` unless a repository names another. Its own file: `config.test.ts` is
// a law's proof.
import { describe, expect, it } from 'vitest';
import { parseConfig } from './config.ts';

describe('ci.approvedContext', () => {
  it('defaults to omni/approved, and takes a name a repository gives', () => {
    expect(parseConfig('kit: 1\n').ci.approvedContext).toBe('omni/approved');
    expect(parseConfig('kit: 1\nci:\n  approvedContext: gate/approved\n').ci.approvedContext).toBe('gate/approved');
    expect(parseConfig('kit: 1\nci:\n  approvedContext: gate/approved\n').ci.outboxContext).toBe('outbox');
  });

  it('refuses a name that is not one', () => {
    expect(() => parseConfig('kit: 1\nci:\n  approvedContext: 3\n', 'c.yml')).toThrow(/c\.yml.*ci\.approvedContext/);
    expect(() => parseConfig('kit: 1\nci:\n  approvedContext: ""\n')).toThrow(/ci\.approvedContext/);
  });
});
