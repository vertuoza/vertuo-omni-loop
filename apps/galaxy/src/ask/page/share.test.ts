import { describe, it, expect, vi } from 'vitest';
import { copyLink, shareCandidates, shareLink } from './share';

describe('the Share button', () => {
  it('links to the question on the host the page was opened on', () => {
    expect(shareLink('https://galaxy.example', 'r1')).toBe('https://galaxy.example/ask/q/r1');
    expect(shareLink('https://galaxy.example/', 'r1')).toBe('https://galaxy.example/ask/q/r1');
  });

  it('offers every member of the workspace but the owner, by name', () => {
    const members = [
      { user_id: 'ada', email: 'ada@vertuoza.com', name: null },
      { user_id: 'bob', email: 'bob@vertuoza.com', name: 'BOB' },
    ];
    expect(shareCandidates(members, 'ada')).toEqual([{ id: 'bob', label: 'BOB' }]);
  });

  it('copies the link to the clipboard', async () => {
    const writeText = vi.fn(async () => {});
    const select = vi.fn();
    expect(await copyLink('https://x/ask/q/r1', { writeText }, select)).toBe('copied');
    expect(writeText).toHaveBeenCalledWith('https://x/ask/q/r1');
    expect(select).not.toHaveBeenCalled();
  });

  it('selects the text instead when there is no clipboard, or it refuses', async () => {
    const select = vi.fn();
    expect(await copyLink('l', undefined, select)).toBe('selected');
    expect(await copyLink('l', { writeText: async () => { throw new Error('denied'); } }, select)).toBe('selected');
    expect(select).toHaveBeenCalledTimes(2);
  });
});
