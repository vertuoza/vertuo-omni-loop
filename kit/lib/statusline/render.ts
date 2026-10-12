// The status line's lines (PRD 324's spec, "Line 1" and "Width and colour"; PRD 1208's spec, "The
// status line's second line"), drawn from Claude Code's JSON (`input.ts`), what was read beside it
// (`facts.ts`) and what `omni now` answers (`../now/`). Pure: the clock and the environment come in
// as values.
//
// - Line 1: the model, the context bar, the 5-hour usage and `ask on`, joined by ` · `, each left out
//   when it has nothing to say; the context always says something (`context —` without a
//   percentage).
// - Line 2, only where the loop is installed, drawn from `omni now`'s answer, for every kind:
//   - a PRD: `PRD <n> <topic> · <stage>`, then, while `building`, `wave <w>/<W>` (`<w>` the lowest
//     wave of its board holding a slice not merged, `<W>` the highest), `now <id> <name>, …` (its
//     slices in flight) and `stuck <id> <name>, …`; in the `outbox`, `all slices merged` when its
//     board shows every slice merged; in either, `<k> open item(s)` when there are any. The wave and
//     the open items come from the facts of the same PRD (`BoardFacts`); without them, the part is
//     left out. A PRD without a stage is its name alone; a shipped one, `· shipped` and nothing after;
//   - a fix: `bug #<n> <topic> · <stage>`, `visual #<n> <topic> · <stage>`;
//   - a loop or a roadmap above the work: the headline (`roadmap <r> · <m>/<k> merged`, `loop`), then
//     `now PRD <n>` (`now bug #<n>` for a fix) and the id of its first slice in flight;
//   - the session on nothing: `no PRD · /omni:brainstorm to start`.
// - Every line fits `COLUMNS` (80 when it is unset or not a number), counting characters, never
//   colour codes: a line too wide drops its slice names first (the ids stay), then cuts its topic,
//   down to 8 characters ending in `…`, and a line still too wide is cut at its end with `…`.
// - Colour is ANSI, on the context bar with its percentage and on the stuck slices (red) only, and
//   none when `NO_COLOR` is set to anything but an empty string.
import type { SessionInput } from './input.ts';
import type { CachedSlice } from './schema.ts';
import { IN_FLIGHT, MERGED, OUTBOX, STUCK } from './stage.ts';
import { isList } from '../outbox/plain-text.ts';
import type { Terminal } from '../env/read.ts';
import type { PrdNumber } from '../ids.ts';
import type { Now, NowSlice, NowWork } from '../now/now.ts';

/** The five-hour window, as `parseInput` reads it. */
type FiveHour = { percent: number; resetsAt: number };

/** What line 2 reads of the PRD the facts name, beside `omni now`'s answer: its board's every slice, and its open items. */
export type BoardFacts = { number: PrdNumber; slices: readonly CachedSlice[] | null; openItems: number };

type Colour = 'green' | 'yellow' | 'red';

export const NO_PRD_LINE = 'no PRD · /omni:brainstorm to start';
/** What the status line prints for JSON it could not read. */
export const UNREADABLE_LINE = 'omni';
const SEPARATOR = ' · ';
const BAR_CELLS = 10;
const FILLED = '█';
const EMPTY = '░';
const CUT = '…';
const MINUTE = 60_000;
// The shortest a topic is cut to, its `…` included.
const TOPIC_FLOOR = 8;
// A PRD's stage while a slice of its board is not merged, as `omni now` words it.
const BUILDING = 'building';

const RESET = '\x1b[0m';
const COLOURS: Record<Colour, string> = { green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m' };
// One SGR escape (a colour or a reset), or one character.
const TOKEN = /\x1b\[[0-9;]*m|[\s\S]/gu;
const SGR = /^\x1b\[[0-9;]*m$/;

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

/** `wave <w>/<W>`, or `all slices merged`, from the board's every slice; `null` without a board, or with one of no slices. */
export function wavePart(slices: readonly CachedSlice[] | null | undefined): string | null {
  if (!isList(slices) || slices.length === 0) return null;
  const open = slices.filter((slice) => slice.state !== MERGED);
  if (open.length === 0) return 'all slices merged';
  return `wave ${Math.min(...open.map((slice) => slice.wave))}/${Math.max(...slices.map((slice) => slice.wave))}`;
}

const inFlight = (slice: NowSlice): boolean => IN_FLIGHT.includes(slice.state);

/** `<word> <id> <name>, …` for `slices`, each name left out when `names` is off; `null` for none. */
function slicesNamed(word: string, slices: readonly NowSlice[], names: boolean): string | null {
  const label = ({ id, name }: NowSlice): string => (names && name ? `${id} ${name}` : id);
  return slices.length > 0 ? `${word} ${slices.map(label).join(', ')}` : null;
}

/** `text` cut to `length` characters, the last one `…`. */
const cutTo = (text: string, length: number): string => `${Array.from(text).slice(0, length - 1).join('')}${CUT}`;

/** The work's name with `topic` shown: `PRD <n> <topic>`, or `<kind> #<n> <topic>` for a fix. */
const workName = (work: NowWork, topic: string): string => (work.kind === 'prd' ? `PRD ${work.number} ${topic}` : `${work.kind} #${work.number} ${topic}`);

/** The parts of the work's line after its name, slice names shown or not; `board` is its PRD's, when the facts read it. */
function workParts(work: NowWork, board: BoardFacts | null, names: boolean, color: boolean): (string | null)[] {
  if (work.kind !== 'prd' || (work.stage !== BUILDING && work.stage !== OUTBOX)) return [work.stage];
  const wave = wavePart(board?.slices);
  const items = itemsPart(board?.openItems);
  if (work.stage === OUTBOX) return [work.stage, wave, items];
  return [work.stage, wave, slicesNamed('now', work.slices.filter(inFlight), names), stuckPart(work.slices, names, color), items];
}

/** `stuck <id> <name>, …`, in red when `color` is on; `null` for none stuck. */
function stuckPart(slices: readonly NowSlice[], names: boolean, color: boolean): string | null {
  const stuck = slicesNamed(STUCK, slices.filter((slice) => slice.state === STUCK), names);
  return stuck ? paint(stuck, 'red', color) : null;
}

/**
 * The work's line within `width`: its slice names dropped first, then its topic cut (never below 8
 * characters), then the line at its end. `board` is its PRD's, or `null`.
 */
function workLine(work: NowWork, board: BoardFacts | null, width: number = Number.POSITIVE_INFINITY, { color = false }: { color?: boolean } = {}): string {
  const draw = (topic: string, names: boolean): string => [workName(work, topic), ...workParts(work, board, names, color)].filter(Boolean).join(SEPARATOR);
  const full = draw(work.topic, true);
  if (visibleLength(full) <= width) return full;
  const line = draw(work.topic, false);
  const over = visibleLength(line) - width;
  const length = Array.from(work.topic).length;
  if (over <= 0 || length <= TOPIC_FLOOR) return fit(line, width);
  return fit(draw(cutTo(work.topic, Math.max(TOPIC_FLOOR, length - over)), false), width);
}

/** The line of a session under a loop or a roadmap: the headline, then `now` the work and the id of its first slice in flight. */
function headlineLine({ headline, work }: Now, width: number): string {
  const head = headline ? [headline.number === undefined ? headline.kind : `${headline.kind} ${headline.number}`, headline.progress ?? null] : [];
  const ref = work ? `now ${work.kind === 'prd' ? `PRD ${work.number}` : `${work.kind} #${work.number}`}` : null;
  const first = work?.slices.find(inFlight)?.id ?? null;
  return fit([...head, ref, first].filter(Boolean).join(SEPARATOR), width);
}

/** Line 2 from `omni now`'s answer, within `width`; `board` counts only for the PRD it names, under no headline. */
export function secondLine(answer: Now, board: BoardFacts | null, width: number = Number.POSITIVE_INFINITY, { color = false }: { color?: boolean } = {}): string {
  const { headline, work } = answer;
  if (headline) return headlineLine(answer, width);
  if (!work) return fit(NO_PRD_LINE, width);
  return workLine(work, work.kind === 'prd' && board?.number === work.number ? board : null, width, { color });
}

/**
 * The lines to print. `input` is `parseInput`'s result (`null`: unreadable JSON); `facts` is what was
 * read beside it (`null`: it could not read, so line 1 comes from the JSON alone): whether the loop is
 * installed, ask mode, `omni now`'s answer (`now`; none prints the no-PRD line) and the board of the
 * PRD the status line's own facts name.
 */
export function renderLines({ input, facts, terminal, now }: {
  input: Pick<SessionInput, 'model' | 'contextPercent' | 'fiveHour'> | null;
  facts: { installed: boolean; askOn: boolean; now?: Now | null; board?: BoardFacts | null } | null;
  terminal: Terminal;
  now: number;
}): string[] {
  const width = terminal.columns;
  if (!input) return [fit(UNREADABLE_LINE, width)];
  const color = terminal.color;
  const lines = [sessionLine({ ...input, askOn: facts?.askOn === true }, { now, color })];
  if (facts?.installed) lines.push(facts.now ? secondLine(facts.now, facts.board ?? null, width, { color }) : NO_PRD_LINE);
  return lines.map((line) => fit(line, width));
}

