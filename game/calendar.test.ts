import { describe, it, expect } from 'vitest';
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
});
