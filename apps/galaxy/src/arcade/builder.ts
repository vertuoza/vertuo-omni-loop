// The hero builder's rows, as a pure step: ◀ ▶ cycle the value of a row, wrapping around.
import { HERO_PRESETS, type Hero } from '@omni/design';

export const BUILDER_ROWS = ['BODY', 'SKIN', 'HAIR', 'SUIT', 'CAPE', 'RANDOM', 'DONE'] as const;
export type BuilderRow = (typeof BUILDER_ROWS)[number];

const KEY = { SKIN: 'skin', HAIR: 'hair', SUIT: 'suit', CAPE: 'cape' } as const;

export function cycleHero(hero: Hero, row: BuilderRow, dir: 1 | -1): Hero {
  if (row === 'BODY') return { ...hero, body: hero.body === 'girl' ? 'boy' : 'girl' };
  if (!(row in KEY)) return hero;
  const key = KEY[row as keyof typeof KEY]; // ts-allow: the line above checked that the row is one of KEY's
  const n = HERO_PRESETS[key].length;
  return { ...hero, [key]: (hero[key] + dir + n) % n };
}

/** What a row shows: its label and the swatches of its value. */
export function rowValue(hero: Hero, row: BuilderRow, fleetColor: string): { label: string; swatches: string[] } {
  switch (row) {
    case 'BODY': return { label: hero.body.toUpperCase(), swatches: [] };
    case 'SKIN': return { label: `${hero.skin + 1} / ${HERO_PRESETS.skin.length}`, swatches: [HERO_PRESETS.skin[hero.skin]!] };
    case 'HAIR': { const [label, c] = HERO_PRESETS.hair[hero.hair]!; return { label, swatches: [c ?? '#2a2436'] }; }
    case 'SUIT': {
      const [label, main, trim] = HERO_PRESETS.suit[hero.suit]!;
      if (label === 'FLEET') return { label, swatches: [fleetColor] };
      if (label === 'OMNI') return { label, swatches: ['#e4e8ff', '#3346cc'] };
      return { label, swatches: [main!, trim!] };
    }
    case 'CAPE': { const [label, c] = HERO_PRESETS.cape[hero.cape]!; return { label, swatches: c ? [c] : [] }; }
    default: return { label: row, swatches: [] };
  }
}
