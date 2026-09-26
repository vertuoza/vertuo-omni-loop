import { describe, it, expect } from 'vitest';
import { IDLE_CLOSE_MS, sessionClosed } from './store';

const NOW = Date.parse('2026-09-26T12:00:00Z');
const seen = (msAgo: number) => new Date(NOW - msAgo).toISOString();

describe('sessionClosed', () => {
  it('reads a closed session as closed', () => {
    expect(sessionClosed({ status: 'closed', last_seen_at: seen(0) }, NOW)).toBe(true);
  });

  it('reads an open session as open until 12 hours pass without a call', () => {
    expect(IDLE_CLOSE_MS).toBe(12 * 60 * 60 * 1000);
    expect(sessionClosed({ status: 'open', last_seen_at: seen(0) }, NOW)).toBe(false);
    expect(sessionClosed({ status: 'open', last_seen_at: seen(IDLE_CLOSE_MS - 1) }, NOW)).toBe(false);
    expect(sessionClosed({ status: 'open', last_seen_at: seen(IDLE_CLOSE_MS) }, NOW)).toBe(true);
    expect(sessionClosed({ status: 'open', last_seen_at: seen(3 * IDLE_CLOSE_MS) }, NOW)).toBe(true);
  });
});
