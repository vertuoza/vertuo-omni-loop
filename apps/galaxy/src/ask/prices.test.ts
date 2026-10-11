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

  // Law BR-PRODUCT-38 (.omni-loop/knowledge/product/rules.md, #1499).
  it('law BR-PRODUCT-38: per-million prices, cache reads 0.1x and writes 1.25x input unless the entry says otherwise, no cost for an unlisted model', () => {
    const one = (k: keyof typeof TOKENS) => ({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0, [k]: 1_000_000 });
    // claude-sonnet-4-6 lists $3 input, $15 output per million and states no cache price of its own.
    expect(costUsd('claude-sonnet-4-6', one('input'))).toBe(3);
    expect(costUsd('claude-sonnet-4-6', one('output'))).toBe(15);
    expect(costUsd('claude-sonnet-4-6', one('cacheRead'))).toBe(0.3);
    expect(costUsd('claude-sonnet-4-6', one('cacheWrite'))).toBe(3.75);
    // claude-opus-5-5 states its own cache-read price ($0.20), which wins over 0.1x its $4 input.
    expect(costUsd('claude-opus-5-5', one('cacheRead'))).toBe(0.2);
    expect(costUsd('claude-opus-5-5', one('cacheWrite'))).toBe(5);
    // A model not on the list shows no cost, never a guess.
    expect(costUsd('claude-unlisted-9', TOKENS)).toBeNull();
  });
});
