import { describe, expect, it } from 'vitest';
import { costUsd, priceOf } from './prices';

const TOKENS = { input: 1_000_000, output: 1_000_000, cacheRead: 1_000_000, cacheWrite: 1_000_000 };

describe('the price table', () => {
  it('prices a known model from its tokens: input, output, cache reads and cache writes', () => {
    // Sonnet 4.6: $3 in, $15 out, $0.30 cache read, $3.75 cache write, per million tokens.
    expect(costUsd('claude-sonnet-4-6', TOKENS)).toBe(22.05);
    expect(costUsd('claude-sonnet-4-6', { input: 1000, output: 2000, cacheRead: 0, cacheWrite: 0 })).toBe(0.033);
  });

  it('knows a model under its dated id and its context-window suffix', () => {
    expect(priceOf('claude-opus-4-1-20250805')).toEqual(priceOf('claude-opus-4-1'));
    expect(priceOf('claude-opus-5-5[1m]')).toEqual(priceOf('claude-opus-5-5'));
    expect(priceOf('claude-opus-5-5')).not.toBeNull();
  });

  it('gives null for an unknown model, a model that only starts like a known one, or no tokens', () => {
    expect(costUsd('gpt-5', TOKENS)).toBeNull();
    expect(costUsd('claude-opus-4-9', TOKENS)).toBeNull();
    expect(costUsd(null, TOKENS)).toBeNull();
    expect(costUsd('claude-sonnet-4-6', null)).toBeNull();
  });

  it('rounds to the column: four decimals of a dollar', () => {
    expect(costUsd('claude-haiku-4-5', { input: 1, output: 0, cacheRead: 0, cacheWrite: 0 })).toBe(0);
    expect(costUsd('claude-haiku-4-5', { input: 123_456, output: 0, cacheRead: 0, cacheWrite: 0 })).toBe(0.1235);
  });
});
