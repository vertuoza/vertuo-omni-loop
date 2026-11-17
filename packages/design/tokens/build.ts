// The token generator: reads the W3C DTCG 2025.10 files beside it (*.tokens.json), checks every token
// and alias, and writes ../tokens.css and ../src/tokens.generated.ts from them. The files are the one
// source of every token: palette.tokens.json the named colours, scale.tokens.json the space, radius,
// type, weight, elevation and motion families, <theme>.tokens.json each theme's semantic roles and
// <theme>.anti.tokens.json the roles the anti-loop mode remaps. Change a file, then run
// `pnpm --filter @omni/design tokens`: build.test.ts fails while a committed output differs.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tokensCss, type TokenSet } from '../src/tokens.ts';

const DIR = new URL('./', import.meta.url);
const THEMES = ['omni', 'light', 'dark'] as const;
const REQUIRED = ['palette.tokens.json', 'scale.tokens.json', ...THEMES.map((theme) => `${theme}.tokens.json`)];
const KNOWN: ReadonlySet<string> = new Set([...REQUIRED, ...THEMES.map((theme) => `${theme}.anti.tokens.json`)]);
const PROPERTIES: ReadonlySet<string> = new Set(['$type', '$value', '$description', '$extensions', '$deprecated']);
const NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const ALIAS = /^\{([^{}]+)\}$/;
const ROLE = 'color.';

/** A token as read from a file: its path, its declared or inherited type, its raw value, and its file. */
interface Raw { readonly path: string; readonly type: TokenType | null; readonly value: unknown; readonly file: string }
/** A token resolved: its type, and its value as CSS. */
interface Resolved { readonly type: TokenType; readonly css: string }

type Json = Readonly<Record<string, unknown>>;
const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const inUnit = (n: number): boolean => n >= 0 && n <= 1;

/** Throws `message` unless `ok`. */
function check(ok: boolean, message: string): asserts ok {
  if (!ok) throw new Error(message);
}

const byte = (hex: string, i: number): number => parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16);

/** A DTCG colour's parts, checked: sRGB, three components from 0 to 1, a #rrggbb hex. */
function srgb(value: unknown, where: string): { components: number[]; hex: string; alpha: unknown } {
  if (!isObject(value) || !Array.isArray(value.components) || typeof value.hex !== 'string') throw new Error(`${where}: not a color value`);
  check(value.colorSpace === 'srgb', `${where}: a colour is srgb, with its hex beside its components`);
  const listed: readonly unknown[] = value.components;
  const components = listed.filter(isNumber).filter(inUnit);
  check(/^#[0-9a-f]{6}$/.test(value.hex) && listed.length === 3 && components.length === 3, `${where}: not a color value`);
  return { components, hex: value.hex, alpha: value.alpha ?? 1 };
}

/** A DTCG colour as CSS: its hex, or rgb() with its alpha when it is see-through. */
function colourCss(value: unknown, where: string): string {
  const { components, hex, alpha } = srgb(value, where);
  check(components.every((c, i) => Math.abs(c * 255 - byte(hex, i)) <= 0.5), `${where}: the hex ${hex} is not its components`);
  if (!isNumber(alpha) || !inUnit(alpha)) throw new Error(`${where}: not a color value`);
  return alpha === 1 ? hex : `rgb(${[0, 1, 2].map((i) => String(byte(hex, i))).join(' ')} / ${String(alpha)})`;
}

/** A DTCG value with a number and a unit as CSS, the unit one of `units`. */
function measureCss(value: unknown, units: readonly string[], type: string, where: string): string {
  if (!isObject(value) || !isNumber(value.value) || typeof value.unit !== 'string' || !units.includes(value.unit)) {
    throw new Error(`${where}: not a ${type} value`);
  }
  return `${String(value.value)}${value.unit}`;
}

const LENGTHS = ['px', 'rem'] as const;

function fontWeightCss(value: unknown, where: string): string {
  check(isNumber(value) && Number.isInteger(value) && value >= 1 && value <= 1000, `${where}: not a fontWeight value`);
  return String(value);
}

function cubicBezierCss(value: unknown, where: string): string {
  const listed: readonly unknown[] = Array.isArray(value) ? value : [];
  const points = listed.filter(isNumber);
  const [x1 = -1, , x2 = -1] = points;
  check(listed.length === 4 && points.length === 4 && inUnit(x1) && inUnit(x2), `${where}: not a cubicBezier value`);
  return `cubic-bezier(${points.map(String).join(', ')})`;
}

/** A shadow, one layer or several; `colour` resolves each layer's colour, which may be an alias. */
function shadowCss(value: unknown, where: string, colour: (value: unknown) => string): string {
  const layers: readonly unknown[] = Array.isArray(value) ? value : [value];
  return layers.map((layer) => {
    if (!isObject(layer)) throw new Error(`${where}: not a shadow value`);
    const dims = (['offsetX', 'offsetY', 'blur', 'spread'] as const).map((key) => measureCss(layer[key], LENGTHS, 'shadow', where));
    return `${layer.inset === true ? 'inset ' : ''}${dims.join(' ')} ${colour(layer.color)}`;
  }).join(', ');
}

type Writer = (value: unknown, where: string, colour: (value: unknown) => string) => string;
/** The writer of each type the generator knows: a literal value as CSS. */
const WRITERS = {
  color: (value, where) => colourCss(value, where),
  dimension: (value, where) => measureCss(value, LENGTHS, 'dimension', where),
  duration: (value, where) => measureCss(value, ['ms', 's'], 'duration', where),
  number: (value, where) => {
    check(isNumber(value), `${where}: not a number value`);
    return String(value);
  },
  fontWeight: fontWeightCss,
  cubicBezier: cubicBezierCss,
  shadow: shadowCss,
} satisfies Record<string, Writer>;
type TokenType = keyof typeof WRITERS;
const isType = (value: unknown): value is TokenType => typeof value === 'string' && Object.hasOwn(WRITERS, value);

/** A group's or a token's type: its own `$type`, else the one it inherits. Refuses a property DTCG lacks. */
function typeOf(node: Json, inherited: TokenType | null, where: string): TokenType | null {
  for (const key of Object.keys(node)) check(!key.startsWith('$') || PROPERTIES.has(key), `${where}: ${key} is not a DTCG property`);
  const declared = node.$type;
  if (declared === undefined) return inherited;
  if (!isType(declared)) throw new Error(`${where}: $type ${JSON.stringify(declared)} is not one the generator writes`);
  return declared;
}

/** Every token of one file, its groups walked depth first, each type inherited from the nearest group. */
function tokensOf(file: string, json: unknown): Raw[] {
  const walk = (node: unknown, path: readonly string[], inherited: TokenType | null): Raw[] => {
    const where = `${file}: ${path.join('.') || '(root)'}`;
    if (!isObject(node)) throw new Error(`${where}: a group or a token is an object`);
    const type = typeOf(node, inherited, where);
    const children = Object.entries(node).filter(([key]) => !key.startsWith('$'));
    if (!('$value' in node)) {
      return children.flatMap(([key, child]) => {
        check(NAME.test(key), `${file}: ${[...path, key].join('.')}: a name is lowercase words joined by hyphens`);
        return walk(child, [...path, key], type);
      });
    }
    check(children.length === 0, `${where}: a token holds no tokens (${children.map(([key]) => key).join(', ')})`);
    return [{ path: path.join('.'), type, value: node.$value, file }];
  };
  return walk(json, [], null);
}

/** Every token of `raws` resolved, each alias followed to its token (whose type must match). */
function resolve(raws: readonly Raw[]): Map<string, Resolved> {
  const byPath = new Map(raws.map((raw) => [raw.path, raw]));
  const done = new Map<string, Resolved>();
  const visit = (raw: Raw, trail: readonly string[]): Resolved => {
    const known = done.get(raw.path);
    if (known) return known;
    const where = `${raw.file}: ${raw.path}`;
    check(!trail.includes(raw.path), `${where}: an alias cycle (${[...trail, raw.path].join(' → ')})`);
    const aliased = (value: unknown, expected: TokenType | null): Resolved | null => {
      const target = typeof value === 'string' ? ALIAS.exec(value)?.[1] : undefined;
      if (target === undefined) return null;
      const to = byPath.get(target);
      if (!to) throw new Error(`${where}: {${target}} names no token`);
      const found = visit(to, [...trail, raw.path]);
      check(!expected || found.type === expected, `${where}: {${target}} is a ${found.type}, not a ${String(expected)}`);
      return found;
    };
    const literal = (): Resolved => {
      if (!raw.type) throw new Error(`${where}: no $type, on the token or a group above it`);
      const colour = (value: unknown) => aliased(value, 'color')?.css ?? colourCss(value, where);
      return { type: raw.type, css: WRITERS[raw.type](raw.value, where, colour) };
    };
    const resolved = aliased(raw.value, raw.type) ?? literal();
    done.set(raw.path, resolved);
    return resolved;
  };
  for (const raw of raws) visit(raw, []);
  return done;
}

/** The CSS of every token of `raws` whose path starts with `prefix`, by its name after the prefix. */
function cssOf(resolved: ReadonlyMap<string, Resolved>, raws: readonly Raw[], prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const { path } of raws) {
    const name = path.slice(prefix.length).replaceAll('.', '-');
    check(!(name in out), `${path}: two tokens are both --${name}`);
    out[name] = resolved.get(path)?.css ?? '';
  }
  return out;
}

/** The tokens of a theme's file, each a role in its color group. */
function rolesIn(name: string, files: Readonly<Record<string, unknown>>): Raw[] {
  const raws = name in files ? tokensOf(name, files[name]) : [];
  for (const raw of raws) check(raw.path.startsWith(ROLE), `${name}: ${raw.path}: a role sits in the color group`);
  return raws;
}

/** One theme's roles, and the roles its anti-loop file remaps, each resolved over `base`. */
function themeOf(theme: string, base: readonly Raw[], files: Readonly<Record<string, unknown>>): { roles: Record<string, string>; anti: Record<string, string> } {
  const roles = rolesIn(`${theme}.tokens.json`, files);
  const overrides = rolesIn(`${theme}.anti.tokens.json`, files);
  const over = new Set(overrides.map((raw) => raw.path));
  for (const path of over) {
    check(roles.some((raw) => raw.path === path), `${theme}.anti.tokens.json: ${path.slice(ROLE.length)} is no role of the theme`);
  }
  return {
    roles: cssOf(resolve([...base, ...roles]), roles, ROLE),
    anti: cssOf(resolve([...base, ...roles.filter((raw) => !over.has(raw.path)), ...overrides]), overrides, ROLE),
  };
}

/** Refuses a theme that misses a role another theme has. */
function checkSameRoles(themes: Readonly<Record<string, Readonly<Record<string, string>>>>): void {
  for (const [theme, roles] of Object.entries(themes)) {
    for (const [other, its] of Object.entries(themes)) {
      const missing = Object.keys(its).find((role) => !(role in roles));
      check(missing === undefined, `${theme}.tokens.json misses the role ${String(missing)}, which ${other}.tokens.json has`);
    }
  }
}

/** The token set the files hold, keyed by file name: every file read, checked and resolved. */
export function resolveTokens(files: Readonly<Record<string, unknown>>): TokenSet {
  for (const name of Object.keys(files)) check(KNOWN.has(name), `${name} is no file the generator knows`);
  for (const name of REQUIRED) check(name in files, `${name} is missing`);
  const palette = tokensOf('palette.tokens.json', files['palette.tokens.json']);
  const scale = tokensOf('scale.tokens.json', files['scale.tokens.json']);
  const base = [...palette, ...scale];
  const resolved = resolve(base);
  const omni = themeOf('omni', base, files), light = themeOf('light', base, files), dark = themeOf('dark', base, files);
  const themes = { omni: omni.roles, light: light.roles, dark: dark.roles };
  checkSameRoles(themes);
  return { colours: cssOf(resolved, palette), scale: cssOf(resolved, scale), themes, anti: { omni: omni.anti, light: light.anti, dark: dark.anti } };
}

/** Every *.tokens.json file of the folder, parsed, by its name. */
export function readTokenFiles(dir: URL = DIR): Record<string, unknown> {
  return Object.fromEntries(readdirSync(dir).filter((name) => name.endsWith('.tokens.json')).sort()
    .map((name) => [name, JSON.parse(readFileSync(new URL(name, dir), 'utf8')) as unknown]));
}

/** The token set of the folder's files. */
export function readTokens(dir: URL = DIR): TokenSet {
  return resolveTokens(readTokenFiles(dir));
}

const key = (name: string): string => (/^[a-z_$][\w$]*$/i.test(name) ? name : `'${name}'`);
const record = (values: Readonly<Record<string, string>>, indent: string): string =>
  Object.entries(values).map(([name, value]) => `${indent}${key(name)}: '${value}',`).join('\n');
const byTheme = (values: Readonly<Record<string, Readonly<Record<string, string>>>>): string =>
  Object.entries(values).map(([theme, roles]) => `  ${theme}: Object.freeze({\n${record(roles, '    ')}\n  }),`).join('\n');

/** src/tokens.generated.ts, as the generator writes it: the set as frozen, literally typed objects. */
export function generatedModule(set: TokenSet): string {
  return [
    '// Generated from packages/design/tokens/*.tokens.json by tokens/build.ts: do not edit. Change a token',
    '// there and run `pnpm --filter @omni/design tokens`.',
    '',
    '/** The named colours (palette.tokens.json), by their CSS name. */',
    `export const TOKEN_COLOURS = Object.freeze({\n${record(set.colours, '  ')}\n} as const);`,
    '',
    '/** The scale (scale.tokens.json): space, radius, type, weight, elevation and motion, by their CSS name. */',
    `export const TOKEN_SCALE = Object.freeze({\n${record(set.scale, '  ')}\n} as const);`,
    '',
    '/** Each theme\'s semantic roles (<theme>.tokens.json), by their name: `--color-<role>` in CSS. */',
    `export const TOKEN_THEMES = Object.freeze({\n${byTheme(set.themes)}\n} as const);`,
    '',
    '/** The roles the anti-loop mode remaps in each theme (<theme>.anti.tokens.json). */',
    `export const TOKEN_THEMES_ANTI = Object.freeze({\n${byTheme(set.anti)}\n} as const);`,
    '',
  ].join('\n');
}

/** Writes tokens.css and src/tokens.generated.ts from the folder's files. */
export function writeTokens(dir: URL = DIR): void {
  const set = readTokens(dir);
  writeFileSync(new URL('../tokens.css', dir), tokensCss(set));
  writeFileSync(new URL('../src/tokens.generated.ts', dir), generatedModule(set));
}
