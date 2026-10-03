import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { boundaries } from './business.boundary';

// The business module's reads, as `pnpm schemas:verify` runs them (PRD 1030), against a client that
// records what each asks: a name each, a select or an rpc called as a plain read, and nothing written.

function recorder() {
  const asked: unknown[][] = [];
  const answer = { data: [], error: null };
  const query = {
    eq: (...a: unknown[]) => (asked.push(['eq', ...a]), query),
    then: (ok: (v: unknown) => unknown) => Promise.resolve(answer).then(ok),
  };
  const db = {
    from: (table: string) => ({ select: (columns: string) => (asked.push(['select', table, columns]), query) }),
    rpc: (fn: string, args: unknown, options: unknown) => (asked.push(['rpc', fn, args, options]), Promise.resolve({ data: false, error: null })),
  };
  return { asked, db };
}

describe('the business boundaries', () => {
  it('name each read once', () => {
    const names = boundaries.map((b) => b.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names.every((n) => n.startsWith('business/'))).toBe(true);
  });

  it('only select, or call a function as a plain read', async () => {
    for (const boundary of boundaries) {
      const { asked, db } = recorder();
      expect(await boundary.read(db as never)).toHaveProperty('error', null);
      const first = asked[0] ?? [];
      if (first[0] === 'rpc') expect(first[3]).toEqual({ get: true });
      else expect(first[0]).toBe('select');
    }
  });

  it('read the columns the modules read', async () => {
    const { asked, db } = recorder();
    for (const boundary of boundaries) await boundary.read(db as never);
    expect(asked).toContainEqual(['select', 'claims', 'id, seq, kind, value, source, state, product_id, replaces, last_seen']);
    expect(asked).toContainEqual(['select', 'personas', 'id, product_id, ordinal, name, stance, trade, avatar, who, usage']);
    expect(asked).toContainEqual(['rpc', 'is_owner', { workspace: '00000000-0000-0000-0000-000000000000' }, { get: true }]);
  });
});
