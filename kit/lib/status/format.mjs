// The overview as text: the header, the counts, the bar, your PRDs and the pointer to help. Plain
// text with no colour, so it reads the same in a terminal and inside Claude, and no line wider than
// 80 columns.
// Pure: the clock comes in as `now`.
import { BAR_CELLS } from './overview.mjs';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** No line wider than this. */
const WIDTH = 80;
const INDENT = '  ';
const LABEL = '  delivered  ';
const UNDER_BAR = ' '.repeat(LABEL.length);
const GAP = '     ';

/** The seven stages of the loop, in the order a PRD goes (PRD 587): the kit's one list of them, held
 * to galaxy's `STAGES` by `kit/test/stage-words.test.mjs`. */
export const STAGES = Object.freeze(['idea', 'prd', 'inbox', 'building', 'outbox', 'shipped', 'retro']);

/** Each stage in words, as the Omni app shows it. */
export const STAGE_WORDS = Object.freeze({
  idea: 'idea', prd: 'PRD', inbox: 'inbox', building: 'building', outbox: 'outbox', shipped: 'shipped', retro: 'retro',
});

/** What the counts show for idea: a draft lives on the Omni app, which the repository cannot show. */
const IDEA_COUNT = 'on the app';

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** When the checkout last fetched, in words: `never fetched`, `fetched just now`, or `fetched N
 * minutes|hours|days ago`, each rounded down. A time ahead of the clock reads as just now. */
export function fetchedAgo(fetchedAt, now) {
  if (fetchedAt === null || fetchedAt === undefined) return 'never fetched';
  const age = Math.max(0, now - fetchedAt);
  if (age < MINUTE) return 'fetched just now';
  if (age < HOUR) return `fetched ${plural(Math.floor(age / MINUTE), 'minute')} ago`;
  if (age < DAY) return `fetched ${plural(Math.floor(age / HOUR), 'hour')} ago`;
  return `fetched ${plural(Math.floor(age / DAY), 'day')} ago`;
}

function header({ slug, base, fetchedAt }, now) {
  return ['omni status', ...(slug ? [slug] : []), `${base}, ${fetchedAgo(fetchedAt, now)}`].join(' · ');
}

/** The counts, `GAP` apart: every one of the seven stages in order, idea pointing at the app and
 * building followed by its open items while it holds a PRD. A count that would push the line past
 * `WIDTH` starts the next one. */
function counts(values) {
  const parts = STAGES.map((stage) => {
    const word = STAGE_WORDS[stage].toUpperCase();
    if (stage === 'idea') return `${word} ${IDEA_COUNT}`;
    if (stage === 'building' && values.building > 0) return `${word} ${values.building} · ${plural(values.openItems, 'open item')}`;
    return `${word} ${values[stage]}`;
  });
  const out = [];
  for (const part of parts) {
    const joined = out.length ? `${out.at(-1)}${GAP}${part}` : null;
    if (joined !== null && joined.length <= WIDTH) out[out.length - 1] = joined;
    else out.push(`${INDENT}${part}`);
  }
  return out;
}

/** The bar and the lines under it, which wrap at `WIDTH` under the bar; one line, `nothing yet`,
 * with no PRD at all. */
function bar({ bar: { delivered, total, percent, filled }, inProgress }) {
  if (total === 0) return ['  nothing yet: /omni:brainstorm to start'];
  const cells = `${'█'.repeat(filled)}${'░'.repeat(BAR_CELLS - filled)}`;
  const top = `${LABEL}${cells}  ${delivered} of ${total} · ${percent}%`;
  if (inProgress.total === 0) return [top, `${UNDER_BAR}nothing in progress`];
  const parts = [[inProgress.inbox, 'in the inbox'], [inProgress.building, 'being built'], [inProgress.outbox, 'in the outbox']].filter(([count]) => count > 0).map(([count, where]) => `${count} ${where}`);
  const under = [`${UNDER_BAR}${inProgress.total} in progress: ${parts[0]}`];
  for (const part of parts.slice(1)) {
    const joined = `${under.at(-1)}, ${part}`;
    if (joined.length <= WIDTH) under[under.length - 1] = joined;
    else {
      under[under.length - 1] += ',';
      under.push(`${UNDER_BAR}${part}`);
    }
  }
  return [top, ...under];
}

/** Each row of yours starts with its stage, in a column as wide as the widest stage and a gap: the
 * rows' own columns then start under the line under the bar. */
/** The gap between a row's PRD number and its topic, and between its topic and what it says. */
const NUMBER_GAP = '  ';
const TOPIC_GAP = '    ';
/** Between two shipped PRDs of yours on one line. */
const SEPARATOR = ' · ';

/** `text` cut to `width` columns, its last one `…`, when it is wider. */
const cut = (text, width) => (text.length <= width ? text : `${text.slice(0, Math.max(0, width - 1))}…`);

/** A row's first columns: the indent and its stage, padded so what follows starts under the bar. */
const stageColumn = (stage) => `${INDENT}${STAGE_WORDS[stage].padEnd(UNDER_BAR.length - INDENT.length)}`;

/** Where a PRD of yours stands, in words. */
function standing({ stage, prd, openItems }) {
  const waiting = openItems > 0 ? `${plural(openItems, 'open item')} wait${openItems === 1 ? 's' : ''} for an answer` : null;
  if (stage === 'outbox') return waiting ?? 'its feature PR waits for your review';
  if (stage === 'building') return waiting ?? 'being built';
  if (stage === 'inbox') return `ready to build: /omni:yolo ${prd}`;
  return 'its phase-0 PR waits for a merge';
}

/** The rows of yours in the outbox, building, the inbox and PRD, their numbers, topics and words each in
 * a column. A topic that would push a row past `WIDTH` is cut with `…`. */
function rows(entries) {
  const lines = entries.map((row) => ({ stage: stageColumn(row.stage), number: `#${row.prd}`, topic: row.topic, words: standing(row) }));
  const numberWidth = Math.max(...lines.map(({ number }) => number.length)) + NUMBER_GAP.length;
  const wordsWidth = Math.max(...lines.map(({ words }) => words.length));
  const room = WIDTH - UNDER_BAR.length - numberWidth - TOPIC_GAP.length - wordsWidth;
  const topicWidth = Math.min(Math.max(...lines.map(({ topic }) => topic.length)), Math.max(1, room));
  return lines.map(({ stage, number, topic, words }) => `${stage}${number.padEnd(numberWidth)}${cut(topic, topicWidth).padEnd(topicWidth)}${TOPIC_GAP}${words}`);
}

/** `#<n> <topic>`, its topic cut with `…` when the whole would be wider than `width`. */
function shippedEntry({ prd, topic }, width) {
  const number = `#${prd} `;
  return `${number}${cut(topic, width - number.length)}`;
}

/** The shipped row: how many PRDs of yours shipped, then every one of them, newest first, `SEPARATOR`
 * apart, wrapped at `WIDTH` with each next line starting under the bar. */
function shippedRow(shipped) {
  const out = [];
  let line = `${stageColumn('shipped')}${shipped.length}: `;
  let fresh = true;
  for (const entry of shipped) {
    if (!fresh) {
      const joined = `${line}${SEPARATOR}${shippedEntry(entry, Infinity)}`;
      if (joined.length <= WIDTH) {
        line = joined;
        continue;
      }
      out.push(line);
      line = UNDER_BAR;
    }
    line = `${line}${shippedEntry(entry, WIDTH - line.length)}`;
    fresh = false;
  }
  out.push(line);
  return out;
}

/** The PRDs that are yours: one line when it cannot tell whose they are, else a heading naming you,
 * then a row per PRD in progress or at PRD and one row for the delivered, or `none yet`. */
function yours({ state, email, rows: inFlight, shipped }) {
  if (state === 'no-email') return [`${INDENT}set git config user.email to see yours`];
  if (state === 'shallow') return [`${INDENT}this clone is shallow: git fetch --unshallow to see yours`];
  const heading = cut(`${INDENT}Yours · ${email}`, WIDTH);
  if (inFlight.length === 0 && shipped.length === 0) return [heading, `${INDENT}none yet`];
  return [heading, ...(inFlight.length ? rows(inFlight) : []), ...(shipped.length ? shippedRow(shipped) : [])];
}

/** The overview `overviewFor` returns, as the lines `omni status` prints. */
export function formatOverview(overview, { now }) {
  return [
    header(overview, now),
    '',
    ...counts(overview.counts),
    '',
    ...bar(overview),
    '',
    ...yours(overview.yours),
    '',
    'omni help: the loop and every command',
  ].join('\n');
}
