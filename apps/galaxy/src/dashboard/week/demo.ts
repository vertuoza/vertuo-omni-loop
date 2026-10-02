import type { PartDemo } from '../part';
import { weekDays } from './chart';
import type { WeekValue } from './load';
import { at } from 'vertuo-omni-plan/kit/lib/narrow.ts';

// The week of merges in the demo (PRD 328): the demo world holds no merges, so the week is made up
// and fixed, as the spec draws it: nine pull requests over the seven days up to today, two of them
// days with none. It moves with the day it is shown on, so today is always last.

/** Each day's merges, from six days ago to today. */
export const DEMO_MERGES = [2, 1, 3, 1, 0, 0, 2] as const;

export const demoWeek: PartDemo<WeekValue> = ({ now }) => ({
  kind: 'week',
  days: weekDays(now).map((date, i) => ({ date, count: at(DEMO_MERGES, i, "the demo day's merges") })),
});
