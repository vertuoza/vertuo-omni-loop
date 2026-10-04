// A player's hero: the OMNI-MAN body (hero-girl / hero-boy in sprites.mjs), recoloured. Every choice
// in the builder is a ramp swap on one material, so no combination needs new art. A hero is stored
// as preset numbers, `{ v: 1, body, skin, hair, suit, cape }`; public.valid_hero() checks the same
// ranges in the database (supabase/migrations/*_fleets_and_players.sql).
import type { Tint } from './forge.ts';
import { SPRITE_DEFS } from './sprites.ts';
import { at, defined } from 'vertuo-omni-plan/kit/lib/narrow.ts';

/** A stored hero: preset numbers into HERO_PRESETS, the body a girl's or a boy's. */
export interface Hero { v: 1; body: 'girl' | 'boy'; skin: number; hair: number; suit: number; cape: number }
/** OmniMan's poses a hero can strike. */
export type OmniPose = 'omni-point' | 'omni-cheer' | 'omni-run';
/** The sprite and the tint that draw a hero or a fleet. */
export interface Look { sprite: string; tint: Tint }

// ── Ramps from one colour ───────────────────────────────────────────────────

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = (max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60;
  }
  return [h, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l));
  const k = (n: number): number => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n: number): number => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return '#' + [f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
}

// Shifts a hue toward a target by at most `max` degrees, the short way round.
const toward = (h: number, target: number, max: number): number => { const d = ((target - h + 540) % 360) - 180; return h + Math.max(-max, Math.min(max, d)); };

const ramps = new Map<string, readonly string[]>();
/** A 4-tone ramp (light, base, shade, dark) from one hex, shadows leaning blue-violet like the forge's own. */
export function rampFrom(hex: string): readonly string[] {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error(`rampFrom: ${hex} is not a #rrggbb colour`);
  const key = hex.toLowerCase();
  const hit = ramps.get(key);
  if (hit) return hit;
  const [h, s, l] = hexToHsl(key);
  const shade = Math.min(l, Math.max(0.07, l - 0.16)), dark = Math.min(shade, Math.max(0.04, l - 0.31));
  const ramp = Object.freeze([
    hslToHex(toward(h, 60, 8), s * 0.9, Math.max(l, Math.min(0.94, l + 0.2))),
    key,
    hslToHex(toward(h, 250, 12), Math.min(1, s * 1.05), shade),
    hslToHex(toward(h, 250, 22), Math.min(1, s * 1.1), dark),
  ]);
  ramps.set(key, ramp);
  return ramp;
}

const darker = (hex: string): string => { const [h, s, l] = hexToHsl(hex); return hslToHex(h, s, l * 0.7); };

// ── Presets ─────────────────────────────────────────────────────────────────

/** A preset that may recolour: its label, and its colour (`null` keeps the sprite's own). */
type Swatch = readonly [string, string | null];

export const HERO_PRESETS: {
  readonly body: readonly (readonly ['girl' | 'boy', string])[];
  readonly skin: readonly string[];
  readonly hair: readonly Swatch[];
  readonly suit: readonly (readonly [string, string | null, string | null])[];
  readonly cape: readonly Swatch[];
} = Object.freeze({
  body: Object.freeze<(readonly ['girl' | 'boy', string])[]>([['girl', 'GIRL'], ['boy', 'BOY']]),
  skin: Object.freeze(['#fbd9bc', '#f5c19a', '#dfa377', '#b97c52', '#8c5a3a', '#5f3b27']),
  hair: Object.freeze<Swatch[]>([
    ['BLACK', null], ['BROWN', '#6b4226'], ['AUBURN', '#8e3b2a'], ['BLONDE', '#e8c15a'],
    ['GINGER', '#e0782c'], ['SILVER', '#c9cbd6'], ['BLUE', '#4a7dff'], ['PINK', '#ff7ab8'],
  ]),
  // [label, main, trim]. FLEET takes the fleet's colour; OMNI is the commander's own navy and white.
  suit: Object.freeze<(readonly [string, string | null, string | null])[]>([
    ['FLEET', null, null], ['OMNI', null, null], ['CRIMSON', '#ff5a6e', '#5a0f2a'], ['EMERALD', '#4ee08a', '#0e4a30'],
    ['GOLD', '#ffd84a', '#2a2436'], ['VIOLET', '#b07cff', '#2a1860'], ['BLACK', '#4d5374', '#141627'], ['ORANGE', '#ff9b30', '#3a1e10'],
  ]),
  cape: Object.freeze<Swatch[]>([
    ['NONE', null], ['RED', '#ff3b5c'], ['PLASMA', '#a45cff'], ['GOLD', '#ffd84a'], ['NAVY', '#3346cc'],
    ['EMERALD', '#1d9f5a'], ['BLACK', '#33384f'], ['WHITE', '#e4e8ff'], ['TEAL', '#2fc6a4'],
  ]),
});

const COUNT = { skin: HERO_PRESETS.skin.length, hair: HERO_PRESETS.hair.length, suit: HERO_PRESETS.suit.length, cape: HERO_PRESETS.cape.length };
const inRange = (v: unknown, n: number): boolean => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < n;

/** True for a stored hero the presets can draw; the database's valid_hero() agrees. */
export function validHero(h: unknown): h is Hero {
  if (!h || typeof h !== 'object') return false;
  return 'v' in h && h.v === 1 && 'body' in h && (h.body === 'girl' || h.body === 'boy')
    && 'skin' in h && inRange(h.skin, COUNT.skin) && 'hair' in h && inRange(h.hair, COUNT.hair)
    && 'suit' in h && inRange(h.suit, COUNT.suit) && 'cape' in h && inRange(h.cape, COUNT.cape);
}

/** A random look, with the suit in the fleet colour (the builder's starting point). `rand` returns [0, 1). */
export function randomHero(rand: () => number = Math.random, { suit = 0 }: { suit?: number } = {}): Hero {
  const pick = (n: number): number => Math.floor(rand() * n);
  return { v: 1, body: pick(2) ? 'boy' : 'girl', skin: pick(COUNT.skin), hair: pick(COUNT.hair), suit, cape: 1 + pick(COUNT.cape - 1) };
}

const looks = new Map<string, Look>();
/**
 * The sprite and tint that draw a hero, the fleet colour going to the FLEET suit and the belt buckle.
 */
export function heroLook(hero: Hero, fleetColor = '#2f3fc4'): Look {
  const key = `${hero.body}|${hero.skin}|${hero.hair}|${hero.suit}|${hero.cape}|${fleetColor}`;
  const hit = looks.get(key);
  if (hit) return hit;
  const tint: Tint = { Y: rampFrom(fleetColor) };
  if (hero.skin !== 1) tint.S = rampFrom(at(HERO_PRESETS.skin, hero.skin, `skin preset ${hero.skin}`));
  const hair = at(HERO_PRESETS.hair, hero.hair, `hair preset ${hero.hair}`)[1];
  if (hair) tint.H = rampFrom(hair);
  const [suit, main, trim] = at(HERO_PRESETS.suit, hero.suit, `suit preset ${hero.suit}`);
  if (suit === 'FLEET') tint.W = rampFrom(fleetColor);
  else if (suit !== 'OMNI') {
    const colour = defined(main, `the colour of suit ${suit}`), edge = defined(trim, `the trim of suit ${suit}`);
    tint.W = rampFrom(colour); tint.N = rampFrom(edge); tint.n = rampFrom(darker(edge));
  }
  const cape = at(HERO_PRESETS.cape, hero.cape, `cape preset ${hero.cape}`)[1];
  if (cape) tint.P = rampFrom(cape);
  const look = Object.freeze({ sprite: `hero-${hero.body}${cape ? '' : '-nc'}`, tint: Object.freeze(tint) });
  looks.set(key, look);
  return look;
}

/** OmniMan's poses (sprites.mjs), each drawn bare and with a cape (`<pose>-cape`). */
export const OMNI_POSES: readonly OmniPose[] = Object.freeze(['omni-point', 'omni-cheer', 'omni-run']);

/**
 * A hero in one of OmniMan's poses: the pose's sprite, caped when the hero wears a cape, and the
 * hero's own tint (heroLook), so skin, hair, suit, cape and the fleet's buckle apply as on the idle body.
 */
export function heroPose(hero: Hero, pose: OmniPose, fleetColor = '#2f3fc4'): Look {
  if (!OMNI_POSES.includes(pose)) throw new Error(`heroPose: ${pose} is not one of ${OMNI_POSES.join(', ')}`);
  const { tint } = heroLook(hero, fleetColor);
  return { sprite: at(HERO_PRESETS.cape, hero.cape, `cape preset ${hero.cape}`)[1] ? `${pose}-cape` : pose, tint };
}

/**
 * How a fleet is drawn: its mascot when the sprite exists, else a caped hero in the fleet's colour,
 * so a fleet added by a migration plays before anyone draws it a mascot.
 */
export function fleetSprite(mascot: string | null | undefined, color: string | null | undefined): { sprite: string; tint: Tint | null } {
  if (mascot && SPRITE_DEFS[mascot]) return { sprite: mascot, tint: null };
  return heroLook({ v: 1, body: 'boy', skin: 1, hair: 0, suit: 0, cape: 1 }, typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color) ? color : '#cfd4e6');
}

