// What SELECT YOUR APP says and the colours it says it in (PRD 932, s3). The words of each pedestal,
// and every text colour selector.css sets, by the rule that sets it and the background it sits on:
// each reads at 4.5:1 or better (poster/contrast.test.ts).
import type { AppPick } from '../sign-up';

/** The overlay's own background token. */
export const SELECTOR_BACKGROUND = 'void';

/** How many cells a stat bar has; both are full. */
export const STAT_CELLS = 8;

/** Each pedestal's name, its stat and the one line saying what it opens. */
export const PEDESTALS: Readonly<Record<AppPick, { name: string; stat: string; what: string }>> = {
  app: { name: 'OMNI APP', stat: 'FOCUS', what: 'The board, your PRDs and the outbox' },
  arcade: { name: 'ARCADE', stat: 'FUN', what: 'Play the galaxy: every PRD a planet' },
};

export const SELECTOR_TEXT = [
  { selector: '.home-select-banner', colour: 'yellow', on: SELECTOR_BACKGROUND },
  { selector: '.home-select-cursor', colour: 'yellow', on: SELECTOR_BACKGROUND },
  { selector: '.home-select-name', colour: 'white', on: SELECTOR_BACKGROUND },
  { selector: '.home-select-slot[data-on] .home-select-name', colour: 'yellow', on: SELECTOR_BACKGROUND },
  { selector: '.home-select-stat', colour: 'white', on: SELECTOR_BACKGROUND },
  { selector: '.home-select-what', colour: 'dim', on: SELECTOR_BACKGROUND },
  { selector: '.home-select-remember', colour: 'white', on: 'cab' },
  { selector: '.home-select-remember[aria-checked="true"]', colour: 'void', on: 'yellow' },
  { selector: '.home-select-keys', colour: 'dim', on: SELECTOR_BACKGROUND },
  { selector: '.home-select-keys kbd', colour: 'white', on: SELECTOR_BACKGROUND },
] as const;
