import { describe, expect, it } from 'vitest';
import { FIRST_TICK_MS, loopState, SILENT_AFTER_MS, type LoopTimes } from './state';

const NOW = Date.parse('2026-10-07T10:00:00Z');
const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();
const running = (nextWake: number | null, seenAgo = 0): LoopTimes => ({
  state: 'running',
  seen_at: at(-seenAgo),
  next_wake_at: nextWake === null ? null : at(nextWake),
});

describe('loopState: live, sleeping, parked, stopped or silent', () => {
  it('turns silent 5 minutes past the next wake, and an hour after the last push before any', () => {
    expect(SILENT_AFTER_MS).toBe(5 * 60 * 1000);
    expect(FIRST_TICK_MS).toBe(60 * 60 * 1000);
  });

  it('is sleeping until the next wake', () => {
    expect(loopState(running(90_000), NOW)).toBe('sleeping');
    expect(loopState(running(1), NOW)).toBe('sleeping');
  });

  it('is live from the next wake until 5 minutes past it: the tick is running', () => {
    expect(loopState(running(0), NOW)).toBe('live');
    expect(loopState(running(-(SILENT_AFTER_MS - 1)), NOW)).toBe('live');
  });

  it('is silent at exactly 5 minutes past the next wake, and after', () => {
    expect(loopState(running(-SILENT_AFTER_MS), NOW)).toBe('silent');
    expect(loopState(running(-SILENT_AFTER_MS - 60_000), NOW)).toBe('silent');
  });

  it('is live before its first tick set a wake, until an hour after its last push', () => {
    expect(loopState(running(null, 0), NOW)).toBe('live');
    expect(loopState(running(null, FIRST_TICK_MS - 1), NOW)).toBe('live');
    expect(loopState(running(null, FIRST_TICK_MS), NOW)).toBe('silent');
  });

  it('is parked or stopped as stored, whatever its times', () => {
    expect(loopState({ ...running(-SILENT_AFTER_MS * 10), state: 'parked' }, NOW)).toBe('parked');
    expect(loopState({ ...running(90_000), state: 'stopped' }, NOW)).toBe('stopped');
  });

  it('reads an unreadable time as silent, never as live', () => {
    expect(loopState({ state: 'running', seen_at: 'not a date', next_wake_at: null }, NOW)).toBe('silent');
    expect(loopState({ state: 'running', seen_at: at(0), next_wake_at: 'not a date' }, NOW)).toBe('silent');
  });
});
