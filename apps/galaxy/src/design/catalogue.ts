// What the /design page shows, read straight from @omni/design: nothing here draws or names a
// colour of its own, so a piece the package gains appears on the page without an edit here.
import {
  HERO_PRESETS, INK, LOGO_DRAWINGS, OMNI_POSES, SPRITE_DEFS, TYPE_SCALE, contrast, heroLook,
  type Hero, type LogoDrawing, type Tint, type TypeStep, type TypeStepName,
} from '@omni/design';
import { DEMO_PROJECTS } from '@omni/galaxy';

/** The whole-number scales every logo form is shown at. */
export const LOGO_SCALES = [1, 2, 4] as const;
/** The scale the OmniMan poses are drawn at: a poster scale (1 to POSTER_MAX_SCALE) that still fits a phone. */
export const POSTER_SCALE = 8;
/** A sprite's frames: every sprite has two. */
export const FRAMES = [0, 1] as const;

/** How a logo drawing is shown: the crest on the dark ground and on a light one, the one-colour variant on a light one. */
export const LOGO_SHOWINGS = [
  { ground: 'dark', ink: 'colour' },
  { ground: 'light', ink: 'colour' },
  { ground: 'light', ink: 'mono' },
] as const;

export const LOGO_NOTES: Record<LogoDrawing, string> = {
  full: 'OMNI LOOP, the wordmark. Every O is the loop arrow.',
  lockup: 'A big O leading MNI LOOP.',
  mark: 'The O alone: the loop arrow.',
  favicon: 'The mark, redrawn on its own 16×16 grid, never shrunk.',
};
export const LOGOS: readonly LogoDrawing[] = LOGO_DRAWINGS;

/** Every INK colour, with its contrast on the void (the arcade's ground) and on white. */
export const COLOURS = Object.entries(INK).map(([name, hex]) => ({
  name, hex, onVoid: contrast(hex, INK.void), onWhite: contrast(hex, INK.white),
}));

export const ratio = (n: number) => `${n.toFixed(1)}:1`;

export const TYPE_STEPS = (Object.entries(TYPE_SCALE) as [TypeStepName, TypeStep][]).map(([name, step]) => ({ name, ...step }));

/** The icons: the 16×16 sprites, and the cursor. */
export const ICONS = Object.keys(SPRITE_DEFS).filter((name) => SPRITE_DEFS[name].w <= 16);
/** The cast: every other sprite (OmniMan and his poses, the heroes, the fleet mascots, Entropy). */
export const CAST = Object.keys(SPRITE_DEFS).filter((name) => !ICONS.includes(name));

export const POSES = OMNI_POSES;

/** The fleets the game ships with (the demo and the seed migration), in their order. */
export const FLEETS = Object.entries(DEMO_PROJECTS.teams)
  .map(([name, f]) => ({ name, label: f.label ?? name.toUpperCase(), color: f.color ?? INK.white, sort: f.sort ?? 0 }))
  .sort((a, b) => a.sort - b.sort);

const RED_CAPE = HERO_PRESETS.cape.findIndex(([label]) => label === 'RED');

/** A hero of each body in a fleet's colours: the FLEET suit (preset 0), a red cape. */
export function fleetHero(body: Hero['body'], color: string): { sprite: string; tint: Tint } {
  return heroLook({ v: 1, body, skin: 1, hair: 0, suit: 0, cape: RED_CAPE }, color);
}
