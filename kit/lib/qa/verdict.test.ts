// QA's verdict and its record line (PRD 3001 s1): a pass, or one to five bugs by their issues; the last line of a job's log wins.
import { describe, expect, it } from 'vitest';
import { parseIssue, parsePr } from '../ids.ts';
import { QaVerdictSchema, qaLine, qaPostedLine, type QaVerdict } from './verdict.ts';

const URL = 'https://github.com/acme/widgets/pull/12#issuecomment-99';

const bugs = (...issues: number[]): { issue: number }[] => issues.map((issue) => ({ issue }));

describe('QaVerdictSchema', () => {
  it('accepts a pass in either round', () => {
    expect(QaVerdictSchema.safeParse({ round: 1, verdict: 'pass' }).success).toBe(true);
    expect(QaVerdictSchema.safeParse({ round: 2, verdict: 'pass' }).success).toBe(true);
  });

  it('accepts one to five bugs, each by its issue', () => {
    expect(QaVerdictSchema.safeParse({ round: 1, verdict: 'bugs', bugs: bugs(12) }).success).toBe(true);
    expect(QaVerdictSchema.safeParse({ round: 2, verdict: 'bugs', bugs: bugs(1, 2, 3, 4, 5) }).success).toBe(true);
  });

  it('refuses no bug, and a sixth', () => {
    expect(QaVerdictSchema.safeParse({ round: 1, verdict: 'bugs', bugs: [] }).success).toBe(false);
    expect(QaVerdictSchema.safeParse({ round: 1, verdict: 'bugs', bugs: bugs(1, 2, 3, 4, 5, 6) }).success).toBe(false);
  });

  it('refuses a missing round, and a round other than 1 or 2', () => {
    expect(QaVerdictSchema.safeParse({ verdict: 'pass' }).success).toBe(false);
    expect(QaVerdictSchema.safeParse({ round: 0, verdict: 'pass' }).success).toBe(false);
    expect(QaVerdictSchema.safeParse({ round: 3, verdict: 'pass' }).success).toBe(false);
    expect(QaVerdictSchema.safeParse({ round: 1.5, verdict: 'pass' }).success).toBe(false);
    expect(QaVerdictSchema.safeParse({ round: '1', verdict: 'pass' }).success).toBe(false);
  });

  it('refuses a bug without a valid issue, one issue twice, and a verdict it does not know', () => {
    expect(QaVerdictSchema.safeParse({ round: 1, verdict: 'bugs', bugs: [{}] }).success).toBe(false);
    expect(QaVerdictSchema.safeParse({ round: 1, verdict: 'bugs', bugs: bugs(0) }).success).toBe(false);
    expect(QaVerdictSchema.safeParse({ round: 1, verdict: 'bugs', bugs: bugs(-3) }).success).toBe(false);
    expect(QaVerdictSchema.safeParse({ round: 1, verdict: 'bugs', bugs: bugs(12, 12) }).success).toBe(false);
    expect(QaVerdictSchema.safeParse({ round: 1, verdict: 'bugs' }).success).toBe(false);
    expect(QaVerdictSchema.safeParse({ round: 1, verdict: 'pass', bugs: bugs(12) }).success).toBe(false);
    expect(QaVerdictSchema.safeParse({ round: 1, verdict: 'changes' }).success).toBe(false);
  });
});

describe('qaPostedLine', () => {
  it('writes a pass and its bugs as the line qaLine reads', () => {
    const pass: QaVerdict = { round: 2, verdict: 'pass' };
    expect(qaPostedLine(pass, parsePr(12), URL)).toBe(`omni qa: posted round 2 (pass) on PR #12: ${URL}`);
    const found: QaVerdict = { round: 1, verdict: 'bugs', bugs: [{ issue: parseIssue(3012) }, { issue: parseIssue(3013) }] };
    expect(qaPostedLine(found, parsePr(12), URL)).toBe(`omni qa: posted round 1 (bugs, 2: #3012 #3013) on PR #12: ${URL}`);
  });

  it('round-trips through qaLine', () => {
    const found: QaVerdict = { round: 1, verdict: 'bugs', bugs: [{ issue: parseIssue(7) }] };
    expect(qaLine(qaPostedLine(found, parsePr(4), URL))).toEqual({ verdict: found, count: 1, pr: 4, url: URL });
  });
});

describe('qaLine: QA\'s verdict, from its job\'s log', () => {
  it('reads a pass: its round, no bug, its pull request and its comment', () => {
    expect(qaLine(`omni qa: posted round 2 (pass) on PR #12: ${URL}`)).toEqual({
      verdict: { round: 2, verdict: 'pass' },
      count: 0,
      pr: 12,
      url: URL,
    });
  });

  it('reads bugs: their count and their issues, in the order QA gave them', () => {
    expect(qaLine(`checking\n10:01:02 omni qa: posted round 1 (bugs, 2: #13 #12) on PR #12: ${URL}\ndone`)).toEqual({
      verdict: { round: 1, verdict: 'bugs', bugs: [{ issue: 13 }, { issue: 12 }] },
      count: 2,
      pr: 12,
      url: URL,
    });
    expect(qaLine(`omni qa: posted round 2 (bugs, 5: #1 #2 #3 #4 #5) on PR #9: ${URL}`)?.count).toBe(5);
  });

  it('takes the last QA line of the log', () => {
    const log = [`omni qa: posted round 1 (bugs, 1: #12) on PR #12: ${URL}`, 'fixing', `omni qa: posted round 2 (pass) on PR #12: ${URL}  `].join('\n');
    expect(qaLine(log)?.verdict).toEqual({ round: 2, verdict: 'pass' });
  });

  it('keeps a comment link only when it is GitHub\'s, on a pull request', () => {
    expect(qaLine('omni qa: posted round 1 (pass) on PR #12: https://evil.example/pull/12')).toMatchObject({ url: null });
    expect(qaLine('omni qa: posted round 1 (pass) on PR #12: https://github.com/acme/widgets/pull/12')).toMatchObject({ url: 'https://github.com/acme/widgets/pull/12' });
    expect(qaLine('omni qa: posted round 1 (pass) on PR #12: https://github.com/acme/widgets/pull/12#issuecomment-x')).toMatchObject({ url: null });
  });

  it('reads nothing from a log without a QA line', () => {
    expect(qaLine('')).toBeNull();
    expect(qaLine('nothing posted here')).toBeNull();
    expect(qaLine(`omni review: posted round 1 (pass) on PR #12: ${URL}`)).toBeNull();
  });

  it('refuses a sixth bug', () => {
    expect(qaLine(`omni qa: posted round 1 (bugs, 6: #1 #2 #3 #4 #5 #6) on PR #12: ${URL}`)).toBeNull();
    expect(qaLine(`omni qa: posted round 1 (bugs, 6) on PR #12: ${URL}`)).toBeNull();
  });

  it('refuses a last line it cannot read, even after one it could', () => {
    const readable = `omni qa: posted round 1 (pass) on PR #12: ${URL}`;
    for (const unreadable of [
      `omni qa: posted round 3 (pass) on PR #12: ${URL}`,
      `omni qa: posted round 1 (bugs, 0) on PR #12: ${URL}`,
      `omni qa: posted round 1 (bugs, 2) on PR #12: ${URL}`,
      `omni qa: posted round 1 (bugs, 2: #12) on PR #12: ${URL}`,
      `omni qa: posted round 1 (bugs, 1: #12 #13) on PR #12: ${URL}`,
      `omni qa: posted round 1 (bugs, 2: #12 #12) on PR #12: ${URL}`,
      `omni qa: posted round 1 (bugs, 1: #0) on PR #12: ${URL}`,
      `omni qa: posted round 1 (pass, 1) on PR #12: ${URL}`,
      `omni qa: posted round 1 (changes, 2) on PR #12: ${URL}`,
      `omni qa: posted round 1 (pass) on PR #0: ${URL}`,
      `omni qa: posted round 1 (pass) on PR #12:`,
      'omni qa: posted round 1 (pass)',
      `omni qa: posted round 1 (pass) on PR #12: ${URL} trailing`,
    ]) {
      expect(qaLine(`${readable}\n${unreadable}`), unreadable).toBeNull();
    }
  });
});
