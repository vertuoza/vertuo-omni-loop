// What the /design screenshot test shares with the page: how a part's variant in a theme is named
// on the page (data attributes) and on disk (a baseline under visual/baselines/design/<Part>/).
// Plain TypeScript with no import: `node scripts/visual.ts` runs it as it is.

/** The attributes a themed specimen box carries on /design (DesignScreen.tsx). */
export const BOX = '[data-part][data-prop][data-value][data-theme]';

export type Box = { part: string; prop: string; value: string; theme: string };

/** A baseline's path under visual/baselines/: one folder per part. */
export function baselineName({ part, prop, value, theme }: Box): string {
  return `design/${part}/${prop}-${value}-${theme}.png`;
}
