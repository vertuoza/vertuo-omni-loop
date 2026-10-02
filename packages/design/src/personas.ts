// Personas: the customers a team pictures, drawn as 32×32 arcade portraits. Each trade has one
// bust with its own prop, and every variation is a ramp swap or a small overlay on it — skin, hair
// style, hair colour, outfit colour and an accessory — so no variation needs new art. An avatar is
// stored as `{ v: 1, skin, hair, hairColor, outfit, accessory }` beside the trade;
// public.valid_persona_avatar() checks the same ranges in the database.
import { forge } from './forge.ts';
import type { Painter, Pixels } from './forge.ts';
import { rampFrom } from './heroes.ts';

export type PersonaTrade =
  | 'builder' | 'plumber' | 'heating' | 'electrician' | 'carpenter' | 'roofer' | 'painter' | 'foreman'
  | 'office' | 'accountant' | 'doctor' | 'nurse' | 'shopkeeper' | 'driver' | 'developer';

/** A stored persona avatar: preset numbers into its trade's sprite variations. */
export interface PersonaAvatar { v: 1; skin: number; hair: number; hairColor: number; outfit: number; accessory: number }

/** An inclusive range of preset numbers. */
interface Range { readonly min: number; readonly max: number }
type Field = 'skin' | 'hair' | 'hairColor' | 'outfit' | 'accessory';
type Paint = (d: Painter) => void;

// ── Trades ──────────────────────────────────────────────────────────────────

const TRADE_LABELS: [PersonaTrade, string][] = [
  ['builder', 'Builder'], ['plumber', 'Plumber'], ['heating', 'Heating engineer'], ['electrician', 'Electrician'],
  ['carpenter', 'Carpenter'], ['roofer', 'Roofer'], ['painter', 'Painter'], ['foreman', 'Site foreman'],
  ['office', 'Office manager'], ['accountant', 'Accountant'], ['doctor', 'Doctor'], ['nurse', 'Nurse'],
  ['shopkeeper', 'Shopkeeper'], ['driver', 'Driver'], ['developer', 'Developer'],
];
/** The generic trade list, the same for every workspace. An id is a short lower-case word. */
export const PERSONA_TRADES: readonly { readonly id: PersonaTrade; readonly label: string }[] = Object.freeze(
  TRADE_LABELS.map(([id, label]) => Object.freeze({ id, label })),
);

// ── Ranges and presets ──────────────────────────────────────────────────────

/** The stored avatar's ranges, inclusive; the database's valid_persona_avatar() checks the same. */
export const PERSONA_AVATAR_RANGES: {
  readonly v: 1; readonly skin: Range; readonly hair: Range; readonly hairColor: Range; readonly outfit: Range; readonly accessory: Range;
} = Object.freeze({
  v: 1,
  skin: Object.freeze({ min: 0, max: 5 }),
  hair: Object.freeze({ min: 0, max: 5 }),
  hairColor: Object.freeze({ min: 0, max: 3 }),
  outfit: Object.freeze({ min: 0, max: 3 }),
  accessory: Object.freeze({ min: 0, max: 3 }),
});

const FIELDS: readonly Field[] = Object.freeze<Field[]>(['skin', 'hair', 'hairColor', 'outfit', 'accessory']);
const SIZE: Readonly<Record<string, number>> = Object.fromEntries(FIELDS.map((f) => [f, PERSONA_AVATAR_RANGES[f].max - PERSONA_AVATAR_RANGES[f].min + 1]));

/** How many avatars one trade can draw. */
export const PERSONA_VARIATIONS: number = FIELDS.reduce((n, f) => n * SIZE[f]!, 1);

export const PERSONA_PRESETS: {
  readonly skin: readonly string[];
  readonly hair: readonly string[];
  readonly hairColor: readonly string[];
  readonly accessory: readonly ['none', 'cap', 'glasses', 'helmet'];
  readonly outfit: Readonly<Record<PersonaTrade, readonly string[]>>;
} = Object.freeze({
  skin: Object.freeze(['#fbd9bc', '#f5c19a', '#dfa377', '#b97c52', '#8c5a3a', '#5f3b27']),
  hair: Object.freeze(['short', 'side part', 'long', 'bun', 'curly', 'buzz and beard']),
  hairColor: Object.freeze(['#2a2436', '#6b4226', '#e8c15a', '#c9cbd6']),
  accessory: Object.freeze<['none', 'cap', 'glasses', 'helmet']>(['none', 'cap', 'glasses', 'helmet']),
  // Four outfit colours per trade, the first its usual one.
  outfit: Object.freeze({
    builder: Object.freeze(['#ff9b30', '#ffd84a', '#9be04e', '#ff5a6e']),
    plumber: Object.freeze(['#3346cc', '#2fc6a4', '#ff5a6e', '#4d5374']),
    heating: Object.freeze(['#c81e44', '#3346cc', '#4d5374', '#ff9b30']),
    electrician: Object.freeze(['#ffd84a', '#3346cc', '#4d5374', '#2fc6a4']),
    carpenter: Object.freeze(['#a8642e', '#1d9f5a', '#3346cc', '#7a4318']),
    roofer: Object.freeze(['#4d5374', '#c81e44', '#3346cc', '#1d9f5a']),
    painter: Object.freeze(['#e4e8ff', '#98b0f4', '#ffd0ec', '#b3bbe6']),
    foreman: Object.freeze(['#9be04e', '#ff9b30', '#ffd84a', '#ff5a6e']),
    office: Object.freeze(['#b07cff', '#3346cc', '#2fc6a4', '#ff8fd0']),
    accountant: Object.freeze(['#4d5374', '#22309a', '#5e3417', '#1d9f5a']),
    doctor: Object.freeze(['#eef2ff', '#98b0f4', '#b8ffd0', '#dcdee8']),
    nurse: Object.freeze(['#2fc6a4', '#5a6cf0', '#ff8fd0', '#9b5de5']),
    shopkeeper: Object.freeze(['#1d9f5a', '#c81e44', '#3346cc', '#dc9c16']),
    driver: Object.freeze(['#22309a', '#4d5374', '#c81e44', '#178a80']),
    developer: Object.freeze(['#4d5374', '#9b5de5', '#2fc6a4', '#ff5a6e']),
  }),
});

const inRange = (v: unknown, { min, max }: Range): boolean => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

/** True for a stored avatar the presets can draw; the database's valid_persona_avatar() agrees. */
export function validPersonaAvatar(a: unknown): a is PersonaAvatar {
  if (!a || typeof a !== 'object') return false;
  const field = (name: string): unknown => Reflect.get(a, name);
  return field('v') === PERSONA_AVATAR_RANGES.v
    && FIELDS.every((f) => inRange(field(f), PERSONA_AVATAR_RANGES[f]));
}

// ── Seeds ───────────────────────────────────────────────────────────────────

function seed32(seed: number | string): number {
  let x: number;
  if (typeof seed === 'string') {
    x = 0x811c9dc5;
    for (let i = 0; i < seed.length; i++) x = Math.imul(x ^ seed.charCodeAt(i), 0x01000193);
  } else x = Math.floor(Number(seed) || 0);
  x >>>= 0;
  x ^= x >>> 16; x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15; x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
}

function avatarAt(index: number): PersonaAvatar {
  // Every field is set below, in FIELDS order: the keys keep the order they always had.
  const a: PersonaAvatar = { v: 1, skin: 0, hair: 0, hairColor: 0, outfit: 0, accessory: 0 };
  let n = index;
  for (const f of FIELDS) { a[f] = PERSONA_AVATAR_RANGES[f].min + (n % SIZE[f]!); n = Math.floor(n / SIZE[f]!); }
  return a;
}

/** One avatar picked by a seed (a number or a text): the same seed always gives the same avatar. */
export function randomAvatar(seed: number | string): PersonaAvatar {
  return avatarAt(seed32(seed) % PERSONA_VARIATIONS);
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

/**
 * A page of `count` distinct avatars, in an order the seed shuffles: page 0 is what the portrait
 * picker shows first, each next page (Shuffle) shows others, and the pages cycle once every
 * avatar has been shown.
 */
export function personaVariations(seed: number | string, page = 0, count = 24): PersonaAvatar[] {
  const n = PERSONA_VARIATIONS, s = seed32(seed);
  let step = (s % n) | 1;
  while (gcd(step, n) !== 1) step += 2;
  const start = seed32(s ^ 0x9e3779b9) % n;
  const pages = Math.ceil(n / count), p = ((Math.floor(page) % pages) + pages) % pages;
  const out: PersonaAvatar[] = [];
  for (let i = p * count; i < Math.min(n, (p + 1) * count); i++) out.push(avatarAt((start + i * step) % n));
  return out;
}

// ── Drawing ─────────────────────────────────────────────────────────────────
// Materials (forge.mjs): S skin, H hair, W the outfit, N its trim (both from the outfit colour),
// F a white shirt, the rest the props'. Every trade draws its bust, then its prop; the head, the
// hair and the accessory are shared.

const darker = (hex: string, k = 0.62): string => '#' + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * k).toString(16).padStart(2, '0')).join('');

function shoulders(d: Painter): void {
  d.poly([[2, 32], [4, 25], [9, 21.5], [23, 21.5], [28, 25], [30, 32]], 'W');
}

function neck(d: Painter): void {
  d.rect(13, 17, 6, 5, 'S');
}

const BUSTS: Readonly<Record<string, Paint>> = {
  tee(d) { shoulders(d); neck(d); d.poly([[12, 21.5], [20, 21.5], [16, 24]], 'S'); d.rect(11, 21, 10, 1, 'N'); },
  vest(d) {
    d.poly([[2, 32], [4, 25], [9, 21.5], [23, 21.5], [28, 25], [30, 32]], 'A');
    d.poly([[5, 32], [7, 24], [11, 21.5], [14, 21.5], [14, 32]], 'W').poly([[18, 21.5], [21, 21.5], [25, 24], [27, 32], [18, 32]], 'W');
    d.rect(5, 27, 9, 1, 'L', 0).rect(18, 27, 9, 1, 'L', 0);
    neck(d);
  },
  overalls(d) {
    d.poly([[2, 32], [4, 25], [9, 21.5], [23, 21.5], [28, 25], [30, 32]], 'F');
    d.rect(10, 25, 12, 7, 'W').rect(10, 21, 2, 4, 'N').rect(20, 21, 2, 4, 'N');
    d.px(11, 25, 'Y').px(20, 25, 'Y');
    neck(d);
  },
  shirt(d) {
    shoulders(d); neck(d);
    d.poly([[12, 21.5], [20, 21.5], [18, 32], [14, 32]], 'F');
    d.poly([[15, 23], [17, 23], [17.5, 30], [16, 32], [14.5, 30]], 'N');
    d.px(12, 21, 'F').px(19, 21, 'F');
  },
  coat(d) {
    d.poly([[2, 32], [4, 25], [9, 21.5], [23, 21.5], [28, 25], [30, 32]], 'F');
    d.poly([[12, 21.5], [20, 21.5], [18, 32], [14, 32]], 'W');
    d.line(12, 22, 14, 32, 'k').line(20, 22, 18, 32, 'k');
    neck(d);
  },
  scrubs(d) { shoulders(d); neck(d); d.poly([[12, 21.5], [20, 21.5], [16, 26]], 'S'); d.rect(20, 27, 4, 3, 'N'); },
  apron(d) {
    shoulders(d); neck(d);
    d.rect(10, 24, 12, 8, 'F').rect(12, 21, 1, 3, 'F').rect(19, 21, 1, 3, 'F');
    d.rect(14, 28, 4, 2, 'F', 2);
  },
  hoodie(d) {
    shoulders(d);
    d.ellipse(16, 22, 8, 3, 'N');
    neck(d);
    d.line(14, 23, 13, 29, 'F').line(18, 23, 19, 29, 'F');
    d.rect(11, 28, 10, 4, 'N');
  },
};

const TRADES: Readonly<Record<string, { bust: string; prop: Paint }>> = {
  builder: { bust: 'vest', prop(d) { d.rect(1, 26, 7, 5, 'R').rect(1, 28, 7, 1, 'L', 1).px(4, 26, 'L', 1).px(4, 27, 'L', 1).px(2, 29, 'L', 1).px(2, 30, 'L', 1); } },
  plumber: { bust: 'overalls', prop(d) { d.line(24, 31, 29, 23, 'L', 2).rect(27, 20, 4, 3, 'L').clear(28, 20).clear(29, 20); } },
  heating: { bust: 'overalls', prop(d) {
    d.poly([[25, 31], [23, 27], [25, 23], [26, 26], [28, 21], [30, 26], [29, 31]], 'O');
    d.poly([[25.5, 31], [25, 28], [27, 25], [28.5, 28], [28, 31]], 'Y');
  } },
  electrician: { bust: 'tee', prop(d) {
    d.poly([[26, 19], [30, 19], [28, 24], [31, 24], [25, 32], [26.5, 26], [24, 26]], 'Y');
    d.line(3, 31, 6, 26, 'L').rect(6, 23, 2, 3, 'R');
  } },
  carpenter: { bust: 'overalls', prop(d) {
    d.poly([[22, 31], [31, 24], [31, 31]], 'L');
    d.pxs([[24, 30], [26, 29], [28, 28], [30, 27]], 'L', 3);
    d.rect(20, 29, 3, 3, 'T');
    d.line(7, 20, 9, 24, 'Y');
  } },
  roofer: { bust: 'tee', prop(d) {
    d.line(1, 32, 3, 18, 'T').line(6, 32, 8, 18, 'T');
    for (let y = 20; y < 32; y += 3) d.line(2, y + 0.5, 7, y, 'T');
  } },
  painter: { bust: 'overalls', prop(d) {
    d.rect(23, 20, 8, 4, 'C').rect(26, 24, 2, 3, 'L').rect(26, 27, 2, 5, 'D');
    d.px(12, 28, '1').px(18, 30, '3').px(20, 27, '4').px(14, 31, '2');
  } },
  foreman: { bust: 'vest', prop(d) {
    d.rect(22, 21, 9, 11, 'T').rect(23, 23, 7, 8, 'F').rect(25, 20, 3, 2, 'L');
    d.rect(24, 25, 5, 1, 'A', 2).rect(24, 27, 5, 1, 'A', 2).rect(24, 29, 3, 1, 'A', 2);
  } },
  office: { bust: 'shirt', prop(d) {
    d.rect(1, 23, 7, 9, 'Y').rect(2, 22, 3, 1, 'Y');
    d.rect(24, 22, 5, 9, 'A').rect(25, 23, 3, 6, 'E');
  } },
  accountant: { bust: 'shirt', prop(d) {
    d.rect(22, 21, 9, 11, 'A').rect(23, 22, 7, 3, 'g', 1);
    for (let y = 26; y < 31; y += 2) for (let x = 23; x < 30; x += 2) d.px(x, y, 'L', 0);
  } },
  doctor: { bust: 'coat', prop(d) {
    d.line(12, 21, 10, 27, 'A').line(20, 21, 22, 27, 'A').line(10, 27, 12, 29, 'A');
    d.ellipse(22.5, 28.5, 2, 2, 'L');
  } },
  nurse: { bust: 'scrubs', prop(d) {
    d.rect(7, 24, 5, 5, 'F').rect(9, 25, 1, 3, 'R', 1).rect(8, 26, 3, 1, 'R', 1);
    d.rect(25, 22, 2, 8, 'E').rect(24, 21, 4, 1, 'L').px(25, 30, 'L').px(26, 30, 'L');
  } },
  shopkeeper: { bust: 'apron', prop(d) {
    d.poly([[22, 24], [31, 24], [30, 32], [23, 32]], 'T');
    d.line(24, 24, 25, 20, 'D').line(29, 24, 28, 20, 'D').line(25, 20, 28, 20, 'D');
    d.rect(1, 22, 5, 4, 'Y').px(2, 23, 'X');
  } },
  driver: { bust: 'shirt', prop(d) {
    d.ellipse(24, 28, 7, 5, 'A').ellipse(24, 28, 5, 3.2, null);
    d.rect(23, 27, 3, 2, 'A').line(19, 28, 23, 28, 'A').line(26, 28, 29, 28, 'A');
    d.rect(3, 23, 3, 3, 'L').px(4, 26, 'L').px(4, 27, 'L');
  } },
  developer: { bust: 'hoodie', prop(d) {
    d.rect(19, 23, 12, 7, 'A').rect(20, 24, 10, 5, 'C', 3);
    d.rect(21, 25, 4, 1, 'g', 1).rect(22, 27, 5, 1, 'C', 1);
    d.rect(17, 30, 15, 2, 'L');
  } },
};

// The six hair styles. Each shows below a helmet's brim in its own way (the sideburns, the fall,
// the curls or the beard), so every style stays tellable under every accessory.
const HAIR: readonly Paint[] = [
  (d) => { d.ellipse(16, 6, 7, 3.6, 'H').rect(9, 6, 2, 5, 'H').rect(21, 6, 2, 5, 'H'); },
  (d) => { d.ellipse(15.5, 5.5, 7.5, 3.8, 'H').poly([[8.5, 4], [14, 2], [12, 8], [9, 9]], 'H').rect(9, 6, 2, 4, 'H').rect(21, 6, 1, 3, 'H'); },
  (d) => { d.ellipse(16, 6, 7.5, 4, 'H').rect(8, 6, 3, 14, 'H').rect(21, 6, 3, 14, 'H'); },
  (d) => { d.ellipse(16, 6, 7, 3.6, 'H').ellipse(16, 1.8, 3, 2, 'H').rect(9, 6, 2, 7, 'H').rect(21, 6, 2, 7, 'H'); },
  (d) => {
    d.ellipse(16, 5.5, 8, 4.2, 'H');
    const curls: [number, number][] = [[8.5, 8], [23.5, 8], [8, 11], [24, 11], [8.5, 14], [23.5, 14]];
    for (const [x, y] of curls) d.ellipse(x, y, 1.8, 1.8, 'H');
  },
  (d) => {
    d.ellipse(16, 5, 6.6, 2.6, 'H');
    d.poly([[9.5, 11], [12, 16], [16, 18.5], [20, 16], [22.5, 11], [22.5, 14], [20, 19], [12, 19], [9.5, 14]], 'H');
  },
];

function head(d: Painter, hair: number): void {
  d.ellipse(16, 11, 6.5, 7.5, 'S');
  d.px(9, 11, 'S', 2).px(22, 11, 'S', 2);
  HAIR[hair]!(d);
  d.rect(12, 9, 3, 1, 'H').rect(17, 9, 3, 1, 'H');
  d.px(13, 11, 'X').px(18, 11, 'X');
  d.px(15, 13, 'S', 2).px(16, 13, 'S', 2);
  d.rect(14, 15, 4, 1, 'S', 3);
}

const ACCESSORIES: readonly Paint[] = [
  () => {},
  (d) => { d.poly([[9, 8], [9.5, 4], [12, 2], [20, 2], [22.5, 4], [23, 8]], 'N').rect(9, 7, 16, 2, 'N', 2).px(16, 2, 'N', 0); },
  (d) => {
    d.rect(11, 10, 4, 3, 'E', 0).rect(17, 10, 4, 3, 'E', 0).rect(15, 10, 2, 1, 'X').px(10, 10, 'X').px(21, 10, 'X');
    d.px(13, 11, 'X').px(18, 11, 'X');
  },
  (d) => {
    d.poly([[8.5, 8], [9, 3.5], [12, 1], [20, 1], [23, 3.5], [23.5, 8]], 'Y');
    d.rect(7, 7, 18, 2, 'Y', 2).rect(15, 1, 2, 7, 'Y', 0);
  },
];

/**
 * A persona's portrait: a 32×32 grid of `#rrggbb` (null is empty), row by row. Pure and
 * deterministic: the same trade and avatar always give the same grid.
 */
export function personaGrid(trade: string, avatar: PersonaAvatar): Pixels {
  const def = TRADES[trade];
  if (!def) throw new Error(`personaGrid: ${trade} is not a persona trade`);
  if (!validPersonaAvatar(avatar)) throw new Error(`personaGrid: ${JSON.stringify(avatar)} is not a persona avatar`);
  const outfits: Readonly<Record<string, readonly string[]>> = PERSONA_PRESETS.outfit;
  const outfit = outfits[trade]![avatar.outfit]!;
  const tint = {
    S: rampFrom(PERSONA_PRESETS.skin[avatar.skin]!),
    H: rampFrom(PERSONA_PRESETS.hairColor[avatar.hairColor]!),
    W: rampFrom(outfit),
    N: rampFrom(darker(outfit)),
  };
  const grid = forge(32, 32, (d) => {
    BUSTS[def.bust]!(d);
    head(d, avatar.hair);
    ACCESSORIES[avatar.accessory]!(d);
    def.prop(d);
  }, { tint });
  return { w: grid.w, h: grid.h, pixels: grid.pixels };
}
