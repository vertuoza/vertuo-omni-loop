// PRD 2896 s9: the committee's vote, pure. Every member who sits answers `yes`, or the decision goes to a person with
// the verdicts attached; the hero whose job wrote the PRD sits out and never votes.
import { describe, expect, it } from 'vitest';
import { COMMITTEE_ROLES, parseVotes, sitting, tally, type MemberVerdict } from './vote.ts';

const yes = (role: MemberVerdict['role'], sentence = 'It is in scope and reversible.'): MemberVerdict => ({ role, answer: 'yes', sentence });
const three = (): MemberVerdict[] => COMMITTEE_ROLES.map((role) => yes(role));

describe('who sits', () => {
  it('is the PM, the Architect and the Reviewer, the PM chairing first', () => {
    expect(COMMITTEE_ROLES).toEqual(['pm', 'architect', 'reviewer']);
    expect(sitting(null)).toEqual(['pm', 'architect', 'reviewer']);
  });

  it('leaves out the hero whose job wrote the PRD: on a PRD the PM wrote, the Architect and the Reviewer sit alone', () => {
    expect(sitting('pm')).toEqual(['architect', 'reviewer']);
    expect(sitting('architect')).toEqual(['pm', 'reviewer']);
  });
});

describe('the vote', () => {
  it('carries on three yes', () => {
    expect(tally(three(), null)).toEqual({ outcome: 'carried', why: [], verdicts: three() });
  });

  it('carries on two yes when the author sits out', () => {
    const two = [yes('architect'), yes('reviewer')];
    expect(tally(two, 'pm')).toEqual({ outcome: 'carried', why: [], verdicts: two });
  });

  it('escalates on a no, naming the member and its sentence', () => {
    const verdicts = [yes('pm'), { role: 'architect', answer: 'no', sentence: 'It changes a stored shape.' } as const, yes('reviewer')];
    expect(tally(verdicts, null)).toEqual({ outcome: 'escalated', why: ['the Architect answered no: It changes a stored shape.'], verdicts });
  });

  it('escalates on an unsure', () => {
    const verdicts = [yes('pm'), yes('architect'), { role: 'reviewer', answer: 'unsure', sentence: 'The plan names no test.' } as const];
    expect(tally(verdicts, null).outcome).toBe('escalated');
    expect(tally(verdicts, null).why).toEqual(['the Reviewer answered unsure: The plan names no test.']);
  });

  it('counts a member that failed or timed out as unsure', () => {
    const failed = [yes('pm'), yes('architect'), { role: 'reviewer', answer: 'failed', sentence: 'Its agent exited 1.' } as const];
    const late = [yes('pm'), { role: 'architect', answer: 'timeout', sentence: 'No verdict within 20 minutes.' } as const, yes('reviewer')];
    expect(tally(failed, null)).toMatchObject({ outcome: 'escalated', why: ['the Reviewer failed, counted unsure: Its agent exited 1.'] });
    expect(tally(late, null)).toMatchObject({ outcome: 'escalated', why: ['the Architect timed out, counted unsure: No verdict within 20 minutes.'] });
  });

  it('counts a member who gave no verdict as failed, and records it so', () => {
    const result = tally([yes('pm'), yes('architect')], null);
    expect(result.outcome).toBe('escalated');
    expect(result.verdicts).toContainEqual({ role: 'reviewer', answer: 'failed', sentence: 'It gave no verdict.' });
    expect(result.why).toEqual(['the Reviewer failed, counted unsure: It gave no verdict.']);
  });

  it('never lets the author vote: a verdict of the hero that wrote the PRD escalates, three yes or not', () => {
    const result = tally(three(), 'pm');
    expect(result.outcome).toBe('escalated');
    expect(result.why).toEqual(['the PM wrote it and may not vote on it']);
  });

  it('escalates a member that answered twice', () => {
    const result = tally([...three(), yes('reviewer')], null);
    expect(result.outcome).toBe('escalated');
    expect(result.why).toEqual(['the Reviewer answered twice']);
  });

  it('keeps the verdicts in the committee\'s order, whatever order they came in', () => {
    const shuffled = [yes('reviewer'), yes('pm'), yes('architect')];
    expect(tally(shuffled, null).verdicts.map((v) => v.role)).toEqual(['pm', 'architect', 'reviewer']);
  });
});

describe('the votes file', () => {
  it('reads each verdict: its role, its answer and one sentence', () => {
    expect(parseVotes({ verdicts: three() })).toEqual({ ok: true, verdicts: three() });
  });

  it('refuses an answer that is none of the five, a role off the committee, an empty or overlong sentence', () => {
    const bad = parseVotes({ verdicts: [{ role: 'engineer', answer: 'maybe', sentence: '' }, { role: 'pm', answer: 'yes', sentence: 'x'.repeat(201) }] });
    expect(bad.ok).toBe(false);
    if (bad.ok) return;
    expect(bad.errors.join(' ')).toMatch(/role/);
    expect(bad.errors.join(' ')).toMatch(/answer/);
    expect(bad.errors.join(' ')).toMatch(/sentence/);
  });

  it('refuses a sentence on more than one line', () => {
    expect(parseVotes({ verdicts: [{ role: 'pm', answer: 'yes', sentence: 'One.\nTwo.' }] }).ok).toBe(false);
  });
});
