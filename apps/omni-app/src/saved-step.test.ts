import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { asSaved, savedStep, type StepRun } from './saved-step.ts';

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

describe('asSaved', () => {
  it('is JSON and back: undefined fields go, a missing value is null', () => {
    expect(asSaved({ a: 1, b: undefined, c: [1, undefined] })).toEqual({ a: 1, c: [1, null] });
    expect(asSaved(undefined)).toBeNull();
  });
});
