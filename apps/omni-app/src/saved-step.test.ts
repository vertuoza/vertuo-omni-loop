import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { fakeStepLedger } from '../test/saved-steps.ts';
import { asSaved, jobSteps, memorySteps, RENEW_EVERY_MS, savedStep, type StepRun } from './saved-step.ts';

/** Inngest's step, as a replay reads it: the value saved as JSON, then read back. */
const replayed: StepRun = { run: async (_id, fn) => asSaved(await fn()) };
/** A step whose saved value is not what the function returns today, as after a deploy between two replays. */
const savedBefore = (value: unknown): StepRun => ({ run: () => Promise.resolve(value) });

const Out = z.object({ count: z.number(), at: z.string().nullable(), note: z.string().exactOptional() });

describe('savedStep', () => {
  it('gives the value the step saved, read back through its schema', async () => {
    await expect(savedStep(replayed, 'count', Out, () => ({ count: 2, at: null }))).resolves.toEqual({ count: 2, at: null });
  });

  it('fails on a saved value of another shape, naming the step and the field', async () => {
    await expect(savedStep(savedBefore({ count: '2', at: null }), 'count', Out, () => ({ count: 2, at: null }))).rejects.toThrow(
      /^The step "count" came back in an unexpected shape: count: /,
    );
    await expect(savedStep(savedBefore({ count: 2 }), 'count', Out, () => ({ count: 2, at: null }))).rejects.toThrow(/: at: /);
    await expect(savedStep(savedBefore(null), 'count', Out, () => ({ count: 2, at: null }))).rejects.toThrow(/"count"/);
  });

  it('holds no saved value in its error', async () => {
    const run = savedStep(savedBefore({ count: 2, at: 'secret-row-value', note: 7 }), 'count', Out, () => ({ count: 2, at: null }));
    await expect(run).rejects.toThrow(/note/);
    await expect(run).rejects.not.toThrow(/secret-row-value/);
  });
});

describe('savedStep on the ledger (PRD omni-loop-4 s1)', () => {
  const JOB = { id: 'job-40', claim: 'claim-1' };
  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not run a step that has a saved value: it reads the value back', async () => {
    const fake = fakeStepLedger({ steps: { 'job-40': { count: { count: 2, at: null } } } });
    const fn = vi.fn(() => ({ count: 9, at: null }));
    await expect(savedStep(jobSteps({ ledger: fake.ledger, job: JOB }), 'count', Out, fn)).resolves.toEqual({ count: 2, at: null });
    expect(fn).not.toHaveBeenCalled();
    expect(fake.calls.saved).toEqual([]);
  });

  it('saves the value of a step it runs, as JSON, then renews the claim; the next run reads it back', async () => {
    const fake = fakeStepLedger();
    const value = await jobSteps({ ledger: fake.ledger, job: JOB }).run('count', () => ({ count: 2, at: null, note: undefined }));
    expect(value).toStrictEqual({ count: 2, at: null });
    expect(fake.stepsOf('job-40')).toEqual({ count: { count: 2, at: null } });
    expect(fake.calls).toMatchObject({ saved: ['job-40 count'], renewed: ['job-40'] });

    const fn = vi.fn(() => ({ count: 3, at: null }));
    await expect(savedStep(jobSteps({ ledger: fake.ledger, job: { id: 'job-40', claim: 'claim-2' } }), 'count', Out, fn)).resolves.toEqual({ count: 2, at: null });
    expect(fn).not.toHaveBeenCalled();
  });

  it('reads the steps once per run, and a step run twice in one run runs once', async () => {
    const fake = fakeStepLedger();
    const step = jobSteps({ ledger: fake.ledger, job: JOB });
    const fn = vi.fn(() => ({ count: 1, at: null }));
    await savedStep(step, 'count', Out, fn);
    await savedStep(step, 'count', Out, fn);
    await savedStep(step, 'other', Out, () => ({ count: 4, at: 'x' }));
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fake.calls.read).toEqual(['job-40']);
    expect(fake.calls.saved).toEqual(['job-40 count', 'job-40 other']);
  });

  it('a step that returns nothing is saved as null', async () => {
    const fake = fakeStepLedger();
    await expect(savedStep(jobSteps({ ledger: fake.ledger, job: JOB }), 'post', z.null(), () => null)).resolves.toBeNull();
    const step = jobSteps({ ledger: fake.ledger, job: JOB });
    await expect(step.run('none', () => undefined)).resolves.toBeNull();
    expect(fake.stepsOf('job-40')).toEqual({ post: null, none: null });
  });

  it('fails by the step\'s name on a saved value out of shape, running nothing', async () => {
    const fake = fakeStepLedger({ steps: { 'job-40': { count: { count: '2', at: null } } } });
    const fn = vi.fn(() => ({ count: 2, at: null }));
    await expect(savedStep(jobSteps({ ledger: fake.ledger, job: JOB }), 'count', Out, fn)).rejects.toThrow(/^The step "count" came back in an unexpected shape: count: /);
    expect(fn).not.toHaveBeenCalled();
  });

  it('a step that throws saves nothing, and runs again on the next try', async () => {
    const fake = fakeStepLedger();
    await expect(savedStep(jobSteps({ ledger: fake.ledger, job: JOB }), 'count', Out, () => Promise.reject(new Error('GitHub answered 502')))).rejects.toThrow('GitHub answered 502');
    expect(fake.calls.saved).toEqual([]);
    await expect(savedStep(jobSteps({ ledger: fake.ledger, job: JOB }), 'count', Out, () => ({ count: 1, at: null }))).resolves.toEqual({ count: 1, at: null });
  });

  it('a claim taken over stops the run: its steps are not read, nor its value saved', async () => {
    const read = fakeStepLedger();
    read.takeOver('job-40', 'claim-2');
    const fn = vi.fn(() => ({ count: 1, at: null }));
    await expect(savedStep(jobSteps({ ledger: read.ledger, job: JOB }), 'count', Out, fn)).rejects.toThrow('job job-40: its claim was taken over before the step "count"');
    expect(fn).not.toHaveBeenCalled();

    const saved = fakeStepLedger();
    const step = jobSteps({ ledger: saved.ledger, job: JOB });
    await savedStep(step, 'first', Out, () => ({ count: 1, at: null }));
    saved.takeOver('job-40', 'claim-2');
    await expect(savedStep(step, 'second', Out, () => ({ count: 2, at: null }))).rejects.toThrow('job job-40: its claim was taken over before the step "second" was saved');
    expect(saved.stepsOf('job-40')).toEqual({ first: { count: 1, at: null } });
  });

  it('renews the claim every minute while a long step runs, and stops when it ends', async () => {
    vi.useFakeTimers();
    const fake = fakeStepLedger();
    const step = jobSteps({ ledger: fake.ledger, job: JOB, leaseSeconds: 300 });
    const renews = vi.spyOn(fake.ledger, 'renew');
    let finish = (): void => undefined;
    const long = savedStep(step, 'draft', z.string(), () => new Promise<string>((resolve) => {
      finish = () => {
        resolve('a lesson');
      };
    }));
    await vi.advanceTimersByTimeAsync(RENEW_EVERY_MS * 3 + 1);
    expect(renews).toHaveBeenCalledTimes(3);
    expect(renews).toHaveBeenLastCalledWith({ ...JOB, leaseSeconds: 300 });
    finish();
    await expect(long).resolves.toBe('a lesson');
    expect(renews).toHaveBeenCalledTimes(4);
    await vi.advanceTimersByTimeAsync(RENEW_EVERY_MS * 3);
    expect(renews).toHaveBeenCalledTimes(4);
  });

  it('a renew that fails while a step runs is logged, and the step goes on', async () => {
    vi.useFakeTimers();
    const fake = fakeStepLedger();
    const lines: string[] = [];
    const ledger = { ...fake.ledger, renew: vi.fn().mockRejectedValueOnce(new Error('the database refused: timeout\nat line 2')).mockResolvedValue('stale') };
    const step = jobSteps({ ledger, job: JOB, log: (line) => lines.push(line) });
    let finish = (): void => undefined;
    const long = step.run('draft', () => new Promise<string>((resolve) => {
      finish = () => {
        resolve('a lesson');
      };
    }));
    await vi.advanceTimersByTimeAsync(RENEW_EVERY_MS * 2 + 1);
    expect(lines).toEqual(['job job-40: its claim was not renewed: the database refused: timeout', 'job job-40: its claim was taken over while the step "draft" ran']);
    finish();
    await expect(long).rejects.toThrow('job job-40: its claim was taken over after the step "draft" was saved');
  });
});

describe('memorySteps', () => {
  it('keeps each step\'s value, as JSON, for one run', async () => {
    const step = memorySteps();
    const fn = vi.fn(() => ({ count: 1, at: null, note: undefined }));
    await expect(step.run('count', fn)).resolves.toStrictEqual({ count: 1, at: null });
    await expect(step.run('count', fn)).resolves.toStrictEqual({ count: 1, at: null });
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('asSaved', () => {
  it('is JSON and back: undefined fields go, a missing value is null', () => {
    expect(asSaved({ a: 1, b: undefined, c: [1, undefined] })).toEqual({ a: 1, c: [1, null] });
    expect(asSaved(undefined)).toBeNull();
  });
});
