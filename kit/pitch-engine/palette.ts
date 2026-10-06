// The engine's colours and fonts (PRD 1108 s4), from the product's look and nothing else: the kit
// carries no brand. Every colour a scene paints is one of the look's four tokens — the ground in
// `paper`, the words in `ink`, highlights in `accent`, the call to action in `cta` — or a mix or a
// shade of them.
import type { PitchLook } from '../lib/pitch/settings.ts';

type Rgb = readonly [number, number, number];

const channels = (hex: string): Rgb => {
  const value = Number.parseInt(hex.slice(1, 7), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

const hexOf = (rgb: Rgb): string => `#${rgb.map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`;

/** `from` mixed toward `to` by `t` (0 is `from`), as `#rrggbb`. */
export function mixColour(from: string, to: string, t: number): string {
  const [a, b] = [channels(from), channels(to)];
  return hexOf([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
}

/** `hex` at opacity `opacity`, as CSS `rgba()`. */
export function alpha(hex: string, opacity: number): string {
  const [r, g, b] = channels(hex);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/** WCAG's relative luminance of a colour. */
function luminance(hex: string): number {
  const linear = channels(hex).map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (linear[0] ?? 0) + 0.7152 * (linear[1] ?? 0) + 0.0722 * (linear[2] ?? 0);
}

const contrast = (a: string, b: string): number => {
  const [light, dark] = [Math.max(luminance(a), luminance(b)), Math.min(luminance(a), luminance(b))];
  return (light + 0.05) / (dark + 0.05);
};

export type Palette = Readonly<{
  paper: string;
  ink: string;
  accent: string;
  cta: string;
  /** Secondary words: ink faded toward paper. */
  muted: string;
  /** Thin lines and outlines. */
  hairline: string;
  /** A card's ground, a shade off the paper. */
  surface: string;
  /** Shadows: the darker of ink and paper. */
  shade: string;
  /** Words on the call to action: whichever of ink and paper reads better on it. */
  onCta: string;
  /** Words on an accent ground. */
  onAccent: string;
  dark: boolean;
}>;

/** The look's palette. */
export function paletteOf(look: PitchLook): Palette {
  const { ink, paper, accent, cta } = look.colors;
  const pick = (ground: string): string => (contrast(ground, ink) >= contrast(ground, paper) ? ink : paper);
  return {
    paper,
    ink,
    accent,
    cta,
    muted: mixColour(ink, paper, 0.4),
    hairline: mixColour(ink, paper, 0.82),
    surface: mixColour(paper, ink, look.theme === 'dark' ? 0.08 : 0.035),
    shade: luminance(ink) < luminance(paper) ? ink : paper,
    onCta: pick(cta),
    onAccent: pick(accent),
    dark: look.theme === 'dark',
  };
}

/** The generic families every stack ends with: the kit carries no font of its own. */
const FALLBACK = 'system-ui, sans-serif';

export type FontUse = Readonly<{ stack: string; weight: number }>;
export type Fonts = Readonly<{ heading: FontUse; text: FontUse }>;

/** The CSS stacks of the look's Heading and Text fonts: the ones a fonts provider loaded, or the families by name. */
export function fontsOf(look: PitchLook, loaded: { heading?: string | undefined; text?: string | undefined }): Fonts {
  const stack = (family: string): string => `"${family.replace(/["\\]/g, '')}", ${FALLBACK}`;
  return {
    heading: { stack: loaded.heading ?? stack(look.heading.family), weight: look.heading.weight },
    text: { stack: loaded.text ?? stack(look.text.family), weight: look.text.weight },
  };
}
