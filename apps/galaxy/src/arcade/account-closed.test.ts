import { describe, it, expect } from 'vitest';
import { closedAccount } from './account-closed';

describe('closedAccount', () => {
  it('lets nobody in: no session, and every way in refuses', async () => {
    const a = closedAccount();
    expect(a.kind).toBe('closed');
    expect(a.restore!()).toEqual({ session: null, me: null });
    await expect(a.signIn()).rejects.toThrow(/not open/);
    await expect(a.linkGithub()).rejects.toThrow(/not open/);
    await expect(a.save({ team: 'pirates' }, null)).rejects.toThrow(/not open/);
    await expect(a.submitScore('invaders', 100)).rejects.toThrow(/not open/);
  });

  it('has no high scores to show', async () => {
    expect(await closedAccount().scores('invaders')).toEqual({ top: [], mine: null });
  });
});
