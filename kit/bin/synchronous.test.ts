import { describe, expect, it } from 'vitest';
import { synchronous } from './synchronous.ts';

describe('synchronous', () => {
  it('resolves with the code the work returns, given its arguments', async () => {
    const run = synchronous((a: number, b: number) => a + b);
    await expect(run(2, 3)).resolves.toBe(5);
  });

  it('rejects with what the work throws, rather than throwing on the call', async () => {
    const run = synchronous((): number => {
      throw new Error('usage');
    });
    const promise = run();
    await expect(promise).rejects.toThrow('usage');
  });
});
