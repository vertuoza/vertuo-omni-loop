// A player's hero: the OMNI-MAN body (hero-girl / hero-boy in sprites.mjs), recoloured. Every choice
// in the builder is a ramp swap on one material, so no combination needs new art. A hero is stored
// as preset numbers, `{ v: 1, body, skin, hair, suit, cape }`; public.valid_hero() checks the same
// ranges in the database (supabase/migrations/*_fleets_and_players.sql).
import { SPRITE_DEFS } from './sprites.mjs';

// ── Ramps from one colour ───────────────────────────────────────────────────

function hexToHsl(hex) {
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

function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l));
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return '#' + [f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
}

// Shifts a hue toward a target by at most `max` degrees, the short way round.
const toward = (h, target, max) => { const d = ((target - h + 540) % 360) - 180; return h + Math.max(-max, Math.min(max, d)); };

const ramps = new Map();
/** A 4-tone ramp (light, base, shade, dark) from one hex, shadows leaning blue-violet like the forge's own. */
export function rampFrom(hex) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error(`rampFrom: ${hex} is not a #rrggbb colour`);
  const key = hex.toLowerCase();
  if (ramps.has(key)) return ramps.get(key);
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

const darker = (hex) => { const [h, s, l] = hexToHsl(hex); return hslToHex(h, s, l * 0.7); };

// ── Presets ─────────────────────────────────────────────────────────────────

export const HERO_PRESETS = Object.freeze({
  body: Object.freeze([['girl', 'GIRL'], ['boy', 'BOY']]),
  skin: Object.freeze(['#fbd9bc', '#f5c19a', '#dfa377', '#b97c52', '#8c5a3a', '#5f3b27']),
  hair: Object.freeze([
    ['BLACK', null], ['BROWN', '#6b4226'], ['AUBURN', '#8e3b2a'], ['BLONDE', '#e8c15a'],
    ['GINGER', '#e0782c'], ['SILVER', '#c9cbd6'], ['BLUE', '#4a7dff'], ['PINK', '#ff7ab8'],
  ]),
  // [label, main, trim]. FLEET takes the fleet's colour; OMNI is the commander's own navy and white.
  suit: Object.freeze([
    ['FLEET', null, null], ['OMNI', null, null], ['CRIMSON', '#ff5a6e', '#5a0f2a'], ['EMERALD', '#4ee08a', '#0e4a30'],
    ['GOLD', '#ffd84a', '#2a2436'], ['VIOLET', '#b07cff', '#2a1860'], ['BLACK', '#4d5374', '#141627'], ['ORANGE', '#ff9b30', '#3a1e10'],
  ]),
  cape: Object.freeze([
    ['NONE', null], ['RED', '#ff3b5c'], ['PLASMA', '#a45cff'], ['GOLD', '#ffd84a'], ['NAVY', '#3346cc'],
    ['EMERALD', '#1d9f5a'], ['BLACK', '#33384f'], ['WHITE', '#e4e8ff'], ['TEAL', '#2fc6a4'],
  ]),
});

const COUNT = { skin: HERO_PRESETS.skin.length, hair: HERO_PRESETS.hair.length, suit: HERO_PRESETS.suit.length, cape: HERO_PRESETS.cape.length };
const inRange = (v, n) => Number.isInteger(v) && v >= 0 && v < n;

/** True for a stored hero the presets can draw; the database's valid_hero() agrees. */
export function validHero(h) {
  return Boolean(h) && typeof h === 'object' && h.v === 1 && (h.body === 'girl' || h.body === 'boy')
    && inRange(h.skin, COUNT.skin) && inRange(h.hair, COUNT.hair) && inRange(h.suit, COUNT.suit) && inRange(h.cape, COUNT.cape);
}

/** A random look, with the suit in the fleet colour (the builder's starting point). `rand` returns [0, 1). */
export function randomHero(rand = Math.random, { suit = 0 } = {}) {
  const pick = (n) => Math.floor(rand() * n);
  return { v: 1, body: pick(2) ? 'boy' : 'girl', skin: pick(COUNT.skin), hair: pick(COUNT.hair), suit, cape: 1 + pick(COUNT.cape - 1) };
}

const looks = new Map();
/**
 * The sprite and tint that draw a hero, the fleet colour going to the FLEET suit and the belt buckle.
 * @returns {{ sprite: string, tint: Record<string, readonly string[]> }}
 */
export function heroLook(hero, fleetColor = '#2f3fc4') {
  const key = `${hero.body}|${hero.skin}|${hero.hair}|${hero.suit}|${hero.cape}|${fleetColor}`;
  if (looks.has(key)) return looks.get(key);
  const tint = { Y: rampFrom(fleetColor) };
  if (hero.skin !== 1) tint.S = rampFrom(HERO_PRESETS.skin[hero.skin]);
  const hair = HERO_PRESETS.hair[hero.hair][1];
  if (hair) tint.H = rampFrom(hair);
  const [suit, main, trim] = HERO_PRESETS.suit[hero.suit];
  if (suit === 'FLEET') tint.W = rampFrom(fleetColor);
  else if (suit !== 'OMNI') { tint.W = rampFrom(main); tint.N = rampFrom(trim); tint.n = rampFrom(darker(trim)); }
  const cape = HERO_PRESETS.cape[hero.cape][1];
  if (cape) tint.P = rampFrom(cape);
  const look = Object.freeze({ sprite: `hero-${hero.body}${cape ? '' : '-nc'}`, tint: Object.freeze(tint) });
  looks.set(key, look);
  return look;
}

/**
 * How a fleet is drawn: its mascot when the sprite exists, else a caped hero in the fleet's colour,
 * so a fleet added by a migration plays before anyone draws it a mascot.
 */
export function fleetSprite(mascot, color) {
  if (mascot && SPRITE_DEFS[mascot]) return { sprite: mascot, tint: null };
  return heroLook({ v: 1, body: 'boy', skin: 1, hair: 0, suit: 0, cape: 1 }, /^#[0-9a-f]{6}$/i.test(color ?? '') ? color : '#cfd4e6');
}

