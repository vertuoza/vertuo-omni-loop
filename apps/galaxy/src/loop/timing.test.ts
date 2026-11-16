import { describe, expect, it } from 'vitest';
import { memoryGithubStore } from '@omni/github';
import { loopTiming, timedStore, timedWorkspaces, untimed } from './timing';

// One request's timing (the loop reads' Server-Timing header): each step's summed time and count, then
// the total since the collector was made; on a clock the test moves.

function clocked() {
  let now = 1_000;
  return { clock: () => now, wait: (ms: number) => { now += ms; } };
}

describe('loopTiming', () => {
  it('sums each step\'s calls and counts them, every step listed in order, then the total', async () => {
    const { clock, wait } = clocked();
    const timing = loopTiming(clock);
    timing.timeSync('setup', () => { wait(0.04); });
    await timing.time('github', () => { wait(120.26); return Promise.resolve(); });
    await timing.time('github', () => { wait(30); return Promise.resolve(); });
    wait(5);
    expect(timing.header()).toBe([
      'setup;dur=0.0;desc="1 calls"', 'auth;dur=0.0;desc="0 calls"', 'workspace;dur=0.0;desc="0 calls"', 'token;dur=0.0;desc="0 calls"',
      'store;dur=0.0;desc="0 calls"', 'github;dur=150.3;desc="2 calls"', 'parse;dur=0.0;desc="0 calls"', 'total;dur=155.3',
    ].join(', '));
  });

  it('counts a call that throws, and throws it on', async () => {
    const { clock, wait } = clocked();
    const timing = loopTiming(clock);
    await expect(timing.time('token', () => { wait(7); return Promise.reject(new Error('refused')); })).rejects.toThrow('refused');
    expect(() => timing.timeSync('parse', () => { wait(2); throw new Error('malformed'); })).toThrow('malformed');
    expect(timing.header()).toContain('token;dur=7.0;desc="1 calls"');
    expect(timing.header()).toContain('parse;dur=2.0;desc="1 calls"');
  });

  it('keeps nothing when untimed', async () => {
    expect(await untimed.time('github', () => Promise.resolve(3))).toBe(3);
    expect(untimed.timeSync('parse', () => 4)).toBe(4);
    expect(untimed.header()).toBe('');
  });
});

describe('the timed store and workspace check', () => {
  it('time every store call as store, and the workspace check as workspace, answering as before', async () => {
    const timing = loopTiming();
    const store = timedStore(memoryGithubStore(), timing);
    await store.saveEtag(1, 'https://api.github.com/x', { etag: '"a"', body: '[]', at: 1 });
    expect((await store.etag(1, 'https://api.github.com/x'))?.etag).toBe('"a"');
    await store.touchEtag(1, 'https://api.github.com/x', 2);
    await store.saveBudget(1, 'core', { limit: 5000, remaining: 4000, resetAt: 9, at: 1 });
    await store.pause(1, 'core', 10, 1);
    expect((await store.budget(1, 'core'))?.pausedUntil).toBe(10);
    const workspaces = timedWorkspaces({ workspaceOf: () => Promise.resolve({ workspace: 'w-1' }) }, timing);
    expect(await workspaces.workspaceOf('p', 'acme/widgets')).toEqual({ workspace: 'w-1' });
    expect(timing.header()).toMatch(/store;dur=[\d.]+;desc="6 calls"/);
    expect(timing.header()).toMatch(/workspace;dur=[\d.]+;desc="1 calls"/);
  });
});
