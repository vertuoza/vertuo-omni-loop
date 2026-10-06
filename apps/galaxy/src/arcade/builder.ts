// The hero builder's rows, as a pure step: ◀ ▶ cycle the value of a row, wrapping around.
import { HERO_PRESETS, type Hero } from '@omni/design';
import { at, defined, isOneOf, keysOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';

export const BUILDER_ROWS = ['BODY', 'SKIN', 'HAIR', 'SUIT', 'CAPE', 'RANDOM', 'DONE'] as const;
export type BuilderRow = (typeof BUILDER_ROWS)[number];

const KEY = { SKIN: 'skin', HAIR: 'hair', SUIT: 'suit', CAPE: 'cape' } as const;

export function cycleHero(hero: Hero, row: BuilderRow, dir: 1 | -1): Hero {
  if (row === 'BODY') return { ...hero, body: hero.body === 'girl' ? 'boy' : 'girl' };
  if (!isOneOf(keysOf(KEY), row)) return hero;
  const key = KEY[row];
  const n = HERO_PRESETS[key].length;
  return { ...hero, [key]: (hero[key] + dir + n) % n };
}

/** What a row shows: its label and the swatches of its value. */
export function rowValue(hero: Hero, row: BuilderRow, fleetColor: string): { label: string; swatches: string[] } {
  switch (row) {
    case 'BODY': return { label: hero.body.toUpperCase(), swatches: [] };
    case 'SKIN': return { label: `${hero.skin + 1} / ${HERO_PRESETS.skin.length}`, swatches: [at(HERO_PRESETS.skin, hero.skin, 'the skin swatch')] };
    case 'HAIR': { const [label, c] = at(HERO_PRESETS.hair, hero.hair, 'the hair swatch'); return { label, swatches: [c ?? '#2a2436'] }; }
    case 'SUIT': {
      const [label, main, trim] = at(HERO_PRESETS.suit, hero.suit, 'the suit');
      if (label === 'FLEET') return { label, swatches: [fleetColor] };
      if (label === 'OMNI') return { label, swatches: ['#e4e8ff', '#3346cc'] };
      return { label, swatches: [defined(main, `the ${label} suit's colour`), defined(trim, `the ${label} suit's trim`)] };
    }
    case 'CAPE': { const [label, c] = at(HERO_PRESETS.cape, hero.cape, 'the cape swatch'); return { label, swatches: c ? [c] : [] }; }
    case 'RANDOM': case 'DONE': return { label: row, swatches: [] };
  }
}
