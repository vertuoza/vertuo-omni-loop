// Working calendar: Monday–Friday, 09:00–18:00, Europe/Brussels (spec §4).
export const CALENDAR = Object.freeze({ tz: 'Europe/Brussels', startHour: 9, endHour: 18, days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] });

const STEP_MS = 15 * 60 * 1000;
const fmt = new Intl.DateTimeFormat('en-US', {
  timeZone: CALENDAR.tz, weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false,
});

function localParts(date) {
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
  return { weekday: p.weekday, hour: Number(p.hour) % 24, minute: Number(p.minute) };
}

export function isWorkingTime(date) {
  const { weekday, hour } = localParts(date);
  return CALENDAR.days.includes(weekday) && hour >= CALENDAR.startHour && hour < CALENDAR.endHour;
}

export function workingMinutesBetween(from, to) {
  let minutes = 0;
  for (let t = from.getTime(); t < to.getTime(); t += STEP_MS) {
    if (isWorkingTime(new Date(t))) minutes += 15;
  }
  return minutes;
}

export function addWorkingMinutes(from, minutes) {
  let t = from.getTime();
  let left = minutes;
  while (left > 0) {
    if (isWorkingTime(new Date(t))) left -= 15;
    t += STEP_MS;
  }
  return new Date(t);
}

export function tranchesBetween(from, to, trancheMinutes) {
  return Math.floor(workingMinutesBetween(from, to) / trancheMinutes);
}
