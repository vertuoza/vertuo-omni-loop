import { describe, expect, it } from 'vitest';
import { WORKING_FOR_MS, workingState, type WorkingPing } from './state';

const NOW = Date.parse('2026-09-30T10:00:00Z');
const ping = (ageMs: number, ended = false): WorkingPing => ({
  seen_at: new Date(NOW - ageMs).toISOString(),
  ended_at: ended ? new Date(NOW - ageMs).toISOString() : null,
});

describe('workingState: working, asking or idle', () => {
  it('holds working for 3 minutes after the last heartbeat', () => {
    expect(WORKING_FOR_MS).toBe(3 * 60 * 1000);
  });

  it('is working within 3 minutes of the last heartbeat, and nothing open', () => {
    expect(workingState(ping(0), 0, NOW)).toBe('working');
    expect(workingState(ping(WORKING_FOR_MS - 1), 0, NOW)).toBe('working');
  });

  it('is idle at exactly 3 minutes, and after', () => {
    expect(workingState(ping(WORKING_FOR_MS), 0, NOW)).toBe('idle');
    expect(workingState(ping(WORKING_FOR_MS + 60_000), 0, NOW)).toBe('idle');
  });

  it('is idle once the session ended, however fresh', () => {
    expect(workingState(ping(0, true), 0, NOW)).toBe('idle');
  });

  it('is asking over working when a question is open', () => {
    expect(workingState(ping(0), 1, NOW)).toBe('asking');
    expect(workingState(ping(0), 3, NOW)).toBe('asking');
  });

  it('is asking whenever a question is open, even with no ping', () => {
    expect(workingState(null, 1, NOW)).toBe('asking');
    expect(workingState(ping(WORKING_FOR_MS * 2, true), 1, NOW)).toBe('asking');
  });

  it('is idle when the ping is null, or unreadable', () => {
    expect(workingState(null, 0, NOW)).toBe('idle');
    expect(workingState({ seen_at: 'not a date', ended_at: null }, 0, NOW)).toBe('idle');
  });

  it('reads a heartbeat a little ahead of this clock as working', () => {
    expect(workingState(ping(-60_000), 0, NOW)).toBe('working');
  });
});
