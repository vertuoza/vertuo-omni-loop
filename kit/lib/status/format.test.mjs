import { describe, expect, it } from 'vitest';
import { fetchedAgo, formatOverview } from './format.mjs';

const NOW = Date.UTC(2026, 8, 28, 12, 0, 0);
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** An overview as `overviewFor` returns it. */
function overview({ shipped = 3, inbox = 2, outbox = 0, openItems = 0, inReview = 0, slug = 'acme/widgets', base = 'origin/main', fetchedAt = null } = {}) {
  const total = shipped + inbox + outbox;
  return {
    slug,
    base,
    fetchedAt,
    stages: { shipped: [], outbox: [], inbox: [], inReview: [] },
    counts: { shipped, inbox, outbox, openItems, inReview },
    bar: {
      delivered: shipped,
      total,
      percent: total === 0 ? null : Math.floor((shipped * 100) / total),
      filled: total === 0 ? 0 : Math.floor((shipped * 30) / total),
    },
    inProgress: { total: inbox + outbox, inbox, outbox },
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
      for (const line of lines(formatOverview(overview({ shipped, inbox: 5678, outbox: 1234, openItems: 5678, inReview: 1234, fetchedAt: NOW - 23 * HOUR }), { now: NOW }))) {
        expect(line.length).toBeLessThanOrEqual(80);
      }
    }
  });
});

describe('formatOverview — the outbox and in review (PRD 315, slice s2)', () => {
  it('prints the four counts, the open items beside the outbox, and both stages under the bar', () => {
    const text = formatOverview(overview({ shipped: 26, inbox: 2, outbox: 1, openItems: 3, inReview: 1 }), { now: NOW });
    expect(lines(text).slice(2, 6)).toEqual([
      '  SHIPPED 26     INBOX 2     OUTBOX 1 · 3 open items     IN REVIEW 1',
      '',
      `  delivered  ${'█'.repeat(26)}${'░'.repeat(4)}  26 of 29 · 89%`,
      '             3 in progress: 2 in the inbox, 1 in the outbox',
    ]);
  });

  it('says open item for one', () => {
    expect(formatOverview(overview({ inbox: 0, outbox: 1, openItems: 1 }), { now: NOW })).toContain('  SHIPPED 3     INBOX 0     OUTBOX 1 · 1 open item\n');
  });

  it('says 0 open items for an outbox with none open', () => {
    expect(formatOverview(overview({ outbox: 2, openItems: 0 }), { now: NOW })).toContain('     OUTBOX 2 · 0 open items\n');
  });

  it('leaves the outbox and in review out of the counts while they are empty', () => {
    expect(formatOverview(overview(), { now: NOW })).toContain('\n  SHIPPED 3     INBOX 2\n');
    expect(formatOverview(overview({ inReview: 2 }), { now: NOW })).toContain('\n  SHIPPED 3     INBOX 2     IN REVIEW 2\n');
  });

  it('names only the outbox under the bar when the inbox is empty', () => {
    expect(formatOverview(overview({ inbox: 0, outbox: 1 }), { now: NOW })).toContain('\n             1 in progress: 1 in the outbox\n');
  });

  it('keeps in review out of the bar', () => {
    const text = formatOverview(overview({ shipped: 0, inbox: 0, inReview: 1 }), { now: NOW });
    expect(text).toContain('  SHIPPED 0     INBOX 0     IN REVIEW 1\n');
    expect(text).toContain('\n  nothing yet: /omni:brainstorm to start\n');
  });

  it('wraps the counts within 80 columns, however large they grow', () => {
    const text = formatOverview(overview({ shipped: 12345, inbox: 67890, outbox: 12345, openItems: 67890, inReview: 12345 }), { now: NOW });
    for (const line of lines(text)) expect(line.length).toBeLessThanOrEqual(80);
    expect(lines(text).slice(2, 4)).toEqual([
      '  SHIPPED 12345     INBOX 67890     OUTBOX 12345 · 67890 open items',
      '  IN REVIEW 12345',
    ]);
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
