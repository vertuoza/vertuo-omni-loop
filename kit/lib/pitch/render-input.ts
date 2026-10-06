// What `omni pitch render` and `omni pitch studio` hand the engine's page (PRD 1108 s6): the run's
// settings, its fonts through the fonts provider, its logo, and `input.json` beside the storyboard.
//
// - The settings are the run's `settings.json`, the product's Pitch settings as `/omni:pitch` writes them,
//   filled from their preset; a run without one reads the preset `pitch.json` names, else the defaults.
//   Settings out of shape stop the render, naming each field.
// - An uploaded file (`asset:<name>`: the logo, a music track) is the run's `assets/<name>`.
// - The Heading and Text fonts are loaded through the provider each names, into the run's folder; one
//   that cannot be had falls back to the system's font, with one line. A font uploaded to the product
//   (the family `asset:<file>`) is the run's `assets/<file>`.
// - A logo the run does not hold is left out, with one line.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isOneOf, messageOf } from '../narrow.ts';
import { loadFont } from './providers/registry.ts';
import type { Warn } from './providers/registry.ts';
import type { AssetResolver, ProviderFetch } from './providers/types.ts';
import { PAGE_INPUT } from './render-page.ts';
import { fontRequestOf, readPitchJson } from './run.ts';
import { PITCH_PRESETS, defaultPitchSettings, parsePitchSettings } from './settings.ts';
import type { PitchSettings } from './settings.ts';
import { parseStoryboard, STORYBOARD_FILE } from './storyboard.ts';
import type { Storyboard } from './storyboard.ts';

/** The run's Pitch settings, as `/omni:pitch` writes them. */
export const RUN_SETTINGS = 'settings.json';
/** Where a run keeps the product's uploaded files. */
const ASSETS_DIR = 'assets';

/** What stops a render before anything is drawn: each line names what is wrong. */
export class RenderRefused extends Error {
  lines: string[];

  constructor(lines: string[]) {
    super(lines.join('\n'));
    this.name = 'RenderRefused';
    this.lines = lines;
  }
}

/** The settings of the run in `dir`, filled; it throws `RenderRefused` naming each field out of shape. */
export function runSettings(dir: string): PitchSettings {
  const file = join(dir, RUN_SETTINGS);
  if (!existsSync(file)) {
    const look = readPitchJson(dir)?.['look'];
    return defaultPitchSettings(isOneOf(PITCH_PRESETS, look) ? look : undefined);
  }
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new RenderRefused([`${RUN_SETTINGS} does not read as JSON: ${messageOf(error)}`]);
  }
  const parsed = parsePitchSettings(value);
  if (!parsed.ok) throw new RenderRefused(parsed.errors.map((line) => `${RUN_SETTINGS}: ${line}`));
  return parsed.settings;
}

/** The storyboard of the run in `dir`, which `omni pitch check` has passed. */
export function runStoryboard(dir: string): Storyboard {
  const parsed = parseStoryboard(JSON.parse(readFileSync(join(dir, STORYBOARD_FILE), 'utf8')));
  if (parsed.storyboard === undefined) throw new RenderRefused(parsed.problems.map(({ path, message }) => `${path}: ${message}`));
  return parsed.storyboard;
}

/** The run's uploaded files: `asset:<name>` is `assets/<name>` of the run's folder. */
export function runAssets(dir: string): AssetResolver {
  return (ref) => {
    const name = ref.replace(/^asset:/, '');
    const file = join(dir, ASSETS_DIR, name);
    return existsSync(file) ? Promise.resolve(file) : Promise.reject(new Error(`the run holds no ${ASSETS_DIR}/${name}`));
  };
}

/** The page's input: the storyboard, the look, the fonts, the logo and the credits. */
export type PageInput = {
  storyboard: Storyboard;
  look: PitchSettings['look'];
  fonts: { css: string; heading: string; text: string };
  logo: string | null;
  credits: string[];
};

/** The run's Heading and Text fonts, each through its provider, written into the run's folder. */
async function fontsOf(dir: string, look: PitchSettings['look'], { fetch, warn }: { fetch: ProviderFetch; warn: Warn }): Promise<PageInput['fonts']> {
  const context = { dir, fetch, asset: runAssets(dir) };
  const heading = await loadFont(fontRequestOf(look.heading), context, warn);
  const same = look.text.provider === look.heading.provider && look.text.family === look.heading.family && look.text.weight === look.heading.weight;
  const text = same ? heading : await loadFont(fontRequestOf(look.text), context, warn);
  const css = same ? heading.css : `${heading.css}${text.css}`;
  return { css, heading: heading.stack, text: text.stack };
}

/** The logo's file in the run, relative to it, or null with one line when the run does not hold it. */
function logoOf(dir: string, logo: string | null, warn: Warn): string | null {
  if (logo === null) return null;
  const path = `${ASSETS_DIR}/${logo.replace(/^asset:/, '')}`;
  if (existsSync(join(dir, path))) return path;
  warn(`logo: the run holds no ${path}, so the video shows none`);
  return null;
}

/** Writes the page's `input.json` in the run's folder `dir`; what it wrote. */
export async function writePageInput(
  dir: string,
  { storyboard, settings, credits, fetch, warn }: { storyboard: Storyboard; settings: PitchSettings; credits: string[]; fetch: ProviderFetch; warn: Warn },
): Promise<PageInput> {
  const input: PageInput = {
    storyboard,
    look: settings.look,
    fonts: await fontsOf(dir, settings.look, { fetch, warn }),
    logo: logoOf(dir, settings.look.logo, warn),
    credits,
  };
  writeFileSync(join(dir, PAGE_INPUT), `${JSON.stringify(input, null, 2)}\n`);
  return input;
}
