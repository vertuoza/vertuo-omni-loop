import { describe, expect, it } from 'vitest';
import { fetchedAgo, formatOverview, STAGE_ORDER, STAGE_WORDS } from './format.ts';
import type { Overview, StagedPrd, YourRow, Yours } from './overview.ts';

const NOW = Date.UTC(2026, 8, 28, 12, 0, 0);
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const ME = 'me@example.com';

/** Yours as `overviewFor` returns it: known, with no PRD of yours unless given. */
const known = ({ rows = [], shipped = [], email = ME }: { rows?: YourRow[]; shipped?: StagedPrd[]; email?: string } = {}): Yours => ({ state: 'known', email, rows, shipped });

/** An overview as `overviewFor` returns it. */
function overview({ prd = 0, inbox = 2, building = 0, openItems = 0, outbox = 0, shipped = 3, retro = 0, slug = 'acme/widgets', base = 'origin/main', fetchedAt = null, yours = known() }: { prd?: number; inbox?: number; building?: number; openItems?: number; outbox?: number; shipped?: number; retro?: number; slug?: string | null; base?: string; fetchedAt?: number | null; yours?: Yours } = {}): Overview {
  const delivered = shipped + retro;
  const inProgress = inbox + building + outbox;
  const total = delivered + inProgress;
  return {
    slug,
    base,
    fetchedAt,
    stages: { prd: [], inbox: [], building: [], outbox: [], shipped: [], retro: [] },
    counts: { prd, inbox, building, openItems, outbox, shipped, retro },
    bar: {
      delivered,
      total,
      percent: total === 0 ? null : Math.floor((delivered * 100) / total),
      filled: total === 0 ? 0 : Math.floor((delivered * 30) / total),
    },
    inProgress: { total: inProgress, inbox, building, outbox },
    yours,
  };
}

/** The two count lines of the default overview: three shipped, two in the inbox. */
const COUNTS = ['  IDEA on the app     PRD 0     INBOX 2     BUILDING 0     OUTBOX 0', '  SHIPPED 3     RETRO 0'];

const lines = (text: string) => text.split('\n');

describe('formatOverview', () => {
  it('prints the header, the counts, the bar, yours and the pointer to help', () => {
    expect(formatOverview(overview({ fetchedAt: NOW - 2 * HOUR }), { now: NOW })).toBe([
      'omni status · acme/widgets · origin/main, fetched 2 hours ago',
      '',
      ...COUNTS,
      '',
      `  delivered  ${'█'.repeat(18)}${'░'.repeat(12)}  3 of 5 · 60%`,
      '             2 in progress: 2 in the inbox',
      '',
      '  Yours · me@example.com',
      '  none yet',
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
    expect(text).toContain('  IDEA on the app     PRD 0     INBOX 0     BUILDING 0     OUTBOX 0\n  SHIPPED 0     RETRO 0\n');
    expect(text).toContain('\n\n  nothing yet: /omni:brainstorm to start\n\n');
    expect(text).not.toContain('delivered');
    expect(text).not.toContain('░');
    expect(text).not.toContain('in progress');
  });

  it('keeps every line within 80 columns', () => {
    for (const shipped of [0, 3, 29, 1234]) {
      for (const line of lines(formatOverview(overview({ shipped, inbox: 5678, building: 1234, openItems: 5678, outbox: 1234, prd: 1234, retro: 1234, fetchedAt: NOW - 23 * HOUR }), { now: NOW }))) {
        expect(line.length).toBeLessThanOrEqual(80);
      }
    }
  });
});

describe('formatOverview — the seven stages (PRD 315 s2, PRD 587 s5)', () => {
  it('keeps the kit\'s seven stages in the order a PRD goes, in the app\'s words', () => {
    expect(STAGE_ORDER).toEqual(['idea', 'prd', 'inbox', 'building', 'outbox', 'shipped', 'retro']);
    expect(STAGE_ORDER.map((stage) => STAGE_WORDS[stage])).toEqual(['idea', 'PRD', 'inbox', 'building', 'outbox', 'shipped', 'retro']);
  });

  it('prints the seven counts in order, the open items beside building, and the stages in progress under the bar', () => {
    const text = formatOverview(overview({ prd: 1, inbox: 2, building: 1, openItems: 3, outbox: 1, shipped: 20, retro: 6 }), { now: NOW });
    expect(lines(text).slice(2, 7)).toEqual([
      '  IDEA on the app     PRD 1     INBOX 2     BUILDING 1 · 3 open items',
      '  OUTBOX 1     SHIPPED 20     RETRO 6',
      '',
      `  delivered  ${'█'.repeat(26)}${'░'.repeat(4)}  26 of 30 · 86%`,
      '             4 in progress: 2 in the inbox, 1 being built, 1 in the outbox',
    ]);
    const words = lines(text).slice(2, 4).join(' ');
    const at = STAGE_ORDER.map((stage) => words.indexOf(`${STAGE_WORDS[stage].toUpperCase()} `));
    expect(at.every((index) => index >= 0)).toBe(true);
    expect(at).toEqual([...at].sort((a, b) => a - b));
  });

  it('says open item for one', () => {
    expect(formatOverview(overview({ inbox: 0, building: 1, openItems: 1 }), { now: NOW })).toContain('     BUILDING 1 · 1 open item\n');
  });

  it('says 0 open items while building holds none open, and leaves them out while building is empty', () => {
    expect(formatOverview(overview({ building: 2, openItems: 0 }), { now: NOW })).toContain('     BUILDING 2 · 0 open items\n');
    expect(formatOverview(overview(), { now: NOW })).toContain('     BUILDING 0     OUTBOX 0\n');
  });

  it('shows every stage, even while it is empty', () => {
    expect(lines(formatOverview(overview(), { now: NOW })).slice(2, 4)).toEqual(COUNTS);
  });

  it('names only the stages in progress under the bar', () => {
    expect(formatOverview(overview({ inbox: 0, outbox: 1 }), { now: NOW })).toContain('\n             1 in progress: 1 in the outbox\n');
    expect(formatOverview(overview({ inbox: 0, building: 2 }), { now: NOW })).toContain('\n             2 in progress: 2 being built\n');
  });

  it('keeps PRD out of the bar', () => {
    const text = formatOverview(overview({ shipped: 0, inbox: 0, prd: 1 }), { now: NOW });
    expect(text).toContain('  IDEA on the app     PRD 1     INBOX 0');
    expect(text).toContain('\n  nothing yet: /omni:brainstorm to start\n');
  });

  it('wraps the counts within 80 columns, however large they grow', () => {
    const text = formatOverview(overview({ prd: 12345, inbox: 67890, building: 12345, openItems: 67890, outbox: 12345, shipped: 12345, retro: 67890 }), { now: NOW });
    for (const line of lines(text)) expect(line.length).toBeLessThanOrEqual(80);
    expect(lines(text).slice(2, 5)).toEqual([
      '  IDEA on the app     PRD 12345     INBOX 67890',
      '  BUILDING 12345 · 67890 open items     OUTBOX 12345     SHIPPED 12345',
      '  RETRO 67890',
    ]);
  });
});

describe('formatOverview — yours (PRD 315, slice s3)', () => {
  const row = (stage: YourRow['stage'], prd: number, topic: string, more: { openItems?: number } = {}): YourRow => ({ stage, prd, topic, ...more });
  const entry = (prd: number, topic: string): StagedPrd => ({ prd, topic });

  /** The lines of the yours section: between the blank line after the bar and the one before help. */
  function yoursLines(text: string) {
    const all = lines(text);
    const end = all.lastIndexOf('');
    const start = all.lastIndexOf('', end - 1);
    return all.slice(start + 1, end);
  }

  it('prints each PRD of yours with where it stands, and the shipped list wrapped under the first line', () => {
    const yours = known({
      rows: [
        row('outbox', 240, 'ask-tabs'),
        row('building', 251, 'outbox-answers', { openItems: 3 }),
        row('inbox', 285, 'home-value'),
        row('prd', 310, 'cli-help-status'),
      ],
      shipped: [
        entry(301, 'yolo-what-is-next'),
        entry(292, 'what-is-next'),
        entry(284, 'omni-theme'),
        entry(262, 'release-notes'),
        entry(261, 'home'),
        entry(238, 'game-app-switch'),
      ],
    });
    const text = formatOverview(overview({ shipped: 26, inbox: 2, building: 1, openItems: 3, outbox: 1, prd: 1, yours }), { now: NOW });
    expect(lines(text).slice(7)).toEqual([
      '',
      '  Yours · me@example.com',
      '  outbox     #240  ask-tabs           its feature PR waits for your review',
      '  building   #251  outbox-answers     3 open items wait for an answer',
      '  inbox      #285  home-value         ready to build: /omni:yolo 285',
      '  PRD        #310  cli-help-status    its phase-0 PR waits for a merge',
      '  shipped    6: #301 yolo-what-is-next · #292 what-is-next · #284 omni-theme',
      '             #262 release-notes · #261 home · #238 game-app-switch',
      '',
      'omni help: the loop and every command',
    ]);
  });

  it('says one open item waits, and being built for a building PRD with none open', () => {
    const yours = known({ rows: [row('building', 12, 'twelve', { openItems: 1 }), row('building', 7, 'seven', { openItems: 0 })] });
    expect(yoursLines(formatOverview(overview({ yours }), { now: NOW }))).toEqual([
      '  Yours · me@example.com',
      '  building   #12  twelve    1 open item waits for an answer',
      '  building   #7   seven     being built',
    ]);
  });

  it('prints only the shipped row when every PRD of yours shipped, and no shipped row when none did', () => {
    expect(yoursLines(formatOverview(overview({ yours: known({ shipped: [entry(3, 'third')] }) }), { now: NOW }))).toEqual([
      '  Yours · me@example.com',
      '  shipped    1: #3 third',
    ]);
    expect(yoursLines(formatOverview(overview({ yours: known({ rows: [row('inbox', 5, 'fifth')] }) }), { now: NOW }))).toEqual([
      '  Yours · me@example.com',
      '  inbox      #5  fifth    ready to build: /omni:yolo 5',
    ]);
  });

  it('lists every shipped PRD of yours, each line within 80 columns and none ending on a separator', () => {
    const shipped = Array.from({ length: 40 }, (_, index) => entry(400 - index, `topic-number-${index}`));
    const list = yoursLines(formatOverview(overview({ yours: known({ shipped }) }), { now: NOW })).slice(1);
    expect(list.length).toBeGreaterThan(2);
    expect(list[0]!.startsWith('  shipped    40: #400 topic-number-0 · #399 topic-number-1 · ')).toBe(true);
    for (const line of list.slice(1)) expect(line).toMatch(/^ {13}#\d/);
    for (const line of list) {
      expect(line.length).toBeLessThanOrEqual(80);
      expect(line.endsWith('·')).toBe(false);
      expect(line.endsWith(' ')).toBe(false);
    }
    const listed = list.join(' · ').replace(/^ {2}shipped {4}40: /, '').split(/\s+·\s+/);
    expect(listed).toEqual(shipped.map(({ prd, topic }) => `#${prd} ${topic}`));
  });

  it('cuts with … a topic that would push a row past 80 columns, and keeps the rows aligned', () => {
    const long = 'a-very-long-topic-that-goes-on-and-on-and-on-and-never-seems-to-end';
    const yours = known({ rows: [row('building', 7, long, { openItems: 2 }), row('prd', 12, 'short')] });
    const out = yoursLines(formatOverview(overview({ yours }), { now: NOW }));
    expect(out.slice(1)).toEqual([
      `  building   #7   ${long.slice(0, 25)}…    2 open items wait for an answer`,
      `  PRD        #12  ${'short'.padEnd(26)}    its phase-0 PR waits for a merge`,
    ]);
    expect(out[2]!.length).toBe(80);
  });

  it('cuts with … a shipped topic too long for a line of its own', () => {
    const long = 'x'.repeat(100);
    const out = yoursLines(formatOverview(overview({ yours: known({ shipped: [entry(2, 'two'), entry(1, long)] }) }), { now: NOW }));
    expect(out.slice(1)).toEqual([
      '  shipped    2: #2 two',
      `             #1 ${'x'.repeat(80 - 13 - 3 - 1)}…`,
    ]);
  });

  it('cuts with … an email too long for the heading', () => {
    const email = `${'m'.repeat(90)}@example.com`;
    const [heading] = yoursLines(formatOverview(overview({ yours: known({ email }) }), { now: NOW }));
    expect(heading).toBe(`  Yours · ${email.slice(0, 80 - 10 - 1)}…`);
  });

  it('says none yet when no PRD is yours', () => {
    expect(yoursLines(formatOverview(overview(), { now: NOW }))).toEqual(['  Yours · me@example.com', '  none yet']);
  });

  it('says one line without an email, and one in a shallow clone, the counts and the bar still shown', () => {
    const cases: [Yours, string][] = [
      [{ state: 'no-email', email: null, rows: [], shipped: [] }, '  set git config user.email to see yours'],
      [{ state: 'shallow', email: ME, rows: [], shipped: [] }, '  this clone is shallow: git fetch --unshallow to see yours'],
    ];
    for (const [yours, line] of cases) {
      const text = formatOverview(overview({ yours }), { now: NOW });
      expect(yoursLines(text)).toEqual([line]);
      expect(text).toContain(`\n${COUNTS.join('\n')}\n`);
      expect(text).toContain('  3 of 5 · 60%\n');
      expect(text).not.toContain('Yours');
    }
  });

  it('keeps every line within 80 columns, however many digits and long words', () => {
    const topic = 'b'.repeat(70);
    const yours = known({
      email: `${'e'.repeat(75)}@x.io`,
      rows: [
        row('outbox', 123456, topic, { openItems: 98765 }),
        row('building', 1, topic, { openItems: 0 }),
        row('inbox', 99999, topic),
        row('prd', 7, topic),
      ],
      shipped: Array.from({ length: 30 }, (_, index) => entry(100000 - index, index % 2 ? topic : 'c')),
    });
    const text = formatOverview(overview({ shipped: 30, inbox: 2, building: 1, openItems: 98765, outbox: 1, prd: 1, yours }), { now: NOW });
    for (const line of lines(text)) expect(line.length).toBeLessThanOrEqual(80);
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
