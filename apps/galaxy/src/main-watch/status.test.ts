// A PRD's status on main, worded (PRD 2410, s3): the four states, the worst lane winning, a missing read
// never reading clean, and each break with its link and, for a CI red, its parent's result.
import { describe, expect, it } from 'vitest';
import { parsePrd } from 'omni-loop/kit/lib/ids.ts';
import { daysLeft, mainWatchView } from './status';
import type { BreakRow, WatchRow } from './store';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-10-22T12:00:00Z');
const iso = (offset: number) => new Date(NOW + offset).toISOString();
const A = 'acme/widgets';
const B = 'acme/gears';

const watch = (lane: string, more: Partial<WatchRow> = {}): WatchRow => ({
  lane, merge_sha: 'a'.repeat(40), merged_at: iso(-2 * DAY), watch_until: iso(5 * DAY), status: 'watching', unread: [], ...more,
});
const broke = (lane: string, more: Partial<BreakRow> = {}): BreakRow => ({
  lane, kind: 'ci-red', source: 'run-1', url: 'https://github.com/acme/widgets/actions/runs/1', title: 'build', parent: 'green', at: iso(-DAY), ...more,
});
const view = (watches: WatchRow[], breaks: BreakRow[] = []) => mainWatchView({ watches, breaks }, parsePrd(2410), NOW);

describe('a PRD with no watch', () => {
  it('has no status: nothing read, nothing asked for, or no watch row', () => {
    expect(mainWatchView(null, parsePrd(7), NOW)).toBeNull();
    expect(mainWatchView(undefined, parsePrd(7), NOW)).toBeNull();
    expect(view([])).toBeNull();
  });
});

describe('the days left', () => {
  it('rounds up, and never goes below none', () => {
    expect(daysLeft(iso(5 * DAY), NOW)).toBe(5);
    expect(daysLeft(iso(4 * DAY + 1), NOW)).toBe(5);
    expect(daysLeft(iso(1), NOW)).toBe(1);
    expect(daysLeft(iso(-DAY), NOW)).toBe(0);
  });
});

describe('the four states', () => {
  it('reads Watching · n days left while a lane is watched, the longest watch counting', () => {
    expect(view([watch(A)])).toMatchObject({ state: 'watching', words: 'Watching · 5 days left', prd: 2410 });
    expect(view([watch(A, { watch_until: iso(DAY) }), watch(B, { watch_until: iso(3 * DAY) })])?.words).toBe('Watching · 3 days left');
    expect(view([watch(A, { watch_until: iso(DAY) })])?.words).toBe('Watching · 1 day left');
  });

  it('reads Clean once every lane is clean', () => {
    expect(view([watch(A, { status: 'clean' }), watch(B, { status: 'clean' })])).toMatchObject({ state: 'clean', words: 'Clean', breaks: [] });
  });

  it('reads Broke main as soon as one lane broke, whatever the others read', () => {
    const one = view([watch(A, { status: 'broke' }), watch(B, { status: 'clean' })], [broke(A)]);
    expect(one).toMatchObject({ state: 'broke', words: 'Broke main' });
    expect(view([watch(A), watch(B, { status: 'clean' })], [broke(A)])?.state).toBe('broke');
  });

  it('reads Could not check, never Clean, while a signal was unread, and names it', () => {
    const unchecked = view([watch(A, { unread: ['the runs of the merge commit'] })]);
    expect(unchecked).toMatchObject({ state: 'unchecked', words: 'Could not check', unread: ['the runs of the merge commit'] });
    expect(view([watch(A, { status: 'clean' }), watch(B, { unread: ['issues'] })])?.state).toBe('unchecked');
    // past its seven days it is still not clean
    expect(view([watch(A, { watch_until: iso(-DAY), unread: ['issues'] })])?.state).toBe('unchecked');
  });

  it('keeps Broke main over Could not check', () => {
    expect(view([watch(A, { status: 'broke' }), watch(B, { unread: ['issues'] })], [broke(A)])?.state).toBe('broke');
  });
});

describe('the breaks', () => {
  it('lists each with its kind, title, link and time, the oldest first, and a CI red\'s parent result', () => {
    const revert = broke(A, { kind: 'revert', source: 'sha', url: 'https://github.com/acme/widgets/commit/b1', title: 'Revert "feat"', parent: null, at: iso(-2 * 60 * 60 * 1000) });
    const red = broke(A, { parent: 'red', at: iso(-3 * DAY) });
    const regression = broke(A, { kind: 'regression', source: '9', url: 'https://github.com/acme/widgets/issues/9', title: 'Quote is wrong', parent: null, at: iso(-2 * DAY) });
    const shown = view([watch(A, { status: 'broke' })], [revert, regression, red])?.breaks;
    expect(shown?.map((b) => b.label)).toEqual(['CI red', 'Regression', 'Reverted']);
    expect(shown?.[0]).toEqual({
      kind: 'ci-red', label: 'CI red', title: 'build', url: red.url, lane: null, parent: 'the parent commit was already red', at: '19 Oct 2026, 12:00 UTC',
    });
    expect(shown?.[2]).toMatchObject({ title: 'Revert "feat"', url: 'https://github.com/acme/widgets/commit/b1', parent: null });
  });

  it('words each parent result, and names the lane only for a PRD that merged into several repositories', () => {
    const greens = view([watch(A, { status: 'broke' }), watch(B)], [broke(B, { parent: 'green' }), broke(B, { source: 'run-2', parent: 'unknown' })])?.breaks;
    expect(greens?.map((b) => [b.lane, b.parent])).toEqual([[B, 'the parent commit was green'], [B, 'the parent commit\'s result is unknown']]);
    expect(view([watch(A, { status: 'broke' })], [broke(A, { parent: null })])?.breaks[0]).toMatchObject({ lane: null, parent: null });
  });
});
