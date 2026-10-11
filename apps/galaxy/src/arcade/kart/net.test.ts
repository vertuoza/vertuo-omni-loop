import { describe, expect, it } from 'vitest';
import { presenceOf, readGrid, readPresence, type GridPlayer } from './net';

// The grid's Presence entry on the wire (PRD 1572, slice 3).

const hero = { v: 1, body: 'boy', skin: 1, hair: 2, suit: 3, cape: 0 } as const;
const player = (over: Partial<GridPlayer> = {}): GridPlayer => ({ id: 'u1', name: 'Ada', hero, fleet: 'Alpha', best: 653, arrival: 1000, ...over });

describe('a Presence entry', () => {
  it('reads back from what was sent', () => {
    expect(readPresence(presenceOf(player()))).toEqual(player());
    expect(readPresence(presenceOf(player({ fleet: null, best: null })))).toEqual(player({ fleet: null, best: null }));
  });

  it('reads past the key Supabase adds', () => {
    expect(readPresence({ ...presenceOf(player()), presence_ref: 'x' })).toEqual(player());
  });

  it('reads as nothing when a field is missing or wrong', () => {
    const sent = presenceOf(player());
    for (const key of Object.keys(sent)) {
      const { [key]: _gone, ...without } = sent;
      expect(readPresence(without), `without ${key}`).toBeNull();
    }
    const wrong: Record<string, unknown> = { id: 7, name: '', hero: 'x', fleet: 3, best: 0, arrival: 'now' };
    for (const [key, value] of Object.entries(wrong)) expect(readPresence({ ...sent, [key]: value }), `wrong ${key}`).toBeNull();
    expect(readPresence({ ...sent, best: 6.5 })).toBeNull();
    expect(readPresence({ ...sent, name: 'x'.repeat(65) })).toBeNull();
    expect(readPresence({ ...sent, hero: { ...hero, body: 'cat' } })).toBeNull();
    expect(readPresence(null)).toBeNull();
    expect(readPresence('u1')).toBeNull();
  });
});

describe('everyone Presence holds', () => {
  it('reads each key\'s player and leaves out what does not read, or names another player than its key', () => {
    const entries = { u1: presenceOf(player()), u2: presenceOf(player({ id: 'u2' })), u3: { id: 'u3' }, u4: presenceOf(player({ id: 'u9' })) };
    expect(readGrid(entries).map((p) => p.id)).toEqual(['u1', 'u2']);
    expect(readGrid({})).toEqual([]);
  });
});
