import { describe, expect, it } from 'vitest';
import { ACCESS_TTL_MS, accessCache } from './access-cache';
import type { AccessRow } from './access-row';

// The access a product's MCP server keeps a minute per key and product (bug #2954), on a clock the test moves.

const HASH = 'a'.repeat(64);
const OTHER_HASH = 'b'.repeat(64);
const ACCESS: AccessRow = {
  product: { id: 'p-acme', key: 'acme-app', name: 'Acme App', workspace_id: 'w-acme' },
  key_id: 'k-live',
  repositories: [{ repo: 'acme/api', pack_id: 'pack-api', sha: 'a'.repeat(40), committed_at: '2026-11-09T10:00:00Z' }],
  law_home: null,
  knowledge: { legal: [], glossary: [] },
};

function clocked(options: { max?: number } = {}) {
  let at = 1_000_000;
  const cache = accessCache({ ...options, now: () => at });
  return { cache, tick: (ms: number) => { at += ms; } };
}

describe('accessCache', () => {
  it('keeps a served access a minute, and no longer', () => {
    const { cache, tick } = clocked();
    cache.put(HASH, 'acme-app', ACCESS);
    tick(ACCESS_TTL_MS - 1);
    expect(cache.get(HASH, 'acme-app')).toBe(ACCESS);
    tick(1);
    expect(cache.get(HASH, 'acme-app')).toBeNull();
    expect(cache.size()).toBe(0);
  });

  it('a minute is 60 seconds', () => {
    expect(ACCESS_TTL_MS).toBe(60_000);
  });

  it('keeps one access per key and product: another key or another product reads nothing kept', () => {
    const { cache } = clocked();
    cache.put(HASH, 'acme-app', ACCESS);
    expect(cache.get(OTHER_HASH, 'acme-app')).toBeNull();
    expect(cache.get(HASH, 'acme-web')).toBeNull();
  });

  it('a put again starts its minute again', () => {
    const { cache, tick } = clocked();
    cache.put(HASH, 'acme-app', ACCESS);
    tick(ACCESS_TTL_MS - 10);
    cache.put(HASH, 'acme-app', ACCESS);
    tick(20);
    expect(cache.get(HASH, 'acme-app')).toBe(ACCESS);
  });

  it('drop forgets that key and product only', () => {
    const { cache } = clocked();
    cache.put(HASH, 'acme-app', ACCESS);
    cache.put(OTHER_HASH, 'acme-app', ACCESS);
    cache.drop(HASH, 'acme-app');
    expect(cache.get(HASH, 'acme-app')).toBeNull();
    expect(cache.get(OTHER_HASH, 'acme-app')).toBe(ACCESS);
  });

  it('holds at most max accesses, dropping the oldest put first', () => {
    const { cache } = clocked({ max: 2 });
    cache.put('1'.repeat(64), 'acme-app', ACCESS);
    cache.put('2'.repeat(64), 'acme-app', ACCESS);
    cache.put('1'.repeat(64), 'acme-app', ACCESS);
    cache.put('3'.repeat(64), 'acme-app', ACCESS);
    expect(cache.size()).toBe(2);
    expect(cache.get('2'.repeat(64), 'acme-app')).toBeNull();
    expect(cache.get('1'.repeat(64), 'acme-app')).toBe(ACCESS);
    expect(cache.get('3'.repeat(64), 'acme-app')).toBe(ACCESS);
  });

  it('holds 500 accesses by default', () => {
    const { cache } = clocked();
    for (let at = 0; at < 501; at += 1) cache.put(at.toString(16).padStart(64, '0'), 'acme-app', ACCESS);
    expect(cache.size()).toBe(500);
    expect(cache.get('0'.repeat(64), 'acme-app')).toBeNull();
  });
});
