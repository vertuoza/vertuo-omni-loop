import { describe, expect, it } from 'vitest';
import { SPRITE_DEFS } from '@omni/design';
import { databaseFleets, demoFleetsPort, MASCOTS, type FleetsPort } from './store';

// /app/fleets's four calls (PRD 400 s3): through the owner-only fleet functions of s1, each answering
// the public.teams row it saved, or refusing. The demo keeps the same rules in memory.

const WS = 'ws-1';
const ROW = { name: 'sharks', label: 'SHARKS', color: '#2fc6a4', motto: 'Bite first.', mascot: 'octopod', home: null, sort: 30, retired_at: null };

function fakeRpc(answer: { data?: unknown; error?: unknown }) {
  const calls: [string, Record<string, unknown>][] = [];
  const db = { rpc: async (fn: string, args: Record<string, unknown>) => { calls.push([fn, args]); return { data: answer.data ?? null, error: answer.error ?? null }; } };
  return { db, calls };
}

const LOOK = { label: 'SHARKS', color: '#2fc6a4', motto: 'Bite first.', mascot: 'octopod' };

describe('the database fleets', () => {
  it('creates through create_fleet(), in the workspace shown, and answers the fleet as saved', async () => {
    const { db, calls } = fakeRpc({ data: ROW });
    const saved = await databaseFleets(db, WS).create(LOOK);
    expect(calls).toEqual([['create_fleet', { p_workspace: WS, p_label: 'SHARKS', p_color: '#2fc6a4', p_motto: 'Bite first.', p_mascot: 'octopod' }]]);
    expect(saved).toEqual({ ok: true, fleet: { name: 'sharks', home: null, label: 'SHARKS', color: '#2fc6a4', motto: 'Bite first.', mascot: 'octopod', sort: 30, retired: false } });
  });

  it('sends no mascot as none', async () => {
    const { db, calls } = fakeRpc({ data: ROW });
    await databaseFleets(db, WS).create({ ...LOOK, mascot: null });
    expect(calls[0][1].p_mascot).toBeNull();
  });

  it('updates a fleet by its name, which it never sends to change', async () => {
    const { db, calls } = fakeRpc({ data: ROW });
    await databaseFleets(db, WS).update('sharks', LOOK);
    expect(calls).toEqual([['update_fleet', { p_workspace: WS, p_name: 'sharks', p_label: 'SHARKS', p_color: '#2fc6a4', p_motto: 'Bite first.', p_mascot: 'octopod' }]]);
  });

  it('retires and restores by name, and reads a retired row as retired', async () => {
    const retired = fakeRpc({ data: { ...ROW, retired_at: '2026-09-28T10:00:00Z' } });
    expect(await databaseFleets(retired.db, WS).retire('sharks')).toMatchObject({ ok: true, fleet: { retired: true } });
    expect(retired.calls).toEqual([['retire_fleet', { p_workspace: WS, p_name: 'sharks' }]]);
    const restored = fakeRpc({ data: ROW });
    expect(await databaseFleets(restored.db, WS).restore('sharks')).toMatchObject({ ok: true, fleet: { retired: false } });
    expect(restored.calls).toEqual([['restore_fleet', { p_workspace: WS, p_name: 'sharks' }]]);
  });

  it('answers a refusal next to its field', async () => {
    const { db } = fakeRpc({ error: { code: '22023', hint: 'color', message: 'Colour: a hex colour, #rrggbb.' } });
    expect(await databaseFleets(db, WS).create(LOOK)).toEqual({ ok: false, refusal: { field: 'color', message: 'Colour: a hex colour, #rrggbb.' } });
  });

  it('answers a thrown call as the form\'s refusal, never throwing', async () => {
    const db = { rpc: async () => { throw new Error('fetch failed'); } };
    expect(await databaseFleets(db, WS).retire('sharks')).toMatchObject({ ok: false, refusal: { field: 'form' } });
  });
});

describe('the demo fleets', () => {
  const port = (): FleetsPort => demoFleetsPort([]);

  it('offers only mascots the sprite set draws', () => {
    for (const m of MASCOTS) expect(SPRITE_DEFS[m], m).toBeDefined();
  });

  it('makes a key from the label, numbered when taken', async () => {
    const p = port();
    expect(await p.create({ ...LOOK, label: 'C.I.A.' })).toMatchObject({ ok: true, fleet: { name: 'c-i-a' } });
    expect(await p.create({ ...LOOK, label: 'c i a' })).toMatchObject({ ok: true, fleet: { name: 'c-i-a-2' } });
  });

  it.each([
    [{ label: '' }, 'label'], [{ label: 'x'.repeat(13) }, 'label'], [{ color: 'red' }, 'color'],
    [{ motto: 'x'.repeat(61) }, 'motto'], [{ mascot: 'dragon' }, 'mascot'],
  ])('refuses %o at its field, as the database does', async (over, field) => {
    expect(await port().create({ ...LOOK, ...over })).toMatchObject({ ok: false, refusal: { field } });
  });

  it('refuses a 13th active fleet, and a restore past 12', async () => {
    const p = port();
    for (let i = 0; i < 12; i++) expect((await p.create({ ...LOOK, label: `F${i}` })).ok).toBe(true);
    expect(await p.create({ ...LOOK, label: 'F12' })).toMatchObject({ ok: false, refusal: { field: 'fleets' } });
    await p.retire('f0');
    expect((await p.create({ ...LOOK, label: 'F12' })).ok).toBe(true);
    expect(await p.restore('f0')).toMatchObject({ ok: false, refusal: { field: 'fleets' } });
  });

  it('keeps a fleet\'s name through an edit, and knows no fleet it never made', async () => {
    const p = port();
    await p.create(LOOK);
    expect(await p.update('sharks', { ...LOOK, label: 'JAWS' })).toMatchObject({ ok: true, fleet: { name: 'sharks', label: 'JAWS' } });
    expect(await p.retire('ghost')).toMatchObject({ ok: false, refusal: { field: 'form' } });
  });
});
