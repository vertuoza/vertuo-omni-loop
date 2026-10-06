import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readLedger, appendEvents, fileLedger, memoryLedger } from './ledger.ts';

const ev = (id: string, at: string, type = 'ZONE_SECURED') => ({ id, at, type, planet: 2332, data: {} });

describe('ledger', () => {
  it('appends only unknown ids, one file per month, and reads back sorted', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ledger-'));
    const first = appendEvents(dir, [ev('b', '2026-09-02T10:00:00Z'), ev('a', '2026-09-01T10:00:00Z')]);
    expect(first.map((e) => e.id)).toEqual(['b', 'a']);
    const second = appendEvents(dir, [ev('a', '2026-09-01T10:00:00Z'), ev('c', '2026-10-01T10:00:00Z')]);
    expect(second.map((e) => e.id)).toEqual(['c']);
    expect(existsSync(join(dir, '2026-09.jsonl'))).toBe(true);
    expect(existsSync(join(dir, '2026-10.jsonl'))).toBe(true);
    expect(readFileSync(join(dir, '2026-09.jsonl'), 'utf8').trim().split('\n')).toHaveLength(2);
    expect(readLedger(dir).map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('reads an empty or missing directory as no events', () => {
    expect(readLedger(join(tmpdir(), `does-not-exist-${Date.now()}`))).toEqual([]);
  });

  it('refuses a malformed event instead of writing it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ledger-'));
    expect(() => appendEvents(dir, [{ id: 'x', at: 'nope', type: 'ZONE_SECURED', planet: 1 }])).toThrow();
    expect(readLedger(dir)).toEqual([]);
  });
});

// The contract every store keeps; supabaseLedger is held to the same one in sources/supabase.test.ts.
describe.each([
  ['memoryLedger', () => memoryLedger()],
  ['fileLedger', () => fileLedger(mkdtempSync(join(tmpdir(), 'ledger-')))],
])('%s', (_, make) => {
  it('appends only new ids, returns them, and reads everything back sorted', async () => {
    const store = make();
    expect((await store.append([ev('b', '2026-09-02T10:00:00Z'), ev('a', '2026-09-01T10:00:00Z')])).map((e) => e.id)).toEqual(['b', 'a']);
    expect((await store.append([ev('a', '2026-09-01T10:00:00Z'), ev('c', '2026-10-01T10:00:00Z')])).map((e) => e.id)).toEqual(['c']);
    expect((await store.read()).map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('refuses a malformed batch before storing any of it', async () => {
    const store = make();
    await expect(store.append([ev('ok', '2026-09-01T10:00:00Z'), { id: 'x', at: 'nope', type: 'ZONE_SECURED', planet: 1 }])).rejects.toThrow();
    expect(await store.read()).toEqual([]);
  });
});
