import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { loadConstituentsPanel } from './constituents-load';
import { sure } from '../arcade/sure';

// The Constituents panel's read (PRD 871 s2), against a stubbed client: no test calls Supabase.

type Answer = { data?: unknown; error?: { message: string } | null };

const ROWS = [
  { id: 'k-1', product_id: 'p-1', kind: 'statement', seq: null, body: 'The workshop', created_by: 'u-1', created_at: 't', updated_at: 't', removed_at: null, removed_by: null },
  { id: 'k-2', product_id: 'p-1', kind: 'never', seq: 1, body: 'Calls real APIs', created_by: 'u-1', created_at: 't', updated_at: 't', removed_at: null, removed_by: null },
];
const EVENTS = [
  { id: 1, product_id: 'p-1', constituent_id: 'k-1', action: 'added', before: null, after: 'The workshop', note: null, claim_id: null, changed_by: 'u-1', changed_at: '2026-10-01T09:00:00Z' },
  { id: 2, product_id: 'p-1', constituent_id: 'k-2', action: 'moved', before: null, after: 'Calls real APIs', note: 'moved from Business never#3', claim_id: 'c-3', changed_by: null, changed_at: '2026-10-01T09:01:00Z' },
  { id: '3', product_id: 'p-1', constituent_id: 'k-2', action: 'edited', before: 'x', after: 'Calls real APIs', note: null, claim_id: null, changed_by: 'u-gone', changed_at: '2026-10-01T09:02:00Z' },
];

function db({
  constituents = { data: ROWS },
  events = { data: EVENTS },
  owner = { data: true },
  roster = { data: [{ user_id: 'u-1', name: 'Pierre', github_login: 'Pierre-D', avatar_url: null, fleet: null }] },
}: Partial<Record<'constituents' | 'events' | 'owner' | 'roster', Answer>> = {}) {
  const calls: unknown[] = [];
  const answer = (a: Answer) => Promise.resolve({ data: a.data ?? null, error: a.error ?? null });
  const tables: Record<string, Answer> = { constituents, constituent_events: events, teams: { data: [] } };
  const query = (table: string) => {
    const q = {
      select: () => q,
      in: (...a: unknown[]) => { calls.push(['in', table, ...a]); return answer(sure(tables[table], 'tables[table]')); },
      eq: () => answer(sure(tables[table], 'tables[table]')),
    };
    return q;
  };
  return {
    calls,
    rpc: (fn: string, args: unknown) => { calls.push(['rpc', fn, args]); return answer(fn === 'is_owner' ? owner : roster); },
    from: (table: string) => query(table),
  };
}

describe('the Constituents panel\'s read', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('reads the products\' constituents and history, the role, and the people the history names', async () => {
    const d = db();
    const read = await loadConstituentsPanel(d as never, 'ws-1', ['p-1', 'p-2']);
    expect(read.owner).toBe(true);
    expect(read.constituents?.map((c) => c.displayId)).toEqual(['statement', 'never#1']);
    expect(read.events.map((e) => e.id)).toEqual([1, 2, 3]);
    expect(Object.keys(read.people)).toEqual(['u-1']);
    expect(read.people['u-1']).toMatchObject({ name: 'Pierre', login: 'pierre-d' });
    expect(d.calls).toContainEqual(['in', 'constituents', 'product_id', ['p-1', 'p-2']]);
    expect(d.calls).toContainEqual(['rpc', 'is_owner', { workspace: 'ws-1' }]);
  });

  it('reads a role it cannot read, or anything but true, as a member\'s', async () => {
    expect((await loadConstituentsPanel(db({ owner: { error: { message: 'down' } } }) as never, 'ws-1', ['p-1'])).owner).toBe(false);
    expect((await loadConstituentsPanel(db({ owner: { data: false } }) as never, 'ws-1', ['p-1'])).owner).toBe(false);
  });

  it('answers null constituents when they cannot be read, and the page carries on', async () => {
    const read = await loadConstituentsPanel(db({ events: { error: { message: 'down' } } }) as never, 'ws-1', ['p-1']);
    expect(read).toEqual({ constituents: null, events: [], owner: true, people: {} });
  });

  it('reads a role or members that do not parse as a member\'s and no people (PRD 1030)', async () => {
    const read = await loadConstituentsPanel(db({ owner: { data: 'yes' }, roster: { data: [{ user_id: 7 }] } }) as never, 'ws-1', ['p-1']);
    expect(read.owner).toBe(false);
    expect(read.people).toEqual({});
  });

  it('leaves the people empty when the members cannot be read', async () => {
    expect((await loadConstituentsPanel(db({ roster: { error: { message: 'down' } } }) as never, 'ws-1', ['p-1'])).people).toEqual({});
  });
});
