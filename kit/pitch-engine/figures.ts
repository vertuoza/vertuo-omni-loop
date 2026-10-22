// A stats scene's figures (PRD 2030 s5): each value counts up from 0 over 1.5 s, the items arriving one
// after another, and is written the way the storyboard's `meta.locale` writes numbers (`16,790` in `en`,
// `16 790` in `fr`), `en` when it names none. Pure, so a figure's text at a given second is known.
import { EASINGS, clamp } from './animation.ts';

/** How long a figure takes to count up to its value, in seconds. */
export const COUNT_SECONDS = 1.5;
/** The beat between one figure starting to count and the next. */
export const FIGURE_STAGGER = 0.25;
/** How figures are written when the storyboard names no locale. */
const DEFAULT_LOCALE = 'en';

/** What a figure shows: its value, what goes before and after it, and how many decimals it keeps (none by default). */
export type Figure = Readonly<{ value: number; prefix?: string | undefined; suffix?: string | undefined; decimals?: number | undefined }>;

/** `figure` written for `locale`, showing `value` (its own by default) with its decimals, prefix and suffix. */
export function formatFigure(figure: Figure, value: number = figure.value, locale: string = DEFAULT_LOCALE): string {
  const decimals = figure.decimals ?? 0;
  const number = new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value + 0);
  return `${figure.prefix ?? ''}${number}${figure.suffix ?? ''}`;
}

/** Where a figure counting up to `value` is, `seconds` after it started: 0 before, rising fast then settling, `value` from 1.5 s on. */
export const countedValue = (value: number, seconds: number): number => value * EASINGS.out(clamp(seconds / COUNT_SECONDS));

/** The seconds into a scene's entrances each of `count` figures starts to count, the first at `first`. */
export const figureStarts = (count: number, first: number): number[] => Array.from({ length: count }, (_, index) => first + index * FIGURE_STAGGER);

/** `figure`'s text at `seconds` into its scene's entrances, its count starting at `start`. */
export const figureAt = (figure: Figure, start: number, seconds: number, locale?: string): string => formatFigure(figure, countedValue(figure.value, seconds - start), locale);
