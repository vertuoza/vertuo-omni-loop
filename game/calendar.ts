// Working calendar: Monday–Friday, 09:00–18:00, Europe/Brussels (spec §4).
export const CALENDAR = Object.freeze({ tz: 'Europe/Brussels', startHour: 9, endHour: 18, days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] });

const STEP_MS = 15 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
// 1970-01-01, day 0, was a Thursday.
const WEEKDAYS = ['Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed'];
const fmt = new Intl.DateTimeFormat('en-US', {
  timeZone: CALENDAR.tz, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
});

/** How far the zone's clock is ahead of UTC at `t`, in milliseconds, as Intl reads it. */
function offsetAt(t: number): number {
  const p = Object.fromEntries(fmt.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute)) - Math.floor(t / MINUTE_MS) * MINUTE_MS;
}

// Reading the zone through Intl is slow, and the galaxy fold counts working time across every wound of
// the ledger (#1788), so the offset is read per UTC day and kept: a day whose first and last hours share
// an offset keeps it all day, and a clock-change day is read hour by hour. Brussels changes its clock on
// a UTC hour boundary, once on such a day at most.
const offsets = new Map<number, number | number[]>();

function offsetOf(t: number): number {
  const day = Math.floor(t / DAY_MS);
  let kept = offsets.get(day);
  if (kept === undefined) {
    const start = day * DAY_MS;
    const first = offsetAt(start);
    kept = first === offsetAt(start + DAY_MS - HOUR_MS) ? first : Array.from({ length: 24 }, (_, hour) => offsetAt(start + hour * HOUR_MS));
    offsets.set(day, kept);
  }
  return typeof kept === 'number' ? kept : kept[Math.floor((t - day * DAY_MS) / HOUR_MS)] ?? 0;
}

function localParts(date: Date): { weekday: string | undefined; hour: number; minute: number } {
  const local = date.getTime() + offsetOf(date.getTime());
  const mod = (n: number, m: number) => ((n % m) + m) % m;
  return { weekday: WEEKDAYS[mod(Math.floor(local / DAY_MS), 7)], hour: mod(Math.floor(local / HOUR_MS), 24), minute: mod(Math.floor(local / MINUTE_MS), 60) };
}

export function isWorkingTime(date: Date): boolean {
  const { weekday, hour } = localParts(date);
  return weekday !== undefined && CALENDAR.days.includes(weekday) && hour >= CALENDAR.startHour && hour < CALENDAR.endHour;
}

export function workingMinutesBetween(from: Date, to: Date): number {
  let minutes = 0;
  for (let t = from.getTime(); t < to.getTime(); t += STEP_MS) {
    if (isWorkingTime(new Date(t))) minutes += 15;
  }
  return minutes;
}

export function addWorkingMinutes(from: Date, minutes: number): Date {
  let t = from.getTime();
  let left = minutes;
  while (left > 0) {
    if (isWorkingTime(new Date(t))) left -= 15;
    t += STEP_MS;
  }
  return new Date(t);
}

export function tranchesBetween(from: Date, to: Date, trancheMinutes: number): number {
  return Math.floor(workingMinutesBetween(from, to) / trancheMinutes);
}
