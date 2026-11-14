import { describe, expect, it } from 'vitest';
import { virtualFleetsRepository, type VirtualFleetsDb } from './virtual-fleets.repository';

// The Virtual Fleets' reads and writes (PRD 2842 s1), against a client that records each call and answers
// as PostgREST does: create_virtual_fleet() with its arguments, its row parsed or its refusal passed on;
// the virtual fleets' keys read by kind.

const WORKSPACE = '11111111-1111-4111-8111-111111111111';

function client(answer: { data: unknown; error: unknown }) {
  const calls: unknown[] = [];
  const query = {
    select(columns: string) { calls.push(['select', columns]); return query; },
    eq(column: string, value: unknown) { calls.push(['eq', column, value]); return query; },
    then(resolve: (value: unknown) => void) { resolve(answer); },
  };
  const db = {
    rpc(fn: string, args: unknown) { calls.push(['rpc', fn, args]); return Promise.resolve(answer); },
    from(table: string) { calls.push(['from', table]); return query; },
  } as unknown as VirtualFleetsDb;
  return { db, calls };
}

const ROW = { workspace_id: WORKSPACE, name: 'night-shift', label: 'Night Shift', color: '#4fb0ff', mascot: 'robot', motto: '', sort: 100, kind: 'virtual', retired_at: null };

describe('the virtual fleets repository', () => {
  it('calls create_virtual_fleet() as the person, and answers the fleet as made', async () => {
    const { db, calls } = client({ data: ROW, error: null });
    const made = await virtualFleetsRepository(db).create({ workspace: WORKSPACE, name: 'Night Shift', mascot: 'robot', roles: ['engineer', 'qa'] });
    expect(made).toEqual({ ok: true, value: { name: 'night-shift', label: 'Night Shift', color: '#4fb0ff', mascot: 'robot' } });
    expect(calls).toEqual([['rpc', 'create_virtual_fleet', { p_workspace: WORKSPACE, p_name: 'Night Shift', p_mascot: 'robot', p_roles: ['engineer', 'qa'] }]]);
  });

  it('passes a refusal on with its code, hint and words', async () => {
    const { db } = client({ data: null, error: { code: '22023', hint: 'name', message: 'Name taken: choose another' } });
    expect(await virtualFleetsRepository(db).create({ workspace: WORKSPACE, name: 'Beaver', mascot: 'robot', roles: ['qa'] }))
      .toEqual({ ok: false, code: '22023', hint: 'name', message: 'Name taken: choose another' });
  });

  it('throws on a row it cannot read', async () => {
    const { db } = client({ data: { name: 'x' }, error: null });
    await expect(virtualFleetsRepository(db).create({ workspace: WORKSPACE, name: 'X', mascot: 'robot', roles: ['qa'] })).rejects.toThrow();
  });

  it('reads the keys of the workspace\'s virtual fleets by kind, and throws when it cannot', async () => {
    const { db, calls } = client({ data: [{ name: 'night-shift' }, { name: 'day-shift' }], error: null });
    expect(await virtualFleetsRepository(db).names(WORKSPACE)).toEqual(['night-shift', 'day-shift']);
    expect(calls).toEqual([['from', 'teams'], ['select', 'name'], ['eq', 'workspace_id', WORKSPACE], ['eq', 'kind', 'virtual']]);
    const broken = client({ data: null, error: { message: 'down' } });
    await expect(virtualFleetsRepository(broken.db).names(WORKSPACE)).rejects.toThrow(/could not read the virtual fleets \(down\)/);
  });
});
