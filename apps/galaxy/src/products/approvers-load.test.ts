import { describe, expect, it, vi } from 'vitest';
import { loadApprovers, type ApproversDb } from './approvers-load';

vi.mock('server-only', () => ({}));

// A product's Approvers list read for its page (PRD 1322 s1), as the signed-in person (stubbed: no test
// calls Supabase): whether they own the workspace, its members by name, and the product's listed
// members with their state. A role that cannot be read reads as a member's; a list or members that
// cannot be read leave the section saying so (null).

const ROSTER = [
  { user_id: 'u-irisa', name: 'Irisa', github_login: 'irisa', avatar_url: null, fleet: null },
  { user_id: 'u-paul', name: null, github_login: 'paul', avatar_url: null, fleet: 'core' },
];
const ROWS = [{ user_id: 'u-paul', state: 'skipped' }, { user_id: 'u-irisa', state: 'asked' }];

type Answer = { data: unknown; error: { message: string } | null };
const ok = (data: unknown): Answer => ({ data, error: null });

function db({ owner = ok(true), roster = ok(ROSTER), rows = ok(ROWS) }: { owner?: Answer; roster?: Answer; rows?: Answer } = {}) {
  const calls: unknown[] = [];
  const stub: ApproversDb = {
    rpc: (fn, args) => {
      calls.push([fn, args]);
      return Promise.resolve(fn === 'is_owner' ? owner : roster);
    },
    from: (table) => ({
      select: (columns) => ({
        eq: (column, value) => {
          calls.push([table, columns, column, value]);
          return Promise.resolve(rows);
        },
      }),
    }),
  };
  return { calls, stub };
}

describe('the Approvers list read', () => {
  it('reads the owner\'s role, the members and the product\'s listed members, in the members\' order', async () => {
    const d = db();
    expect(await loadApprovers(d.stub, 'ws-1', 'p-1')).toEqual({
      owner: true,
      members: [{ id: 'u-irisa', name: 'Irisa', login: 'irisa' }, { id: 'u-paul', name: null, login: 'paul' }],
      listed: [{ id: 'u-irisa', name: 'Irisa', login: 'irisa', state: 'asked' }, { id: 'u-paul', name: null, login: 'paul', state: 'skipped' }],
    });
    expect(d.calls).toEqual([
      ['is_owner', { workspace: 'ws-1' }],
      ['workspace_roster', { workspace: 'ws-1' }],
      ['product_approvers', 'user_id, state', 'product_id', 'p-1'],
    ]);
  });

  it('reads a member who is not an owner, and a role it cannot read, as not an owner', async () => {
    expect(await loadApprovers(db({ owner: ok(false) }).stub, 'ws-1', 'p-1')).toMatchObject({ owner: false });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await loadApprovers(db({ owner: { data: null, error: { message: 'down' } } }).stub, 'ws-1', 'p-1')).toMatchObject({ owner: false });
  });

  it('answers null when the members or the list cannot be read, or come out of shape', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await loadApprovers(db({ roster: { data: null, error: { message: 'down' } } }).stub, 'ws-1', 'p-1')).toBeNull();
    expect(await loadApprovers(db({ rows: { data: null, error: { message: 'down' } } }).stub, 'ws-1', 'p-1')).toBeNull();
    expect(await loadApprovers(db({ rows: ok([{ user_id: 'u-paul', state: 'maybe' }]) }).stub, 'ws-1', 'p-1')).toBeNull();
  });
});
