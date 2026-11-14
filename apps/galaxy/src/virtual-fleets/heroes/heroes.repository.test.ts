import { describe, expect, it } from 'vitest';
import type { VirtualFleetsDb } from '../virtual-fleets.repository';
import { heroesRepository } from './heroes.repository';

// The Heroes' reads and writes (PRD 2842 s6), against a client that records each call and answers as
// PostgREST does: the heroes read by workspace and fleet in position order, add_virtual_hero() and
// remove_virtual_hero() with their arguments, their row parsed or their refusal passed on.

const WORKSPACE = '11111111-1111-4111-8111-111111111111';
const HERO = '22222222-2222-4222-8222-222222222222';
const ROW = { id: HERO, fleet: 'night-shift', name: 'QA', role: 'qa', skills: ['prove'], agent: 'claude', model: 'sonnet', limits: ['It never merges into the default branch.'], position: 1 };

function client(answer: { data: unknown; error: unknown }) {
  const calls: unknown[] = [];
  const query = {
    select(columns: string) { calls.push(['select', columns]); return query; },
    eq(column: string, value: unknown) { calls.push(['eq', column, value]); return query; },
    order(column: string) { calls.push(['order', column]); return query; },
    then(resolve: (value: unknown) => void) { resolve(answer); },
  };
  const db = {
    rpc(fn: string, args: unknown) { calls.push(['rpc', fn, args]); return Promise.resolve(answer); },
    from(table: string) { calls.push(['from', table]); return query; },
  } as unknown as VirtualFleetsDb;
  return { db, calls };
}

describe('the heroes repository', () => {
  it('reads a fleet\'s heroes in position order, and throws when it cannot', async () => {
    const { db, calls } = client({ data: [ROW], error: null });
    expect(await heroesRepository(db).heroes(WORKSPACE, 'night-shift')).toEqual([ROW]);
    expect(calls).toEqual([
      ['from', 'virtual_heroes'], ['select', 'id, fleet, name, role, skills, agent, model, limits, position'],
      ['eq', 'workspace_id', WORKSPACE], ['eq', 'fleet', 'night-shift'], ['order', 'position'],
    ]);
    await expect(heroesRepository(client({ data: null, error: { message: 'down' } }).db).heroes(WORKSPACE, 'x')).rejects.toThrow(/could not read the heroes \(down\)/);
    await expect(heroesRepository(client({ data: [{ id: 'x' }], error: null }).db).heroes(WORKSPACE, 'x')).rejects.toThrow();
  });

  it('knows an owner from a member, and throws when it cannot read', async () => {
    const owner = client({ data: [{ role: 'owner' }], error: null });
    expect(await heroesRepository(owner.db).owns(WORKSPACE, 'u-ada')).toBe(true);
    expect(owner.calls).toEqual([['from', 'workspace_members'], ['select', 'role'], ['eq', 'workspace_id', WORKSPACE], ['eq', 'user_id', 'u-ada']]);
    expect(await heroesRepository(client({ data: [{ role: 'member' }], error: null }).db).owns(WORKSPACE, 'u-ben')).toBe(false);
    expect(await heroesRepository(client({ data: [], error: null }).db).owns(WORKSPACE, 'u-dan')).toBe(false);
    await expect(heroesRepository(client({ data: null, error: { message: 'down' } }).db).owns(WORKSPACE, 'u')).rejects.toThrow(/could not read your membership \(down\)/);
  });

  it('calls add_virtual_hero() as the person, and answers the hero as made', async () => {
    const { db, calls } = client({ data: ROW, error: null });
    expect(await heroesRepository(db).add({ workspace: WORKSPACE, fleet: 'night-shift', role: 'qa' })).toEqual({ ok: true, value: ROW });
    expect(calls).toEqual([['rpc', 'add_virtual_hero', { p_workspace: WORKSPACE, p_fleet: 'night-shift', p_role: 'qa' }]]);
  });

  it('passes a refusal on with its code, hint and words, and throws on a row it cannot read', async () => {
    const { db } = client({ data: null, error: { code: '22023', hint: 'role', message: 'Role: this fleet already has that hero.' } });
    expect(await heroesRepository(db).add({ workspace: WORKSPACE, fleet: 'night-shift', role: 'qa' }))
      .toEqual({ ok: false, code: '22023', hint: 'role', message: 'Role: this fleet already has that hero.' });
    expect(await heroesRepository(client({ data: null, error: { message: 'x' } }).db).remove({ workspace: WORKSPACE, hero: HERO }))
      .toEqual({ ok: false, code: null, hint: null, message: 'x' });
    await expect(heroesRepository(client({ data: { id: 'x' }, error: null }).db).add({ workspace: WORKSPACE, fleet: 'f', role: 'qa' })).rejects.toThrow();
  });

  it('calls remove_virtual_hero() with the hero', async () => {
    const { db, calls } = client({ data: null, error: null });
    expect(await heroesRepository(db).remove({ workspace: WORKSPACE, hero: HERO })).toEqual({ ok: true, value: null });
    expect(calls).toEqual([['rpc', 'remove_virtual_hero', { p_workspace: WORKSPACE, p_hero: HERO }]]);
  });
});
