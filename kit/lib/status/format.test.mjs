import { describe, expect, it } from 'vitest';
import { fetchedAgo, formatOverview } from './format.mjs';

const NOW = Date.UTC(2026, 8, 28, 12, 0, 0);
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** An overview as `overviewFor` returns it. */
function overview({ shipped = 3, inbox = 2, slug = 'acme/widgets', base = 'origin/main', fetchedAt = null } = {}) {
  const total = shipped + inbox;
  return {
    slug,
    base,
    fetchedAt,
    stages: { shipped: [], inbox: [] },
    counts: { shipped, inbox },
    bar: {
      delivered: shipped,
      total,
      percent: total === 0 ? null : Math.floor((shipped * 100) / total),
      filled: total === 0 ? 0 : Math.floor((shipped * 30) / total),
    },
    inProgress: { total: inbox, inbox },
  };
}

const lines = (text) => text.split('\n');

describe('formatOverview', () => {
  it('prints the header, the counts, the bar and the pointer to help', () => {
    expect(formatOverview(overview({ fetchedAt: NOW - 2 * HOUR }), { now: NOW })).toBe([
      'omni status · acme/widgets · origin/main, fetched 2 hours ago',
      '',
      '  SHIPPED 3     INBOX 2',
      '',
      `  delivered  ${'█'.repeat(18)}${'░'.repeat(12)}  3 of 5 · 60%`,
      '             2 in progress: 2 in the inbox',
      '',
      'omni help: the loop and every command',
    ].join('\n'));
  });

  it('leaves the slug out of the header when there is none', () => {
    expect(lines(formatOverview(overview({ slug: null, base: 'main' }), { now: NOW }))[0]).toBe('omni status · main, never fetched');
  });

  it('says never fetched when the checkout has no fetch', () => {
    expect(lines(formatOverview(overview(), { now: NOW }))[0]).toBe('omni status · acme/widgets · origin/main, never fetched');
  });

  it('draws the bar empty at 0%', () => {
    expect(formatOverview(overview({ shipped: 0, inbox: 4 }), { now: NOW })).toContain(`  delivered  ${'░'.repeat(30)}  0 of 4 · 0%\n             4 in progress: 4 in the inbox\n`);
  });

  it('draws the bar partway, rounded down', () => {
    expect(formatOverview(overview({ shipped: 29, inbox: 1 }), { now: NOW })).toContain(`  delivered  ${'█'.repeat(29)}░  29 of 30 · 96%\n`);
  });

  it('draws the bar full at 100%, with nothing in progress', () => {
    expect(formatOverview(overview({ shipped: 4, inbox: 0 }), { now: NOW })).toContain(`  delivered  ${'█'.repeat(30)}  4 of 4 · 100%\n             nothing in progress\n`);
  });

  it('says nothing yet with no PRD at all', () => {
    const text = formatOverview(overview({ shipped: 0, inbox: 0 }), { now: NOW });
    expect(text).toContain('  SHIPPED 0     INBOX 0\n');
    expect(text).toContain('\n\n  nothing yet: /omni:brainstorm to start\n\n');
    expect(text).not.toContain('delivered');
    expect(text).not.toContain('░');
    expect(text).not.toContain('in progress');
  });

  it('keeps every line within 80 columns', () => {
    for (const shipped of [0, 3, 29, 1234]) {
      for (const line of lines(formatOverview(overview({ shipped, inbox: 5678, fetchedAt: NOW - 23 * HOUR }), { now: NOW }))) {
        expect(line.length).toBeLessThanOrEqual(80);
      }
    }
  });
});

describe('fetchedAgo', () => {
  it('says never fetched without a fetch time', () => {
    expect(fetchedAgo(null, NOW)).toBe('never fetched');
  });

  it('says just now under a minute, and for a time ahead of the clock', () => {
    expect(fetchedAgo(NOW, NOW)).toBe('fetched just now');
    expect(fetchedAgo(NOW - 59 * SECOND, NOW)).toBe('fetched just now');
    expect(fetchedAgo(NOW + 5 * MINUTE, NOW)).toBe('fetched just now');
  });

  it('counts minutes under an hour', () => {
    expect(fetchedAgo(NOW - MINUTE, NOW)).toBe('fetched 1 minute ago');
    expect(fetchedAgo(NOW - 59 * MINUTE - 59 * SECOND, NOW)).toBe('fetched 59 minutes ago');
  });

  it('counts hours under a day', () => {
    expect(fetchedAgo(NOW - HOUR, NOW)).toBe('fetched 1 hour ago');
    expect(fetchedAgo(NOW - 2 * HOUR - 30 * MINUTE, NOW)).toBe('fetched 2 hours ago');
    expect(fetchedAgo(NOW - 23 * HOUR - 59 * MINUTE, NOW)).toBe('fetched 23 hours ago');
  });

  it('counts days from a day on', () => {
    expect(fetchedAgo(NOW - DAY, NOW)).toBe('fetched 1 day ago');
    expect(fetchedAgo(NOW - 40 * DAY, NOW)).toBe('fetched 40 days ago');
  });
});
