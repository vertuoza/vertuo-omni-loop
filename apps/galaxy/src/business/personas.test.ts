import { describe, expect, it } from 'vitest';
import { PERSONA_TRADES, randomAvatar, validPersonaAvatar } from '@omni/design';
import {
  canUndo, initialPersonasState, personaOf, personasReducer, pickerOf, sameAvatar, UNDO_MS, viewPersonas,
  type Persona, type PersonasAction, type PersonasState,
} from './personas';
import { sure } from '../arcade/test/sure';

// Settings → Business → Personas' state (PRD 799 s3): add, edit, delete and Undo within 5 s, the
// drawer and its portrait picker, and each product's cast.

const AVATAR = { v: 1 as const, skin: 1, hair: 2, hairColor: 0, outfit: 1, accessory: 0 };
const persona = (n: number, over: Partial<Persona> = {}): Persona => ({
  id: `pe-${n}`, product: 'p-1', ordinal: n, name: `Person ${n}`, stance: 'neutral', trade: 'plumber', avatar: AVATAR, who: '', usage: '', ...over,
});

const after = (actions: PersonasAction[], start: PersonasState = initialPersonasState([persona(1), persona(2)])) => actions.reduce(personasReducer, start);

describe('a stored row', () => {
  it('reads as a persona, its ordinal a number and empty texts empty', () => {
    expect(personaOf({ id: 'x', product_id: 'p-1', ordinal: '7', name: 'Ann', stance: 'skeptical', trade: 'doctor', avatar: AVATAR, who: null, usage: 'Quotes' }))
      .toEqual({ id: 'x', product: 'p-1', ordinal: 7, name: 'Ann', stance: 'skeptical', trade: 'doctor', avatar: AVATAR, who: '', usage: 'Quotes' });
  });
});

describe('the cast of a tab', () => {
  const cast = [persona(3, { product: 'p-2' }), persona(1), persona(2, { product: 'p-2' })];
  it('is every persona, oldest first, with one product', () => {
    expect(viewPersonas(cast, [{ id: 'p-1', name: 'A' }], 'p-1').map((p) => p.id)).toEqual(['pe-1', 'pe-2', 'pe-3']);
  });
  it('is the product\'s own with two', () => {
    const two = [{ id: 'p-1', name: 'A' }, { id: 'p-2', name: 'B' }];
    expect(viewPersonas(cast, two, 'p-2').map((p) => p.id)).toEqual(['pe-2', 'pe-3']);
    expect(viewPersonas(cast, two, 'p-1').map((p) => p.id)).toEqual(['pe-1']);
  });
});

describe('adding', () => {
  it('opens a blank drawer for the product, on the avatar its seed picks', () => {
    const s = after([{ type: 'new', product: 'p-1', seed: 'a' }]);
    expect(s.drawer).toMatchObject({ editing: null, product: 'p-1', page: 0, fields: { name: '', stance: 'neutral', trade: sure(PERSONA_TRADES[0], 'PERSONA_TRADES[0]').id } });
    expect(sure(s.drawer, 's.drawer').fields.avatar).toEqual(randomAvatar('a'));
    expect(validPersonaAvatar(sure(s.drawer, 's.drawer').fields.avatar)).toBe(true);
  });

  it('starts on a random variation: two seeds, two avatars', () => {
    const a = sure(after([{ type: 'new', product: 'p-1', seed: 'a' }]).drawer, 'after([{ type: \'new\', product: \'p-1\', seed: \'a\' }]).drawer').fields.avatar;
    const b = sure(after([{ type: 'new', product: 'p-1', seed: 'b' }]).drawer, 'after([{ type: \'new\', product: \'p-1\', seed: \'b\' }]).drawer').fields.avatar;
    expect(sameAvatar(a, b)).toBe(false);
  });

  it('adds the saved persona to the cast, in its place, and closes the drawer', () => {
    const s = after([{ type: 'new', product: 'p-1', seed: 'a' }, { type: 'busy' }, { type: 'saved', persona: persona(3, { name: 'Marc' }) }]);
    expect(s.personas.map((p) => p.name)).toEqual(['Person 1', 'Person 2', 'Marc']);
    expect(s.drawer).toBeNull();
    expect(s.busy).toBe(false);
  });

  it('keeps the drawer open with the refusal', () => {
    const s = after([{ type: 'new', product: 'p-1', seed: 'a' }, { type: 'busy' }, { type: 'refused', message: 'No' }]);
    expect(s.drawer).not.toBeNull();
    expect(s.refusal).toBe('No');
    expect(s.busy).toBe(false);
  });
});

describe('the drawer', () => {
  it('changes its fields, and its trade', () => {
    const s = after([{ type: 'new', product: 'p-1', seed: 'a' }, { type: 'change', fields: { name: 'Marc', stance: 'skeptical', trade: 'plumber' } }]);
    expect(sure(s.drawer, 's.drawer').fields).toMatchObject({ name: 'Marc', stance: 'skeptical', trade: 'plumber' });
  });

  it('shows 24 variations, and Shuffle shows 24 others', () => {
    const open = after([{ type: 'new', product: 'p-1', seed: 'a' }]);
    const first = pickerOf(sure(open.drawer, 'open.drawer'));
    const next = pickerOf(sure(after([{ type: 'shuffle' }], open).drawer, 'after([{ type: \'shuffle\' }], open).drawer'));
    expect(first).toHaveLength(24);
    expect(next).toHaveLength(24);
    expect(next.some((a) => first.some((b) => sameAvatar(a, b)))).toBe(false);
  });

  it('closes on Cancel, forgetting the refusal', () => {
    const s = after([{ type: 'new', product: 'p-1', seed: 'a' }, { type: 'refused', message: 'No' }, { type: 'close' }]);
    expect(s.drawer).toBeNull();
    expect(s.refusal).toBeNull();
  });
});

describe('editing', () => {
  it('opens the drawer with the persona\'s own fields', () => {
    const s = after([{ type: 'edit', persona: 'pe-2', seed: 'e' }]);
    expect(s.drawer).toMatchObject({ editing: 'pe-2', product: 'p-1', fields: { name: 'Person 2', trade: 'plumber', avatar: AVATAR } });
  });

  it('changes the card in its place', () => {
    const s = after([{ type: 'edit', persona: 'pe-1', seed: 'e' }, { type: 'saved', persona: persona(1, { name: 'Renamed' }) }]);
    expect(s.personas.map((p) => p.name)).toEqual(['Renamed', 'Person 2']);
  });

  it('ignores a persona it does not hold', () => {
    expect(after([{ type: 'edit', persona: 'gone', seed: 'e' }]).drawer).toBeNull();
  });
});

describe('deleting', () => {
  const T = 1_000_000;

  it('removes the persona at once and offers Undo for 5 s', () => {
    const s = after([{ type: 'edit', persona: 'pe-1', seed: 'e' }, { type: 'deleted', persona: persona(1), at: T }]);
    expect(s.personas.map((p) => p.id)).toEqual(['pe-2']);
    expect(s.drawer).toBeNull();
    expect(s.undo).toEqual({ persona: persona(1), until: T + UNDO_MS });
    expect(canUndo(s, T + UNDO_MS - 1)).toBe(true);
    expect(canUndo(s, T + UNDO_MS)).toBe(false);
  });

  it('brings it back, in its place, with Undo within 5 s', () => {
    const deleted = after([{ type: 'deleted', persona: persona(1), at: T }]);
    const s = after([{ type: 'tick', at: T + 4000 }, { type: 'restored', persona: persona(1) }], deleted);
    expect(s.personas.map((p) => p.id)).toEqual(['pe-1', 'pe-2']);
    expect(s.undo).toBeNull();
  });

  it('lets Undo go once 5 s have passed', () => {
    const deleted = after([{ type: 'deleted', persona: persona(1), at: T }]);
    expect(after([{ type: 'tick', at: T + 4999 }], deleted).undo).not.toBeNull();
    expect(after([{ type: 'tick', at: T + UNDO_MS }], deleted).undo).toBeNull();
  });
});
