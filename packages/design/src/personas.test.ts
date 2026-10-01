import { describe, it, expect } from 'vitest';
import {
  PERSONA_TRADES, PERSONA_AVATAR_RANGES, PERSONA_PRESETS, PERSONA_VARIATIONS,
  personaGrid, randomAvatar, personaVariations, validPersonaAvatar,
} from './personas.ts';
import type { PersonaAvatar, PersonaTrade } from './personas.ts';

const TRADES: PersonaTrade[] = [
  'builder', 'plumber', 'heating', 'electrician', 'carpenter', 'roofer', 'painter', 'foreman',
  'office', 'accountant', 'doctor', 'nurse', 'shopkeeper', 'driver', 'developer',
];

const every = (): PersonaAvatar[] => {
  const r = PERSONA_AVATAR_RANGES, out: PersonaAvatar[] = [];
  for (let skin = r.skin.min; skin <= r.skin.max; skin++) for (let hair = r.hair.min; hair <= r.hair.max; hair++)
    for (let hairColor = r.hairColor.min; hairColor <= r.hairColor.max; hairColor++)
      for (let outfit = r.outfit.min; outfit <= r.outfit.max; outfit++)
        for (let accessory = r.accessory.min; accessory <= r.accessory.max; accessory++)
          out.push({ v: 1, skin, hair, hairColor, outfit, accessory });
  return out;
};

const key = (g: { pixels: (string | null)[] }): string => g.pixels.map((p) => p ?? '-').join('');

describe('persona trades', () => {
  it('has the fifteen trades of the spec, each a short lower-case word with a label', () => {
    expect(PERSONA_TRADES.map((t) => t.id)).toEqual(TRADES);
    for (const { id, label } of PERSONA_TRADES) {
      expect(id).toMatch(/^[a-z]{1,16}$/);
      expect(label.length).toBeGreaterThan(0);
    }
    expect(PERSONA_TRADES.find((t) => t.id === 'heating')!.label).toBe('Heating engineer');
    expect(PERSONA_TRADES.find((t) => t.id === 'foreman')!.label).toBe('Site foreman');
    expect(PERSONA_TRADES.find((t) => t.id === 'office')!.label).toBe('Office manager');
  });
});

describe('persona avatar ranges', () => {
  it("equal the database's valid_persona_avatar(): skin 0–5, hair 0–5, hairColor 0–3, outfit 0–3, accessory 0–3, v 1", () => {
    expect(PERSONA_AVATAR_RANGES).toEqual({
      v: 1,
      skin: { min: 0, max: 5 },
      hair: { min: 0, max: 5 },
      hairColor: { min: 0, max: 3 },
      outfit: { min: 0, max: 3 },
      accessory: { min: 0, max: 3 },
    });
  });

  it('has a preset for every value of every range, and the accessories none, cap, glasses, helmet', () => {
    const r = PERSONA_AVATAR_RANGES;
    expect(PERSONA_PRESETS.skin).toHaveLength(r.skin.max + 1);
    expect(PERSONA_PRESETS.hair).toHaveLength(r.hair.max + 1);
    expect(PERSONA_PRESETS.hairColor).toHaveLength(r.hairColor.max + 1);
    expect(PERSONA_PRESETS.accessory).toEqual(['none', 'cap', 'glasses', 'helmet']);
    for (const t of TRADES) expect(PERSONA_PRESETS.outfit[t]).toHaveLength(r.outfit.max + 1);
    expect(PERSONA_VARIATIONS).toBe(6 * 6 * 4 * 4 * 4);
  });

  it('validPersonaAvatar accepts every avatar in range and refuses anything else', () => {
    for (const a of every()) expect(validPersonaAvatar(a)).toBe(true);
    const ok = { v: 1, skin: 0, hair: 0, hairColor: 0, outfit: 0, accessory: 0 };
    for (const bad of [
      null, 'x', {}, { ...ok, v: 2 }, { ...ok, skin: 6 }, { ...ok, hair: -1 }, { ...ok, hairColor: 4 },
      { ...ok, outfit: 1.5 }, { ...ok, accessory: 4 }, { ...ok, skin: '1' },
    ]) expect(validPersonaAvatar(bad)).toBe(false);
  });
});

describe('personaGrid', () => {
  it('draws every trade at every accessory: a 32×32 portrait of real colours', () => {
    for (const trade of TRADES) for (let accessory = 0; accessory <= 3; accessory++) {
      const g = personaGrid(trade, { v: 1, skin: 2, hair: 1, hairColor: 1, outfit: 2, accessory });
      expect([g.w, g.h]).toEqual([32, 32]);
      expect(g.pixels).toHaveLength(32 * 32);
      expect(g.pixels.filter(Boolean).length).toBeGreaterThan(32 * 32 * 0.3);
      for (const p of g.pixels) if (p) expect(p).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('gives each trade a body of its own', () => {
    const a: PersonaAvatar = { v: 1, skin: 1, hair: 0, hairColor: 0, outfit: 0, accessory: 0 };
    expect(new Set(TRADES.map((t) => key(personaGrid(t, a)))).size).toBe(TRADES.length);
  });

  it('always gives the same grid for the same trade and avatar', () => {
    const a: PersonaAvatar = { v: 1, skin: 4, hair: 3, hairColor: 2, outfit: 1, accessory: 2 };
    for (const t of TRADES) expect(key(personaGrid(t, { ...a }))).toBe(key(personaGrid(t, { ...a })));
  });

  it('gives two different avatars two different grids', () => {
    for (const trade of ['builder', 'doctor', 'developer']) {
      const seen = new Map<string, string>();
      for (const a of every()) {
        const k = key(personaGrid(trade, a));
        expect(seen.get(k), `${trade} ${JSON.stringify(a)} = ${seen.get(k)}`).toBeUndefined();
        seen.set(k, JSON.stringify(a));
      }
      expect(seen.size).toBe(PERSONA_VARIATIONS);
    }
  });

  it('refuses an unknown trade and an avatar out of range', () => {
    const a: PersonaAvatar = { v: 1, skin: 0, hair: 0, hairColor: 0, outfit: 0, accessory: 0 };
    expect(() => personaGrid('astronaut', a)).toThrow(/astronaut/);
    expect(() => personaGrid('builder', { ...a, skin: 9 })).toThrow(/avatar/);
  });
});

describe('randomAvatar', () => {
  it('is deterministic for a seed, number or text, and always in range', () => {
    for (const seed of [0, 1, 42, 2 ** 31, 'plumber', 'a persona']) {
      expect(randomAvatar(seed)).toEqual(randomAvatar(seed));
      expect(validPersonaAvatar(randomAvatar(seed))).toBe(true);
    }
    for (let seed = 0; seed < 2000; seed++) expect(validPersonaAvatar(randomAvatar(seed))).toBe(true);
  });

  it('spreads over the variations', () => {
    const seen = new Set(Array.from({ length: 200 }, (_, s) => JSON.stringify(randomAvatar(s))));
    expect(seen.size).toBeGreaterThan(150);
  });
});

describe('personaVariations', () => {
  it('gives 24 distinct avatars in range, the same for the same seed and page', () => {
    const page = personaVariations(7);
    expect(page).toHaveLength(24);
    expect(new Set(page.map((a) => JSON.stringify(a))).size).toBe(24);
    for (const a of page) expect(validPersonaAvatar(a)).toBe(true);
    expect(personaVariations(7)).toEqual(page);
  });

  it('gives 24 others on the next page (Shuffle), never repeating one', () => {
    const seen = new Set();
    for (let p = 0; p < PERSONA_VARIATIONS / 24; p++) {
      for (const a of personaVariations(7, p)) {
        const k = JSON.stringify(a);
        expect(seen.has(k)).toBe(false);
        seen.add(k);
      }
    }
    expect(seen.size).toBe(PERSONA_VARIATIONS);
    expect(personaVariations(7, PERSONA_VARIATIONS / 24)).toEqual(personaVariations(7, 0));
  });

  it('starts somewhere else for another seed', () => {
    expect(personaVariations(1)).not.toEqual(personaVariations(2));
  });
});
