import { describe, expect, it, vi } from 'vitest';
import type { ScoreSend } from '../arcade/scenes/invaders-score';
import { sendScore } from './send';

describe('sendScore: the dock sends a finished game\'s score through the arcade\'s score sending', () => {
  it('sends it once under Entropy Invaders\' key and shows saving, then saved as NEW BEST', async () => {
    const submitScore = vi.fn(async (_game: string, score: number) => score);
    const shown: ScoreSend[] = [];
    const done = await sendScore({ submitScore }, 'invaders', 1240, (s) => shown.push(s), 800);
    expect(submitScore).toHaveBeenCalledTimes(1);
    expect(submitScore).toHaveBeenCalledWith('invaders', 1240);
    expect(shown).toEqual([
      { state: 'sending', score: 1240, tries: 1 },
      { state: 'saved', score: 1240, best: 1240, newBest: true },
    ]);
    expect(done).toEqual(shown[1]);
  });

  it('sends under the key of the game it is given, SUPER OMNI WORLD\'s as well', async () => {
    const submitScore = vi.fn(async (_game: string, score: number) => score);
    await sendScore({ submitScore }, 'platformer', 700, () => {});
    expect(submitScore).toHaveBeenCalledWith('platformer', 700);
  });

  it('keeps the stored best when the game scored less', async () => {
    const done = await sendScore({ submitScore: async () => 9210 }, 'invaders', 300, () => {}, 9210);
    expect(done).toEqual({ state: 'saved', score: 300, best: 9210, newBest: false });
  });

  it('shows not saved when the account refuses it, or when there is none, and never throws', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(sendScore({ submitScore: async () => { throw new Error('refused'); } }, 'invaders', 50, () => {})).resolves.toEqual({ state: 'failed', score: 50, tries: 1 });
    await expect(sendScore(null, 'invaders', 50, () => {}, null, 2)).resolves.toEqual({ state: 'failed', score: 50, tries: 2 });
    err.mockRestore();
  });
});
