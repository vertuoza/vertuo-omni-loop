// The overview as text: the header, the counts, the bar and the pointer to help. Plain text with no
// colour, so it reads the same in a terminal and inside Claude, and no line wider than 80 columns.
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

/** The counts, `GAP` apart: shipped and inbox always, the outbox with its open items and in review
 * only when they hold a PRD. A count that would push the line past `WIDTH` starts the next one. */
function counts({ shipped, inbox, outbox, openItems, inReview }) {
  const parts = [
    `SHIPPED ${shipped}`,
    `INBOX ${inbox}`,
    ...(outbox > 0 ? [`OUTBOX ${outbox} · ${plural(openItems, 'open item')}`] : []),
    ...(inReview > 0 ? [`IN REVIEW ${inReview}`] : []),
  ];
  const out = [];
  for (const part of parts) {
    const joined = out.length ? `${out.at(-1)}${GAP}${part}` : null;
    if (joined !== null && joined.length <= WIDTH) out[out.length - 1] = joined;
    else out.push(`${INDENT}${part}`);
  }
  return out;
}

/** The bar and the line under it; one line, `nothing yet`, with no PRD at all. */
function bar({ bar: { delivered, total, percent, filled }, inProgress }) {
  if (total === 0) return ['  nothing yet: /omni:brainstorm to start'];
  const cells = `${'█'.repeat(filled)}${'░'.repeat(BAR_CELLS - filled)}`;
  const parts = [[inProgress.inbox, 'in the inbox'], [inProgress.outbox, 'in the outbox']].filter(([count]) => count > 0).map(([count, where]) => `${count} ${where}`);
  const under = inProgress.total === 0 ? 'nothing in progress' : `${inProgress.total} in progress: ${parts.join(', ')}`;
  return [`${LABEL}${cells}  ${delivered} of ${total} · ${percent}%`, `${UNDER_BAR}${under}`];
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
    'omni help: the loop and every command',
  ].join('\n');
}
