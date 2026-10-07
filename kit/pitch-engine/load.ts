// Loading the page's input (PRD 1108 s4): the input file, its fonts and the engine built from them.
import { buildTimeline } from './timeline.ts';
import type { Engine } from './core.tsx';
import { parseInput } from './input.ts';
import type { PageInput } from './input.ts';
import { fontsOf, paletteOf } from './palette.ts';

/** The input file's name beside the page, when `?input=` names none. */
const INPUT_FILE = 'input.json';

/** The input's address: `?input=<url>`, or the file beside the page. */
export const inputUrl = (page: string): URL => new URL(new URL(page).searchParams.get('input') ?? INPUT_FILE, page);

/** `url(…)`s of a stylesheet made absolute against `base`, so fonts load wherever the sheet is put. */
export const absoluteUrls = (css: string, base: URL): string =>
  css.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/g, (_, quote: string, path: string) => `url(${quote}${new URL(path, base).href}${quote})`);

/** The engine of an input read from `base`. */
export function engineOf(input: PageInput, base: URL): Engine {
  const resolve = (path: string): string => new URL(path, base).href;
  return {
    timeline: buildTimeline(input.storyboard),
    palette: paletteOf(input.look),
    fonts: fontsOf(input.look, input.fonts),
    logo: input.logo === null ? null : resolve(input.logo),
    credits: input.credits,
    clips: input.clips,
    resolve,
  };
}

/** The input at `url`, checked: it throws naming every problem. */
export async function fetchInput(url: URL): Promise<PageInput> {
  const answer = await fetch(url);
  if (!answer.ok) throw new Error(`the page's input ${url.href} answered ${answer.status}`);
  const parsed = parseInput(await answer.json());
  if (parsed.problems !== undefined) throw new Error(`the page's input is not right:\n${parsed.problems.join('\n')}`);
  return parsed.input;
}

/** Adds the input's `@font-face` rules to the page and waits until the Heading and Text fonts are ready. */
export async function loadFonts(engine: Engine, css: string | undefined, base: URL): Promise<void> {
  if (css !== undefined) {
    const sheet = document.createElement('style');
    sheet.textContent = absoluteUrls(css, base);
    document.head.append(sheet);
  }
  const { heading, text } = engine.fonts;
  await Promise.all([document.fonts.load(`${heading.weight} 64px ${heading.stack}`), document.fonts.load(`${text.weight} 64px ${text.stack}`), document.fonts.load(`700 64px ${text.stack}`)]);
  await document.fonts.ready;
}
