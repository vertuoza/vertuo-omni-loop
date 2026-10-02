import { at, dateParts } from 'vertuo-omni-plan/kit/lib/narrow.ts';

// The board's per-day charts (PRD 572): the axis's marks, and how each day is named under its column
// and in the list a screen reader reads in the drawing's place.

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** A calendar day, named: its weekday (`Saturday`) and its date (`26 September`). */
export function dayName(date: string): { weekday: string; date: string; day: number } {
  const [year, month, day] = dateParts(date);
  return { weekday: at(WEEKDAYS, new Date(Date.UTC(year, month - 1, day)).getUTCDay(), 'the weekday'), date: `${day} ${MONTHS[month - 1]}`, day };
}

/**
 * The label under each column, or null for none: a week names every day by its short weekday
 * (`Sat`); a longer period, too narrow for every day, names every seventh day by its date, counted
 * back from today, which is always named.
 */
export function columnLabels(days: readonly string[]): (string | null)[] {
  if (days.length <= 7) return days.map((d) => dayName(d).weekday.slice(0, 3));
  const last = days.length - 1;
  return days.map((d, i) => ((last - i) % 7 === 0 ? String(dayName(d).day) : null));
}

/** The round whole steps the axis may take: 1, 2, 5, 10, 20, 50… */
function step(top: number): number {
  for (let scale = 1; ; scale *= 10) {
    for (const s of [1, 2, 5]) if (top / (s * scale) <= 5) return s * scale;
  }
}

/**
 * The y-axis's marks: whole numbers from 0 to the highest column (at least 1), so the highest column
 * reaches the top mark; every whole number up to five, past that a round step and the top, dropping
 * the step's last mark when it would sit within half a step of the top.
 */
export function axisTicks(max: number): number[] {
  const top = Math.max(1, Math.ceil(max));
  const by = step(top);
  const ticks: number[] = [];
  for (let mark = 0; mark < top; mark += by) if (mark === 0 || top - mark > by / 2) ticks.push(mark);
  return [...ticks, top];
}
