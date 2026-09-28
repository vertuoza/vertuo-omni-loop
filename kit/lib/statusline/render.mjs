// The status line's lines (PRD 324's spec, "Line 1", "Line 2" and "Width and colour"), drawn from
// Claude Code's JSON (`input.mjs`) and what was read beside it (`facts.mjs`). Pure: the clock and the
// environment come in as values.
//
// - Line 1: the model, the context bar, the 5-hour usage and `ask on`, joined by ` · `, each left out
//   when it has nothing to say; the context always says something (`context —` without a
//   percentage).
// - Line 2, only where the loop is installed: the PRD this session works on,
//   `PRD <n> <topic>[ · <slice>] · <stage>[ · <k> open item(s)]` (the open items in the outbox only,
//   the stage left out when there is none), `PRD <n> <topic> · shipped` and nothing after, or the
//   no-PRD line.
// - Every line fits `COLUMNS` (80 when it is unset or not a number), counting characters, never
//   colour codes: a line too wide cuts its topic first, down to 8 characters ending in `…`, and a
//   line still too wide is cut at its end with `…`.
// - Colour is ANSI, on the context bar with its percentage only, and none when `NO_COLOR` is set to
//   anything but an empty string.
import { OUTBOX, SHIPPED } from './stage.mjs';

export const NO_PRD_LINE = 'no PRD · /omni:brainstorm to start';
/** What the status line prints for JSON it could not read. */
export const UNREADABLE_LINE = 'omni';
const SEPARATOR = ' · ';
const DEFAULT_COLUMNS = 80;
const BAR_CELLS = 10;
const FILLED = '█';
const EMPTY = '░';
const CUT = '…';
const MINUTE = 60_000;
// The shortest a topic is cut to, its `…` included.
const TOPIC_FLOOR = 8;

const RESET = '\x1b[0m';
const COLOURS = { green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m' };
// One SGR escape (a colour or a reset), or one character.
const TOKEN = /\x1b\[[0-9;]*m|[\s\S]/gu;
const SGR = /^\x1b\[[0-9;]*m$/;

/** The line's width: `COLUMNS` when it is a positive whole number, else 80. */
export function columnsOf(env) {
  const raw = env?.COLUMNS;
  const columns = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : Number.NaN;
  return Number.isInteger(columns) && columns > 0 ? columns : DEFAULT_COLUMNS;
}

/** Whether colour is on: always, unless `NO_COLOR` is set to anything but an empty string. */
export function colorOn(env) {
  const value = env?.NO_COLOR;
  return value === undefined || value === null || value === '';
}

const paint = (text, colour, color) => (color ? `${COLOURS[colour]}${text}${RESET}` : text);

function contextColour(percent) {
  if (percent >= 80) return 'red';
  if (percent >= 50) return 'yellow';
  return 'green';
}

/** `context <bar> <p>%`: 10 cells, one filled per 10 %, coloured green, yellow or red; `context —` without a percentage. */
export function contextPart(percent, { color = false } = {}) {
  if (typeof percent !== 'number' || !Number.isFinite(percent)) return 'context —';
  const shown = Math.floor(percent);
  const filled = Math.max(0, Math.min(BAR_CELLS, Math.floor(shown / 10)));
  const bar = FILLED.repeat(filled) + EMPTY.repeat(BAR_CELLS - filled);
  return `context ${paint(`${bar} ${shown}%`, contextColour(shown), color)}`;
}

/** The time left before a reset: `<m>m` under an hour, `<h>h<mm>` from an hour on; a started minute counts whole. */
export function resetIn(ms) {
  const minutes = Math.ceil(ms / MINUTE);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}`;
}

/** `usage <u>%, resets in <t>`, or `null` without a five-hour window or once its reset has passed. */
export function usagePart(fiveHour, now) {
  if (!fiveHour || !(fiveHour.resetsAt > now)) return null;
  return `usage ${Math.floor(fiveHour.percent)}%, resets in ${resetIn(fiveHour.resetsAt - now)}`;
}

/** Line 1: the model, the context, the 5-hour usage and `ask on`, each left out when it has nothing to say. */
export function sessionLine({ model, contextPercent, fiveHour, askOn }, { now, color }) {
  return [model, contextPart(contextPercent, { color }), usagePart(fiveHour, now), askOn ? 'ask on' : null]
    .filter(Boolean)
    .join(SEPARATOR);
}

/** The number of characters `line` shows, colour codes not counted. */
export function visibleLength(line) {
  let length = 0;
  for (const [token] of line.matchAll(TOKEN)) if (!SGR.test(token)) length += 1;
  return length;
}

/** `line` as it is when it fits `width`, else cut to `width - 1` characters and `…`, any colour it cut into closed. */
export function fit(line, width) {
  if (visibleLength(line) <= width) return line;
  let out = '';
  let shown = 0;
  let open = false;
  for (const [token] of line.matchAll(TOKEN)) {
    if (SGR.test(token)) {
      out += token;
      open = token !== RESET;
      continue;
    }
    if (shown === width - 1) break;
    out += token;
    shown += 1;
  }
  return `${out}${open ? RESET : ''}${CUT}`;
}

/** `<k> open item(s)`, or `null` at zero. */
export function itemsPart(count) {
  if (!(count > 0)) return null;
  return `${count} open item${count === 1 ? '' : 's'}`;
}

/** `text` cut to `length` characters, the last one `…`. */
const cutTo = (text, length) => `${[...text].slice(0, length - 1).join('')}${CUT}`;

/**
 * Line 2 for a PRD, within `width`: its topic cut first (never below 8 characters), then the line at
 * its end.
 *
 * @param {{ number: number, topic: string, slice: string | null, stage: string | null, openItems: number }} prd
 * @param {number} [width]
 */
export function prdLine({ number, topic, slice, stage, openItems }, width = Number.POSITIVE_INFINITY) {
  const draw = (shown) => {
    if (stage === SHIPPED) return `PRD ${number} ${shown}${SEPARATOR}${SHIPPED}`;
    return [`PRD ${number} ${shown}`, slice, stage, stage === OUTBOX ? itemsPart(openItems) : null]
      .filter(Boolean)
      .join(SEPARATOR);
  };
  const line = draw(topic);
  const over = visibleLength(line) - width;
  const length = [...topic].length;
  if (over <= 0 || length <= TOPIC_FLOOR) return fit(line, width);
  return fit(draw(cutTo(topic, Math.max(TOPIC_FLOOR, length - over))), width);
}

/**
 * The lines to print. `input` is `parseInput`'s result (`null`: unreadable JSON); `facts` is
 * `readFacts`' (`null`: it could not read, so line 1 comes from the JSON alone), whose `prd` is the
 * PRD line's facts, or `null` for the no-PRD line.
 *
 * @param {{ input: object | null, facts: { installed: boolean, askOn: boolean, prd?: object | null } | null, env: object, now: number }} state
 * @returns {string[]}
 */
export function renderLines({ input, facts, env, now }) {
  const width = columnsOf(env);
  if (!input) return [fit(UNREADABLE_LINE, width)];
  const lines = [sessionLine({ ...input, askOn: facts?.askOn === true }, { now, color: colorOn(env) })];
  if (facts?.installed) lines.push(facts.prd ? prdLine(facts.prd, width) : NO_PRD_LINE);
  return lines.map((line) => fit(line, width));
}
