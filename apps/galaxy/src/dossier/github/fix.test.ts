import { describe, expect, it } from 'vitest';
import { readFix, type FixGet } from './fix';
import { UNREAD } from './summary';

// A fix on GitHub (PRD 627, s5), read from a fixture: its issue (author, time, risk and regression
// labels), its `fix/<n>-…` pull request (open or merged, with who merged it), each approving review,
// and the first release published after the merge. Each part fails on its own, as *unknown*.

const LABELS = { risk: ['omni:risk-critical', 'omni:risk-high', 'omni:risk-medium', 'omni:risk-low'], regression: 'omni:regression' };
const SHAPE = 'fix/{topic}';
const PR = 'https://github.com/acme/widgets/pull';

const issue = (more: Record<string, unknown> = {}) => ({
  number: 548, html_url: 'https://github.com/acme/widgets/issues/548', state: 'open', created_at: '2026-09-29T08:00:00Z',
  user: { login: 'anna' }, labels: [{ name: 'omni:visual' }], ...more,
});
const pull = (number: number, head: string, more: Record<string, unknown> = {}) => ({
  number, html_url: `${PR}/${number}`, state: 'open', draft: false, merged_at: null, created_at: `2026-09-29T0${number % 10}:00:00Z`,
  head: { ref: head }, body: null, ...more,
});

/** A fixture GitHub: routes to answers; a route missing answers 404 (null), `fail` throws. */
function fixture(routes: Record<string, unknown>, fail: RegExp | null = null): { get: FixGet; calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    get: async (route) => {
      calls.push(route);
      if (fail?.test(route)) throw new Error(`GitHub answered 502 to ${route}`);
      const key = route.split('?')[0];
      return key in routes ? routes[key] : null;
    },
  };
}

const read = (routes: Record<string, unknown>, fail: RegExp | null = null) => readFix(fixture(routes, fail).get, 548, SHAPE, LABELS);

describe('a fix read from GitHub', () => {
  it('gives the issue\'s author and time, and no pull request while none is on a fix/548- branch', async () => {
    const fix = await read({ '/issues/548': issue(), '/pulls': [pull(3, 'fix/5480-other'), pull(4, 'feat/548-x')] });
    expect(fix.issue).toEqual({
      number: 548, url: 'https://github.com/acme/widgets/issues/548', state: 'open', author: 'anna', createdAt: '2026-09-29T08:00:00Z',
      risk: null, regression: false,
    });
    expect(fix.pull).toBeNull();
    expect(fix.approvals).toEqual([]);
    expect(fix.release).toBeNull();
  });

  it('reads the risk label and the regression badge from the issue\'s labels', async () => {
    const fix = await read({ '/issues/548': issue({ labels: [{ name: 'omni:bug' }, { name: 'omni:risk-high' }, { name: 'omni:regression' }] }), '/pulls': [] });
    expect(fix.issue).toMatchObject({ risk: 'omni:risk-high', regression: true });
  });

  it('gives the open fix PR and each APPROVED review with login and time', async () => {
    const fix = await read({
      '/issues/548': issue(),
      '/pulls': [pull(562, 'fix/548-darker-sidebar')],
      '/pulls/562/reviews': [
        { state: 'COMMENTED', user: { login: 'bob' }, submitted_at: '2026-09-29T10:00:00Z' },
        { state: 'APPROVED', user: { login: 'carla' }, submitted_at: '2026-09-29T11:00:00Z' },
      ],
    });
    expect(fix.pull).toEqual({ number: 562, url: `${PR}/562`, state: 'open', mergedAt: null, mergedBy: null });
    expect(fix.approvals).toEqual([{ login: 'carla', at: '2026-09-29T11:00:00Z' }]);
    expect(fix.release).toBeNull();
  });

  it('gives merged_by and merged_at, and the first release published after the merge', async () => {
    const mergedAt = '2026-09-29T12:00:00Z';
    const fix = await read({
      '/issues/548': issue({ state: 'closed' }),
      '/pulls': [pull(560, 'fix/548-first-try', { state: 'closed' }), pull(562, 'fix/548-darker-sidebar', { state: 'closed', merged_at: mergedAt })],
      '/pulls/562': { merged_by: { login: 'pierre-derval' }, merged_at: mergedAt },
      '/pulls/562/reviews': [],
      '/releases': [
        { tag_name: 'v0.0.80', html_url: 'https://github.com/acme/widgets/releases/tag/v0.0.80', draft: false, published_at: '2026-09-30T09:00:00Z' },
        { tag_name: 'v0.0.79', html_url: 'https://github.com/acme/widgets/releases/tag/v0.0.79', draft: false, published_at: '2026-09-29T12:05:00Z' },
        { tag_name: 'v0.0.78', html_url: 'https://github.com/acme/widgets/releases/tag/v0.0.78', draft: false, published_at: '2026-09-29T11:00:00Z' },
        { tag_name: 'v0.0.81', html_url: 'https://github.com/acme/widgets/releases/tag/v0.0.81', draft: true, published_at: null },
      ],
    });
    expect(fix.pull).toEqual({ number: 562, url: `${PR}/562`, state: 'merged', mergedAt, mergedBy: 'pierre-derval' });
    expect(fix.release).toEqual({ tag: 'v0.0.79', url: 'https://github.com/acme/widgets/releases/tag/v0.0.79', at: '2026-09-29T12:05:00Z' });
  });

  it('gives no release while none was published after the merge', async () => {
    const mergedAt = '2026-09-29T12:00:00Z';
    const fix = await read({
      '/issues/548': issue(), '/pulls': [pull(562, 'fix/548-x', { state: 'closed', merged_at: mergedAt })],
      '/pulls/562': { merged_by: { login: 'pierre-derval' } }, '/pulls/562/reviews': [], '/releases': [],
    });
    expect(fix.release).toBeNull();
  });

  it('gives unknown, not an error, for each part GitHub could not answer', async () => {
    const noIssue = await read({ '/pulls': [] }, /^\/issues\//);
    expect(noIssue.issue).toBe(UNREAD);
    expect(noIssue.pull).toBeNull();

    const noPulls = await read({ '/issues/548': issue() }, /^\/pulls/);
    expect(noPulls).toMatchObject({ pull: UNREAD, approvals: UNREAD, release: UNREAD });

    const noRelease = await read({
      '/issues/548': issue(), '/pulls': [pull(562, 'fix/548-x', { state: 'closed', merged_at: '2026-09-29T12:00:00Z' })],
      '/pulls/562': { merged_by: { login: 'p' } }, '/pulls/562/reviews': [],
    }, /^\/releases/);
    expect(noRelease.release).toBe(UNREAD);
    expect(noRelease.pull).not.toBe(UNREAD);
  });
});
