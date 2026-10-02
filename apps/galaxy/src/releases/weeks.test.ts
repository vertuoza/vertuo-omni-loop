// The weeks of /releases (PRD 262), pure: rows of public.releases in, the page's weeks out. A week
// starts on Monday in Brussels, weeks and the releases inside them run newest first, release 1 is
// dated by its latest row and lists its PRDs in PRD order, and only the four newest weeks are open.
import { describe, expect, it } from 'vitest';
import type { ReleaseRow } from './row';
import { brusselsDay, mondayOf, OPEN_WEEKS, releasesOf, weeksOf } from './weeks';
import { sure } from '../arcade/sure';

const row = (prd: number, release: number, released_at: string, title = `PRD ${prd}'s title`): ReleaseRow =>
  ({ prd, release, released_at, title, description: `What PRD ${prd} changed.` });

describe('a day in Brussels', () => {
  it('is the calendar day on the Brussels wall clock, not in UTC', () => {
    expect(brusselsDay('2026-09-27T21:59:00+00:00')).toEqual({ year: 2026, month: 9, day: 27, weekday: 6 });
    expect(brusselsDay('2026-09-27T22:30:00+00:00')).toEqual({ year: 2026, month: 9, day: 28, weekday: 0 });
    // In winter Brussels is one hour ahead, not two.
    expect(brusselsDay('2026-11-01T22:30:00+00:00')).toEqual({ year: 2026, month: 11, day: 1, weekday: 6 });
    expect(brusselsDay('2026-11-01T23:30:00+00:00')).toEqual({ year: 2026, month: 11, day: 2, weekday: 0 });
  });

  it('reads a date whatever its offset, fractions of a second included', () => {
    expect(brusselsDay('2026-09-28T01:12:00.123456+02:00')).toEqual({ year: 2026, month: 9, day: 28, weekday: 0 });
  });
});

describe('a week', () => {
  it('starts on Monday', () => {
    expect(mondayOf({ year: 2026, month: 9, day: 27, weekday: 6 })).toEqual({ year: 2026, month: 9, day: 21, weekday: 0 });
    expect(mondayOf({ year: 2026, month: 9, day: 28, weekday: 0 })).toEqual({ year: 2026, month: 9, day: 28, weekday: 0 });
    expect(mondayOf({ year: 2026, month: 10, day: 1, weekday: 3 })).toEqual({ year: 2026, month: 9, day: 28, weekday: 0 });
    expect(mondayOf({ year: 2027, month: 1, day: 3, weekday: 6 })).toEqual({ year: 2026, month: 12, day: 28, weekday: 0 });
  });

  it('holds a release made at 23:30 UTC on a Sunday in the next week: it is Monday in Brussels', () => {
    const [week] = weeksOf([row(262, 2, '2026-09-27T23:30:00+00:00')]);
    expect(sure(week, 'week').monday).toEqual({ year: 2026, month: 9, day: 28, weekday: 0 });
    expect(sure(sure(week, 'week').releases[0], 'the week\'s first release').day).toEqual({ year: 2026, month: 9, day: 28, weekday: 0 });
  });

  it('holds a release made at 21:30 UTC on a Sunday in its own week: it is still Sunday in Brussels', () => {
    const [week] = weeksOf([row(262, 2, '2026-09-27T21:30:00+00:00')]);
    expect(sure(week, 'week').monday).toEqual({ year: 2026, month: 9, day: 21, weekday: 0 });
  });
});

describe('the releases', () => {
  it('are one per release number, shown as its full version', () => {
    const releases = releasesOf([row(262, 2, '2026-09-28T09:00:00+00:00'), row(270, 3, '2026-09-29T09:00:00+00:00')]);
    expect(releases.map((r) => [r.release, r.version, r.lines.map((l) => l.prd)])).toEqual([[3, '0.0.3', [270]], [2, '0.0.2', [262]]]);
  });

  it('date release 1 by its latest row, and list its PRDs in PRD order', () => {
    const [initial] = releasesOf([
      row(141, 1, '2026-09-26T15:56:01+00:00'),
      row(3, 1, '2026-09-25T13:17:33+00:00'),
      row(216, 1, '2026-09-27T13:29:53+00:00'),
      row(28, 1, '2026-09-25T13:17:33+00:00'),
    ]);
    expect(sure(initial, 'initial').release).toBe(1);
    expect(sure(initial, 'initial').releasedAt).toBe('2026-09-27T13:29:53+00:00');
    expect(sure(initial, 'initial').day).toEqual({ year: 2026, month: 9, day: 27, weekday: 6 });
    expect(sure(initial, 'initial').lines.map((l) => l.prd)).toEqual([3, 28, 141, 216]);
  });

  it('keep every word of their rows', () => {
    const only = row(262, 2, '2026-09-28T09:00:00+00:00', 'Everything we ship, in plain words');
    expect(sure(releasesOf([only])[0], 'releasesOf([only])[0]').lines).toEqual([only]);
  });
});

describe('the weeks', () => {
  const rows = [
    row(3, 1, '2026-09-25T13:17:33+00:00'),
    row(216, 1, '2026-09-27T13:29:53+00:00'),
    row(262, 2, '2026-09-28T09:12:00+00:00'),
    row(270, 3, '2026-09-29T14:05:00+00:00'),
    row(281, 4, '2026-10-08T08:00:00+00:00'),
  ];

  it('run newest first, each from its Monday, with its releases newest first', () => {
    const weeks = weeksOf(rows);
    expect(weeks.map((w) => [w.monday.month, w.monday.day])).toEqual([[10, 5], [9, 28], [9, 21]]);
    expect(weeks.map((w) => w.releases.map((r) => r.version))).toEqual([['0.0.4'], ['0.0.3', '0.0.2'], ['0.0.1']]);
  });

  it('put a release that lands the same moment as another after it, the higher number first', () => {
    const weeks = weeksOf([row(300, 5, '2026-10-12T08:00:00+00:00'), row(301, 6, '2026-10-12T08:00:00+00:00')]);
    expect(sure(weeks[0], 'weeks[0]').releases.map((r) => r.version)).toEqual(['0.0.6', '0.0.5']);
  });

  it('count their releases and their PRDs', () => {
    const weeks = weeksOf(rows);
    expect(weeks.map((w) => [w.releases.length, w.prds])).toEqual([[1, 1], [2, 2], [1, 2]]);
  });

  it('keep the four newest open and fold every older one', () => {
    expect(OPEN_WEEKS).toBe(4);
    const five = [
      ...rows,
      row(290, 5, '2026-10-13T08:00:00+00:00'),
      row(300, 6, '2026-10-20T08:00:00+00:00'),
    ];
    const weeks = weeksOf(five);
    expect(weeks.map((w) => [`${w.monday.month}/${w.monday.day}`, w.open])).toEqual([
      ['10/19', true], ['10/12', true], ['10/5', true], ['9/28', true], ['9/21', false],
    ]);
  });

  it('open every week while there are four or fewer', () => {
    expect(weeksOf(rows).every((w) => w.open)).toBe(true);
  });

  it('are none when nothing is released yet', () => {
    expect(weeksOf([])).toEqual([]);
  });

  it('skip no week that holds a release, and invent none that holds nothing', () => {
    const weeks = weeksOf([row(262, 2, '2026-09-28T09:00:00+00:00'), row(300, 3, '2026-11-30T09:00:00+00:00')]);
    expect(weeks).toHaveLength(2);
  });
});
