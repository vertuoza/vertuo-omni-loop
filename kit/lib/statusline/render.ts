// The status line's lines (PRD 324's spec, "Line 1", "Line 2" and "Width and colour"), drawn from
// Claude Code's JSON (`input.ts`) and what was read beside it (`facts.ts`). Pure: the clock and the
// environment come in as values.
//
// - Line 1: the model, the context bar, the 5-hour usage and `ask on`, joined by ` · `, each left out
//   when it has nothing to say; the context always says something (`context —` without a
//   percentage).
// - Line 2, only where the loop is installed: the PRD this session works on,
//   `PRD <n> <topic>[ · <slice>] · <stage>[ · <slices>][ · <k> open item(s)]` (the slices and the
//   open items in the outbox only, the stage left out when there is none), `PRD <n> <topic> · shipped`
//   and nothing after, or the no-PRD line.
// - `<slices>`, from the board the status line shows: `wave <w> of <W> · <m>/<n> slices merged`,
//   `<w>` the lowest wave holding a slice not merged and `<W>` the highest, followed by
//   `, <i> in flight` (`in-flight` and `claimed-stale`) and `, <s> stuck`, each only when not zero;
//   `all slices merged` when every slice is; left out without a board.
// - Every line fits `COLUMNS` (80 when it is unset or not a number), counting characters, never
//   colour codes: a line too wide cuts its topic first, down to 8 characters ending in `…`, and a
//   line still too wide is cut at its end with `…`.
// - Colour is ANSI, on the context bar with its percentage and on the stuck count (red) only, and
//   none when `NO_COLOR` is set to anything but an empty string.
import type { SessionInput } from './input.ts';
import type { CachedSlice } from './schema.ts';
import { IN_FLIGHT, MERGED, OUTBOX, SHIPPED, STUCK } from './stage.ts';
import { isList } from '../outbox/plain-text.ts';
import type { PrdNumber, WorkSliceId } from '../ids.ts';

/** The environment the lines read: `COLUMNS` and `NO_COLOR`. */
type Env = Readonly<Record<string, string | null | undefined>> | null | undefined;

/** The five-hour window, as `parseInput` reads it. */
type FiveHour = { percent: number; resetsAt: number };

/** What line 2 draws for a PRD: `slices` is the board shown. */
export type PrdLineFacts = {
  number: PrdNumber;
  topic: string;
  slice: WorkSliceId | null;
  stage: string | null;
  openItems: number;
  slices?: readonly CachedSlice[] | null;
};

type Colour = 'green' | 'yellow' | 'red';

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
const COLOURS: Record<Colour, string> = { green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m' };
// One SGR escape (a colour or a reset), or one character.
const TOKEN = /\x1b\[[0-9;]*m|[\s\S]/gu;
const SGR = /^\x1b\[[0-9;]*m$/;

/** The line's width: `COLUMNS` when it is a positive whole number, else 80. */
export function columnsOf(env: Env): number {
  const raw = env?.COLUMNS;
  const columns = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : Number.NaN;
  return Number.isInteger(columns) && columns > 0 ? columns : DEFAULT_COLUMNS;
}

/** Whether colour is on: always, unless `NO_COLOR` is set to anything but an empty string. */
export function colorOn(env: Env): boolean {
  const value = env?.NO_COLOR;
  return value === undefined || value === null || value === '';
}

const paint = (text: string, colour: Colour, color: boolean): string => (color ? `${COLOURS[colour]}${text}${RESET}` : text);

function contextColour(percent: number): Colour {
  if (percent >= 80) return 'red';
  if (percent >= 50) return 'yellow';
  return 'green';
}

/** `context <bar> <p>%`: 10 cells, one filled per 10 %, coloured green, yellow or red; `context —` without a percentage. */
export function contextPart(percent: number | null | undefined, { color = false }: { color?: boolean } = {}): string {
  if (typeof percent !== 'number' || !Number.isFinite(percent)) return 'context —';
  const shown = Math.floor(percent);
  const filled = Math.max(0, Math.min(BAR_CELLS, Math.floor(shown / 10)));
  const bar = FILLED.repeat(filled) + EMPTY.repeat(BAR_CELLS - filled);
  return `context ${paint(`${bar} ${shown}%`, contextColour(shown), color)}`;
}

/** The time left before a reset: `<m>m` under an hour, `<h>h<mm>` from an hour on; a started minute counts whole. */
export function resetIn(ms: number): string {
  const minutes = Math.ceil(ms / MINUTE);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}`;
}

/** `usage <u>%, resets in <t>`, or `null` without a five-hour window or once its reset has passed. */
export function usagePart(fiveHour: FiveHour | null | undefined, now: number): string | null {
  if (!fiveHour || !(fiveHour.resetsAt > now)) return null;
  return `usage ${Math.floor(fiveHour.percent)}%, resets in ${resetIn(fiveHour.resetsAt - now)}`;
}

/** Line 1: the model, the context, the 5-hour usage and `ask on`, each left out when it has nothing to say. */
export function sessionLine(
  { model, contextPercent, fiveHour, askOn }: Pick<SessionInput, 'model' | 'contextPercent' | 'fiveHour'> & { askOn: boolean },
  { now, color }: { now: number; color: boolean },
): string {
  return [model, contextPart(contextPercent, { color }), usagePart(fiveHour, now), askOn ? 'ask on' : null]
    .filter(Boolean)
    .join(SEPARATOR);
}

/** The number of characters `line` shows, colour codes not counted. */
export function visibleLength(line: string): number {
  let length = 0;
  for (const [token] of line.matchAll(TOKEN)) if (!SGR.test(token)) length += 1;
  return length;
}

/** `line` as it is when it fits `width`, else cut to `width - 1` characters and `…`, any colour it cut into closed. */
export function fit(line: string, width: number): string {
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
export function itemsPart(count: number | null | undefined): string | null {
  if (count === null || count === undefined || !(count > 0)) return null;
  return `${count} open item${count === 1 ? '' : 's'}`;
}

/**
 * `wave <w> of <W> · <m>/<n> slices merged[, <i> in flight][, <s> stuck]`, or `all slices merged`,
 * from the board's slices; `null` without a board, or with one of no slices. The stuck count is red
 * when `color` is on.
 */
export function slicesPart(slices: readonly CachedSlice[] | null | undefined, { color = false }: { color?: boolean } = {}): string | null {
  if (!isList(slices) || slices.length === 0) return null;
  const count = (test: (state: string) => boolean): number => slices.filter((slice) => test(slice.state)).length;
  const merged = count((state) => state === MERGED);
  if (merged === slices.length) return 'all slices merged';
  const wave = Math.min(...slices.filter((slice) => slice.state !== MERGED).map((slice) => slice.wave));
  const last = Math.max(...slices.map((slice) => slice.wave));
  const inFlight = count((state) => IN_FLIGHT.includes(state));
  const stuck = count((state) => state === STUCK);
  return [
    `wave ${wave} of ${last}${SEPARATOR}${merged}/${slices.length} slices merged`,
    inFlight > 0 ? `, ${inFlight} in flight` : '',
    stuck > 0 ? `, ${paint(`${stuck} stuck`, 'red', color)}` : '',
  ].join('');
}

/** `text` cut to `length` characters, the last one `…`. */
const cutTo = (text: string, length: number): string => `${Array.from(text).slice(0, length - 1).join('')}${CUT}`;

/**
 * Line 2 for a PRD, within `width`: its topic cut first (never below 8 characters), then the line at
 * its end.
 */
export function prdLine(
  { number, topic, slice, stage, openItems, slices = null }: PrdLineFacts,
  width: number = Number.POSITIVE_INFINITY,
  { color = false }: { color?: boolean } = {},
): string {
  const inOutbox = stage === OUTBOX;
  const draw = (shown: string): string => {
    if (stage === SHIPPED) return `PRD ${number} ${shown}${SEPARATOR}${SHIPPED}`;
    return [`PRD ${number} ${shown}`, slice, stage, inOutbox ? slicesPart(slices, { color }) : null, inOutbox ? itemsPart(openItems) : null]
      .filter(Boolean)
      .join(SEPARATOR);
  };
  const line = draw(topic);
  const over = visibleLength(line) - width;
  const length = Array.from(topic).length;
  if (over <= 0 || length <= TOPIC_FLOOR) return fit(line, width);
  return fit(draw(cutTo(topic, Math.max(TOPIC_FLOOR, length - over))), width);
}

/**
 * The lines to print. `input` is `parseInput`'s result (`null`: unreadable JSON); `facts` is
 * `readFacts`' (`null`: it could not read, so line 1 comes from the JSON alone), whose `prd` is the
 * PRD line's facts, or `null` for the no-PRD line.
 */
export function renderLines({ input, facts, env, now }: {
  input: Pick<SessionInput, 'model' | 'contextPercent' | 'fiveHour'> | null;
  facts: { installed: boolean; askOn: boolean; prd?: PrdLineFacts | null } | null;
  env: Env;
  now: number;
}): string[] {
  const width = columnsOf(env);
  if (!input) return [fit(UNREADABLE_LINE, width)];
  const color = colorOn(env);
  const lines = [sessionLine({ ...input, askOn: facts?.askOn === true }, { now, color })];
  if (facts?.installed) lines.push(facts.prd ? prdLine(facts.prd, width, { color }) : NO_PRD_LINE);
  return lines.map((line) => fit(line, width));
}
