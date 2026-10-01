// @ts-nocheck
// The four font roles, their faces, and the type scale. The woff2 files sit in ../fonts, each under
// the SIL Open Font License that sits beside it, cut to the latin and latin-ext subsets; fonts.css
// declares them, and names the type scale as :root custom properties. Change a face or a step here,
// then run `pnpm --filter @omni/design fonts`: fonts.test.mjs fails while the committed fonts.css
// differs from what this writes.

/** The two subsets every face ships, as the unicode ranges fonts.css gives them. */
export const SUBSETS = Object.freeze({
  latin:
    'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
  'latin-ext':
    'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF',
});

/**
 * The five faces: each one's family, the slug its files and licence are named by, its role, the
 * weights and styles it ships, and the stack a page names it by (the fallbacks keep its width,
 * so a panel does not overflow before the face loads).
 */
export const FACES = Object.freeze([
  {
    family: 'Anton', slug: 'anton', role: 'display',
    cuts: [{ weight: 400, style: 'normal' }],
    stack: "'Anton', Impact, 'Haettenschweiler', 'Arial Narrow Bold', 'Arial Narrow', sans-serif",
  },
  {
    family: 'Press Start 2P', slug: 'press-start-2p', role: 'pixel',
    cuts: [{ weight: 400, style: 'normal' }],
    stack: "'Press Start 2P', 'Courier New', monospace",
  },
  {
    family: 'Jersey 10', slug: 'jersey-10', role: 'pixel',
    cuts: [{ weight: 400, style: 'normal' }],
    stack: "'Jersey 10', 'Arial Narrow', 'Roboto Condensed', 'Liberation Sans Narrow', 'Helvetica Neue', Arial, sans-serif",
  },
  {
    family: 'Atkinson Hyperlegible Next', slug: 'atkinson-hyperlegible-next', role: 'body',
    cuts: [{ weight: 400, style: 'normal' }, { weight: 700, style: 'normal' }, { weight: 400, style: 'italic' }],
    stack: "'Atkinson Hyperlegible Next', 'Atkinson Hyperlegible', system-ui, -apple-system, 'Segoe UI', sans-serif",
  },
  {
    family: 'JetBrains Mono', slug: 'jetbrains-mono', role: 'mono',
    cuts: [{ weight: 400, style: 'normal' }, { weight: 600, style: 'normal' }],
    stack: "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
  },
].map((face) => Object.freeze({ ...face, cuts: Object.freeze(face.cuts.map(Object.freeze)) })));

/** Each role and the families it draws with: the pixel role's first face labels, its second reads. */
export const ROLES = Object.freeze(Object.fromEntries(
  ['display', 'pixel', 'body', 'mono'].map((role) => [
    role,
    Object.freeze(FACES.filter((f) => f.role === role).map((f) => f.family)),
  ]),
));

const step = (role, face, size, lineHeight, slant = 0) => Object.freeze({ role, face, size, lineHeight, slant });

/**
 * The type scale: each step's role, face, size in CSS pixels, line height (unitless) and slant in
 * degrees of forward lean. The display role leans 12°; nothing else leans.
 */
export const TYPE_SCALE = Object.freeze({
  'display-xl': step('display', 'Anton', 96, 0.9, 12),
  'display-l': step('display', 'Anton', 72, 0.9, 12),
  'display-m': step('display', 'Anton', 48, 0.95, 12),
  'display-s': step('display', 'Anton', 32, 1, 12),
  'pixel-l': step('pixel', 'Press Start 2P', 16, 1.25),
  'pixel-m': step('pixel', 'Press Start 2P', 8, 1.5),
  'pixel-s': step('pixel', 'Jersey 10', 20, 1.05),
  'body-l': step('body', 'Atkinson Hyperlegible Next', 20, 1.5),
  'body-m': step('body', 'Atkinson Hyperlegible Next', 17, 1.6),
  'body-s': step('body', 'Atkinson Hyperlegible Next', 14, 1.5),
  mono: step('mono', 'JetBrains Mono', 15, 1.5),
});

/** Every woff2 file the package ships: one per face, cut and subset. */
export function fontFiles() {
  return FACES.flatMap((face) => face.cuts.flatMap(({ weight, style }) =>
    Object.entries(SUBSETS).map(([subset, unicodeRange]) => ({
      family: face.family,
      role: face.role,
      weight,
      style,
      subset,
      unicodeRange,
      file: `${face.slug}-${subset}-${weight}-${style}.woff2`,
    }))));
}

/** The @font-face rules for `files`, each src written by `url(file name)`. */
export function fontFaceCss(files, url = (file) => `./fonts/${file}`) {
  return files.map((f) => [
    '@font-face {',
    `  font-family: '${f.family}';`,
    `  font-style: ${f.style};`,
    `  font-weight: ${f.weight};`,
    '  font-display: swap;',
    `  src: url('${url(f.file)}') format('woff2');`,
    `  unicode-range: ${f.unicodeRange};`,
    '}',
    '',
  ].join('\n')).join('');
}

const stackOf = (family) => FACES.find((f) => f.family === family).stack;

/** fonts.css: every face, then each role's stack and each type-scale step as :root custom properties. */
export function fontsCss() {
  const roles = Object.entries(ROLES).map(([role, faces]) => `  --font-${role}: ${stackOf(faces[0])};`);
  const steps = Object.entries(TYPE_SCALE).flatMap(([name, s]) => [
    `  --type-${name}-family: ${stackOf(s.face)};`,
    `  --type-${name}-size: ${s.size}px;`,
    `  --type-${name}-line: ${s.lineHeight};`,
    // As a skewX() angle: a forward lean is a negative skew.
    `  --type-${name}-slant: ${s.slant ? -s.slant : 0}deg;`,
  ]);
  return [
    '/* Generated by packages/design/src/fonts.ts (pnpm --filter @omni/design fonts). Do not edit. */',
    '',
    fontFaceCss(fontFiles()),
    ':root {',
    ...roles,
    ...steps,
    '}',
    '',
  ].join('\n');
}
