import { describe, expect, it } from 'vitest';
import { carried, presenceOf, rateFor, readGrid, readMessage, readPresence, type GridPlayer } from './net';
import { RULES } from './rules';

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
      const without = Object.fromEntries(Object.entries(sent).filter(([name]) => name !== key));
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

// The race's messages (PRD 1572, slice 4).

const state = { kind: 'state', race: 'r1', x: 10, y: 20, angle: 1.5, speed: 60, steer: 1, laps: 1, passed: 3, spin: 0, fall: 0 } as const;
const start = { kind: 'start', race: 'r1', seed: 42, order: [presenceOf(player({ id: 'a' })), presenceOf(player({ id: 'b' }))] };

describe('the race\'s messages', () => {
  it('reads each one back from what was sent', () => {
    expect(readMessage(state)).toEqual(state);
    expect(readMessage({ kind: 'leave', race: 'r1' })).toEqual({ kind: 'leave', race: 'r1' });
    const read = readMessage(start);
    expect(read?.kind).toBe('start');
    expect(read?.kind === 'start' ? read.order.map((p) => p.id) : []).toEqual(['a', 'b']);
  });

  it('reads a message with a missing or wrong field as nothing', () => {
    for (const key of Object.keys(state)) {
      expect(readMessage(Object.fromEntries(Object.entries(state).filter(([name]) => name !== key))), `without ${key}`).toBeNull();
    }
    expect(readMessage({ ...state, x: 'far' })).toBeNull();
    expect(readMessage({ ...state, speed: Number.POSITIVE_INFINITY })).toBeNull();
    expect(readMessage({ ...state, steer: 2 })).toBeNull();
    expect(readMessage({ ...state, laps: 4 })).toBeNull();
    expect(readMessage({ ...state, fall: -1 })).toBeNull();
    expect(readMessage({ kind: 'nope', race: 'r1' })).toBeNull();
    expect(readMessage(null)).toBeNull();
    expect(readMessage('state')).toBeNull();
  });

  it('refuses a start with one player, with more than the places, or with a player twice', () => {
    expect(readMessage({ ...start, order: start.order.slice(0, 1) })).toBeNull();
    expect(readMessage({ ...start, order: [...start.order, ...start.order] })).toBeNull();
    const five = ['a', 'b', 'c', 'd', 'e'].map((id) => presenceOf(player({ id })));
    expect(readMessage({ ...start, order: five })).toBeNull();
    expect(readMessage({ ...start, order: [...start.order.slice(0, 1), { id: 'b' }] })).toBeNull();
  });

  it('ignores a message that is from another race', () => {
    expect(readMessage(state, 'r1')).toEqual(state);
    expect(readMessage(state, 'r2')).toBeNull();
    expect(readMessage({ kind: 'leave', race: 'r1' }, 'r2')).toBeNull();
  });
});

describe('the send rate', () => {
  it('is 10 a second at two players, 8 at three and 5 at four', () => {
    expect([2, 3, 4].map(rateFor)).toEqual([10, 8, 5]);
  });

  it('keeps n² × rate inside the budget for every number of players, from 1 to the places', () => {
    for (let n = 1; n <= RULES.places; n += 1) expect(n * n * rateFor(n), `${n} players`).toBeLessThanOrEqual(RULES.messageBudget);
  });
});

describe('a remote kart between two states', () => {
  const kart = { x: 100, y: 50, angle: 0, speed: 40, steer: 0 } as const;

  it('is carried forward along its speed and heading', () => {
    expect(carried(kart, 0.25)).toEqual({ ...kart, x: 110, y: 50 });
    const north = carried({ ...kart, angle: Math.PI / 2 }, 0.25);
    expect(north.x).toBeCloseTo(100);
    expect(north.y).toBeCloseTo(60);
  });

  it('is never carried more than half a second', () => {
    expect(carried(kart, 0.5)).toEqual(carried(kart, 3));
    expect(carried(kart, 3).x).toBeCloseTo(100 + 40 * RULES.carry);
    expect(carried(kart, -1)).toEqual(kart);
  });
});

describe('the finish message (PRD 1572, slice 5)', () => {
  it('reads back what was sent: the race and the time in tenths', () => {
    expect(readMessage({ kind: 'finish', race: 'r', tenths: 1234 })).toEqual({ kind: 'finish', race: 'r', tenths: 1234 });
  });

  it('reads as nothing with a time that is missing, not whole or not positive, and for another race', () => {
    for (const tenths of [undefined, 0, -3, 12.5, '1234']) expect(readMessage({ kind: 'finish', race: 'r', tenths })).toBeNull();
    expect(readMessage({ kind: 'finish', tenths: 10 })).toBeNull();
    expect(readMessage({ kind: 'finish', race: 'other', tenths: 10 }, 'r')).toBeNull();
    expect(readMessage({ kind: 'finish', race: 'r', tenths: 10 }, 'r')).not.toBeNull();
  });
});

describe('the item and hit messages (PRD 1572, slice 6)', () => {
  const item = { kind: 'item', race: 'r', id: 'u1:3', item: 'orb', x: 10, y: 20, angle: 1.5 } as const;

  it('read back what was sent: the item with its id, where it starts and the way it flies, and the hit with the id it takes off', () => {
    expect(readMessage(item)).toEqual(item);
    expect(readMessage({ ...item, item: 'blob' })).toEqual({ ...item, item: 'blob' });
    expect(readMessage({ kind: 'hit', race: 'r', id: 'u1:3' })).toEqual({ kind: 'hit', race: 'r', id: 'u1:3' });
  });

  it('read as nothing with a field missing or wrong, a BOOST (it is never sent), or from another race', () => {
    for (const key of ['race', 'id', 'item', 'x', 'y', 'angle']) expect(readMessage(Object.fromEntries(Object.entries(item).filter(([k]) => k !== key))), `without ${key}`).toBeNull();
    expect(readMessage({ ...item, item: 'boost' })).toBeNull();
    expect(readMessage({ ...item, x: 'far' })).toBeNull();
    expect(readMessage({ kind: 'hit', race: 'r' })).toBeNull();
    expect(readMessage({ kind: 'hit', race: 'r', id: '' })).toBeNull();
    expect(readMessage(item, 'other')).toBeNull();
    expect(readMessage({ kind: 'hit', race: 'other', id: 'u1:3' }, 'r')).toBeNull();
  });
});
