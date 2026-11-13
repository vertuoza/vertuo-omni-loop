import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { PART_BYTES, partsOf, savedStepInParts } from './saved-parts.ts';
import { memorySteps, type StepRun } from './saved-step.ts';

const bytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value));

/** Steps kept in `kept`, as the ledger keeps them, so a test reads what was saved and runs again on it. */
function keptSteps(kept = new Map<string, unknown>()): StepRun & { kept: Map<string, unknown> } {
  return {
    kept,
    run: async (id, fn) => {
      if (!kept.has(id)) kept.set(id, JSON.parse(JSON.stringify((await fn()) ?? null)) as unknown);
      return kept.get(id);
    },
  };
}

const Records = z.object({ tails: z.array(z.string()) });
const records = (count: number, line = 'the e2e suite timed out waiting for the page to settle') => ({
  tails: Array.from({ length: count }, (_, index) => `${String(index)}: ${line}`),
});

describe('partsOf', () => {
  it('cuts a text into parts each at most the budget once saved as a JSON string, joined back to the text', () => {
    const text = JSON.stringify(records(300, 'a "quoted" \\ path, é, 漢字 and 🚀 in it'));
    const parts = partsOf(text, 1000);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.join('')).toBe(text);
    for (const part of parts) expect(bytes(part)).toBeLessThanOrEqual(1000);
    expect(Math.max(...parts.map(bytes))).toBeGreaterThan(990);
  });

  it('never cuts a character in two, and counts a control character as its escape', () => {
    const parts = partsOf('🚀'.repeat(50), 12);
    expect(parts.join('')).toBe('🚀'.repeat(50));
    for (const part of parts) expect(part).toBe('🚀🚀');
    expect(partsOf('\u0001\u0001', 8)).toEqual(['\u0001', '\u0001']);
    expect(partsOf('ab', 4)).toEqual(['ab']);
  });

  it('gives a text that fits as one part', () => {
    expect(partsOf('{"a":1}', PART_BYTES)).toEqual(['{"a":1}']);
  });
});

describe('savedStepInParts', () => {
  it('saves a value that fits under the step’s own id, as it is', async () => {
    const steps = keptSteps();
    expect(await savedStepInParts(steps, 'gather-ci', Records, () => records(3))).toEqual(records(3));
    expect([...steps.kept.keys()]).toEqual(['gather-ci']);
    expect(steps.kept.get('gather-ci')).toEqual(records(3));
  });

  it('saves a value over the budget in parts each under it, the head last, and reads it back whole', async () => {
    const steps = keptSteps();
    const value = records(400);
    expect(bytes(value)).toBeGreaterThan(10_000);
    expect(await savedStepInParts(steps, 'gather-ci', Records, () => value, 4096)).toEqual(value);

    const ids = [...steps.kept.keys()];
    expect(ids.at(-1)).toBe('gather-ci');
    expect(ids.length).toBeGreaterThan(3);
    for (const id of ids.slice(0, -1)) expect(id).toMatch(/^gather-ci:part-[0-9a-f]{16}-\d+$/);
    for (const saved of steps.kept.values()) expect(bytes(saved)).toBeLessThanOrEqual(4096);
    expect(steps.kept.get('gather-ci')).toEqual({ 'omni:parts': { hash: expect.any(String) as string, count: ids.length - 1 } });
  });

  it('reads the parts back on a retry without making the value again', async () => {
    const steps = keptSteps();
    const value = records(400);
    await savedStepInParts(steps, 'gather-ci', Records, () => value, 4096);
    const again = await savedStepInParts(steps, 'gather-ci', Records, () => { throw new Error('read again'); }, 4096);
    expect(again).toEqual(value);
  });

  it('reads a value saved whole before parts existed, as it was saved', async () => {
    const steps = keptSteps(new Map([['gather-ci', records(2)]]));
    expect(await savedStepInParts(steps, 'gather-ci', Records, () => records(9), 10)).toEqual(records(2));
  });

  it('never mixes the parts of a run that stopped before its head with a value made differently after', async () => {
    const steps = keptSteps();
    const first = records(1000, 'first');
    let saves = 0;
    const stopping: StepRun = {
      run: async (id, fn) => {
        if (id.includes(':part-') && (saves += 1) > 2) throw new Error('the function stopped');
        return steps.run(id, fn);
      },
    };
    await expect(savedStepInParts(stopping, 'gather-ci', Records, () => first, 4096)).rejects.toThrow('the function stopped');
    expect(steps.kept.has('gather-ci')).toBe(false);

    const second = records(400, 'second, after one more run');
    expect(await savedStepInParts(steps, 'gather-ci', Records, () => second, 4096)).toEqual(second);
    expect(await savedStepInParts(steps, 'gather-ci', Records, () => first, 4096)).toEqual(second);
  });

  it('fails, naming the step, when a part is missing, changed, or the value is of another shape', async () => {
    const steps = keptSteps();
    await savedStepInParts(steps, 'gather-ci', Records, () => records(400), 4096);
    const [firstPart] = [...steps.kept.keys()];

    const changed = keptSteps(new Map(steps.kept));
    changed.kept.set(firstPart ?? '', 'x');
    await expect(savedStepInParts(changed, 'gather-ci', Records, () => records(1), 4096)).rejects.toThrow('The step "gather-ci" came back with parts that do not make the value saved.');

    const notText = keptSteps(new Map(steps.kept));
    notText.kept.set(firstPart ?? '', 1);
    await expect(savedStepInParts(notText, 'gather-ci', Records, () => records(1), 4096)).rejects.toThrow('The step "gather-ci" came back with its part 1 of');

    const missing = keptSteps(new Map(steps.kept));
    missing.kept.delete(firstPart ?? '');
    await expect(savedStepInParts(missing, 'gather-ci', Records, () => records(1), 4096)).rejects.toThrow('The step "gather-ci" has no part 1 of');

    const other = keptSteps(new Map([['gather-ci', { tails: 3 }]]));
    await expect(savedStepInParts(other, 'gather-ci', Records, () => records(1))).rejects.toThrow('The step "gather-ci" came back in an unexpected shape');
  });

  it('saves a null value under the step’s own id, on steps kept for one run', async () => {
    expect(await savedStepInParts(memorySteps(), 'gather-ci', Records.nullable(), () => null)).toBeNull();
  });
});
