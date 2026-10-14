import { describe, it, expect, vi } from 'vitest';
import { isWorkingTime, workingMinutesBetween, addWorkingMinutes, tranchesBetween } from './calendar.ts';

// September 2026: Brussels is CEST, UTC+2. Wed 2026-09-23.
const d = (s: string): Date => new Date(s);

describe('calendar', () => {
  it('knows a Wednesday noon is working time and a Saturday is not', () => {
    expect(isWorkingTime(d('2026-09-23T10:00:00Z'))).toBe(true);   // 12:00 local
    expect(isWorkingTime(d('2026-09-26T10:00:00Z'))).toBe(false);  // Saturday
    expect(isWorkingTime(d('2026-09-23T06:59:00Z'))).toBe(false);  // 08:59 local
    expect(isWorkingTime(d('2026-09-23T07:00:00Z'))).toBe(true);   // 09:00 local
    expect(isWorkingTime(d('2026-09-23T16:00:00Z'))).toBe(false);  // 18:00 local
  });

  it('counts working minutes across a night', () => {
    // Wed 12:00 → Thu 12:00 local: 6h + 3h
    expect(workingMinutesBetween(d('2026-09-23T10:00:00Z'), d('2026-09-24T10:00:00Z'))).toBe(540);
  });

  it('counts a weekend as zero', () => {
    // Fri 17:00 → Mon 10:00 local: 1h + 1h
    expect(workingMinutesBetween(d('2026-09-25T15:00:00Z'), d('2026-09-28T08:00:00Z'))).toBe(120);
    expect(tranchesBetween(d('2026-09-25T15:00:00Z'), d('2026-09-28T08:00:00Z'), 240)).toBe(0);
  });

  it('returns zero when to is before from', () => {
    expect(workingMinutesBetween(d('2026-09-24T10:00:00Z'), d('2026-09-23T10:00:00Z'))).toBe(0);
  });

  it('adds working minutes across a weekend', () => {
    // Fri 17:00 local + 480 working min = Mon 16:00 local (1h Fri, 7h Mon)
    expect(addWorkingMinutes(d('2026-09-25T15:00:00Z'), 480).toISOString()).toBe('2026-09-28T14:00:00.000Z');
  });

  it('adds zero minutes as identity', () => {
    expect(addWorkingMinutes(d('2026-09-23T10:00:00Z'), 0).toISOString()).toBe('2026-09-23T10:00:00.000Z');
  });

  it('follows the clock change: 09:00 local is 07:00 UTC in summer and 08:00 UTC in winter', () => {
    // Brussels leaves CEST for CET on Sun 2026-10-25 at 01:00 UTC.
    expect(isWorkingTime(d('2026-10-23T07:00:00Z'))).toBe(true);   // Fri 09:00 CEST
    expect(isWorkingTime(d('2026-10-26T07:45:00Z'))).toBe(false);  // Mon 08:45 CET
    expect(isWorkingTime(d('2026-10-26T08:00:00Z'))).toBe(true);   // Mon 09:00 CET
    expect(isWorkingTime(d('2026-10-26T16:45:00Z'))).toBe(true);   // Mon 17:45 CET
    expect(isWorkingTime(d('2026-10-26T17:00:00Z'))).toBe(false);  // Mon 18:00 CET
  });

  // #1788: the galaxy fold counts the working time of every wound of the ledger, and asking Intl for
  // the zone at every quarter-hour made it take seconds on each dashboard view.
  it('counts a month of working time without asking the zone at every quarter-hour', () => {
    const parts = vi.spyOn(Intl.DateTimeFormat.prototype, 'formatToParts');
    try {
      // 31 days, 2976 quarter-hours.
      expect(workingMinutesBetween(d('2026-03-01T00:00:00Z'), d('2026-04-01T00:00:00Z'))).toBe(slowWorkingMinutes(d('2026-03-01T00:00:00Z'), d('2026-04-01T00:00:00Z')));
      parts.mockClear();
      workingMinutesBetween(d('2026-03-01T00:00:00Z'), d('2026-04-01T00:00:00Z'));
      expect(parts.mock.calls.length).toBeLessThanOrEqual(100);
    } finally {
      parts.mockRestore();
    }
  });

  it('counts and adds working minutes as stepping every quarter-hour through the zone does, across both clock changes', () => {
    // Spans around the 2026 clock changes (29 March, 25 October) and across a weekend, from off-grid starts.
    const spans: [string, string][] = [
      ['2026-03-26T06:07:00Z', '2026-04-02T19:31:00Z'],
      ['2026-03-28T23:59:00Z', '2026-03-30T08:01:00Z'],
      ['2026-10-22T05:13:00Z', '2026-10-29T17:44:00Z'],
      ['2026-10-24T22:00:00Z', '2026-10-26T09:30:00Z'],
      ['2026-12-31T16:59:00Z', '2027-01-04T07:01:00Z'],
    ];
    for (const [from, to] of spans) {
      expect(workingMinutesBetween(d(from), d(to)), `${from} → ${to}`).toBe(slowWorkingMinutes(d(from), d(to)));
      for (const minutes of [1, 15, 240, 540, 2400]) {
        expect(addWorkingMinutes(d(from), minutes).toISOString(), `${from} + ${minutes}`).toBe(slowAddWorkingMinutes(d(from), minutes).toISOString());
      }
    }
  });
});

// The calendar as first written (32b4f09b): the zone's weekday and hour read through Intl at every
// quarter-hour. Correct and slow; the oracle the fast calendar must agree with.
const zone = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Brussels', weekday: 'short', hour: 'numeric', hour12: false });
function slowIsWorkingTime(date: Date): boolean {
  const p = Object.fromEntries(zone.formatToParts(date).map((x) => [x.type, x.value]));
  const hour = Number(p.hour) % 24;
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(p.weekday ?? '') && hour >= 9 && hour < 18;
}
function slowWorkingMinutes(from: Date, to: Date): number {
  let minutes = 0;
  for (let t = from.getTime(); t < to.getTime(); t += 15 * 60 * 1000) if (slowIsWorkingTime(new Date(t))) minutes += 15;
  return minutes;
}
function slowAddWorkingMinutes(from: Date, minutes: number): Date {
  let t = from.getTime();
  for (let left = minutes; left > 0; t += 15 * 60 * 1000) if (slowIsWorkingTime(new Date(t))) left -= 15;
  return new Date(t);
}
