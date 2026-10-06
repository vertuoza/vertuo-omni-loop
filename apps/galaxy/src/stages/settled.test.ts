import { describe, expect, it } from 'vitest';
import { settled } from './settled';

describe('a fake store\'s answer', () => {
  it('resolves with what the read returns', async () => {
    await expect(settled(() => 3)).resolves.toBe(3);
  });

  it('rejects, never throws, when the read throws, as an async method does', async () => {
    const answer = settled(() => { throw new Error('Supabase refused: down'); });
    await expect(answer).rejects.toThrow('Supabase refused: down');
  });
});
