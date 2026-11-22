import { describe, expect, it } from 'vitest';
import { parsePr, parsePrd } from 'omni-loop/kit/lib/ids.ts';
import { endedHalfway, halfwayEvent, halfwayWords, resumeCap, resumeNext, resumeStep, resumeWords, stepJobs, type StepJob } from './resume.ts';
import type { Attempt, Step } from './supervisor.ts';

// The resume step's decisions (PRD omni-loop-21 s10): pure, over a step's jobs whose latest ended halfway.

const halfway = (id: string, over: Partial<Attempt> = {}): Attempt => ({ id, status: 'done', outcome: null, reason: null, prUrl: null, ...over });
const job = (resume: number, over: Partial<Attempt> = {}, step: Step = 'build'): StepJob => ({
  prd: parsePrd(1),
  run: 1,
  step,
  job: `job-${String(resume)}`,
  attempts: [halfway(`job-${String(resume)}`, over)],
  ...(resume === 0 ? {} : { resume }),
});
const LIMITED = { limitedUntil: '2027-01-26T10:00:00Z' };

describe('endedHalfway', () => {
  it('reads a done job with no result line its step reads, and nothing else', () => {
    expect(endedHalfway(halfway('a'))).toBe(true);
    expect(endedHalfway(halfway('a', { outcome: 'thinking' }))).toBe(true);
    for (const outcome of ['ready', 'answers', 'human', 'held', 'review', 'changes']) expect(endedHalfway(halfway('a', { outcome }))).toBe(false);
    expect(endedHalfway(halfway('a', { status: 'failed' }))).toBe(false);
    expect(endedHalfway(halfway('a', { status: 'cancelled' }))).toBe(false);
    expect(endedHalfway(halfway('a', { status: 'running' }))).toBe(false);
    expect(endedHalfway(halfway('a', { checked: { verdict: { round: 1, verdict: 'pass' }, count: 0, pr: parsePr(7), url: null } }))).toBe(false);
  });
});

describe('resumeCap', () => {
  it('is mandate.resumes at alone, 3 when it says nothing, and none below alone', () => {
    expect(resumeCap({ level: 'alone', resumes: 5 })).toBe(5);
    expect(resumeCap({ level: 'alone', resumes: 0 })).toBe(0);
    expect(resumeCap({ level: 'alone' })).toBe(3);
    expect(resumeCap({ level: 'with-you', resumes: 5 })).toBeNull();
    expect(resumeCap({ level: 'own-branch' })).toBeNull();
  });
});

describe('resumeNext', () => {
  it('AC-6: sends one fresh job while the step ended halfway at most `cap` times, counting each end', () => {
    expect(resumeNext([job(0)], 3)).toEqual({ next: 'resume', resume: 1, count: 1, cap: 3, counted: true });
    expect(resumeNext([job(1), job(0), job(2)], 3)).toEqual({ next: 'resume', resume: 3, count: 3, cap: 3, counted: true });
  });

  it('AC-6: goes to repair past `cap` ends, and at once with a cap of 0', () => {
    expect(resumeNext([job(0), job(1), job(2), job(3)], 3)).toEqual({ next: 'repair', why: 'it ended without its result line 4 times', count: 4 });
    expect(resumeNext([job(0)], 0)).toEqual({ next: 'repair', why: 'it ended without its result line once', count: 1 });
  });

  it('reads 3 when the mandate says nothing', () => {
    expect(resumeNext([job(0), job(1), job(2)])).toMatchObject({ next: 'resume', resume: 3 });
    expect(resumeNext([job(0), job(1), job(2), job(3)])).toMatchObject({ next: 'repair' });
  });

  it('AC-6: counts no end on a spend or rate limit', () => {
    expect(resumeNext([job(0, LIMITED)], 0)).toEqual({ next: 'resume', resume: 1, count: 0, cap: 0, counted: false });
    expect(resumeNext([job(0), job(1, LIMITED)], 1)).toEqual({ next: 'resume', resume: 2, count: 1, cap: 1, counted: false });
    expect(resumeNext([job(0), job(1, LIMITED), job(2)], 1)).toMatchObject({ next: 'repair' });
  });

  it('goes to repair past the tenth key, limits or not', () => {
    const eleven = Array.from({ length: 11 }, (_, k) => job(k, LIMITED));
    expect(resumeNext(eleven, 10)).toEqual({ next: 'repair', why: 'it ended without its result line 0 times', count: 0 });
    expect(resumeNext(eleven.slice(0, 10), 10)).toMatchObject({ next: 'resume', resume: 10 });
  });
});

describe('resumeStep', () => {
  it('reads a build, a Reviewer or a fix that ended halfway at alone', () => {
    for (const step of ['build', 'review:1', 'fix:1', 'review:2'] as const) expect(resumeStep([job(0, {}, step)], job(0, {}, step), 3)).toMatchObject({ next: 'resume', resume: 1 });
  });

  it('reads nothing below alone, for an end with its result line, or for the QA pair', () => {
    expect(resumeStep([job(0)], job(0), null)).toBeNull();
    expect(resumeStep([job(0, { outcome: 'held' })], job(0, { outcome: 'held' }), 3)).toBeNull();
    expect(resumeStep([job(0, { status: 'failed' })], job(0, { status: 'failed' }), 3)).toBeNull();
    expect(resumeStep([job(0, {}, 'qa:1')], job(0, {}, 'qa:1'), 3)).toBeNull();
    expect(resumeStep([job(0, {}, 'qa-fix:1:1')], job(0, {}, 'qa-fix:1:1'), 3)).toBeNull();
  });

  it("counts the step's jobs up to the one read, never a resume sent after it", () => {
    const runs = [job(0), job(1), { ...job(2), attempts: [{ ...halfway('job-2'), status: 'queued' as const }] }];
    expect(resumeStep(runs, job(1), 3)).toMatchObject({ next: 'resume', resume: 2, count: 2 });
  });
});

describe('the words', () => {
  it('say the resume and its count, a limit counting none, and the repair', () => {
    expect(halfwayWords('PRD 1', resumeNext([job(0)], 3))).toBe('PRD 1 ended without its result line: the mission sends it a fresh job (resume 1 of 3).');
    expect(halfwayWords('PRD 1', resumeNext([job(0, LIMITED)], 3))).toBe('PRD 1 ended without its result line: the mission sends it a fresh job (a spend or rate limit counts none).');
    expect(halfwayWords('PRD 1', resumeNext([job(0)], 0))).toBe('PRD 1 ended without its result line once: the mission sends a repair, while it has one left.');
    expect(resumeWords(job(0))).toBe('');
    expect(resumeWords(job(2))).toBe(', resume 2');
  });

  it('the halfway end is a `held` event of its job, signed by the supervisor; none for any other end', () => {
    expect(halfwayEvent(parsePrd(1), job(1), [job(0), job(1)], 3)).toEqual({
      kind: 'held',
      role: 'supervisor',
      prd: 1,
      job: 'job-1',
      link: null,
      sentence: 'PRD 1 ended without its result line: the mission sends it a fresh job (resume 2 of 3).',
    });
    expect(halfwayEvent(parsePrd(1), job(0, { outcome: 'ready' }), [job(0, { outcome: 'ready' })], 3)).toBeNull();
    expect(halfwayEvent(parsePrd(1), job(0), [job(0)], null)).toBeNull();
  });
});

describe('stepJobs', () => {
  it('keeps the jobs of one PRD, run and step, up to the one given', () => {
    const other: StepJob = { ...job(0), step: 'review:1', job: 'r' };
    const later: StepJob = { ...job(0), run: 2, job: 'b2' };
    expect(stepJobs([job(0), other, later, job(1), job(2)], job(1)).map((one) => one.job)).toEqual(['job-0', 'job-1']);
  });
});
