// A PRD's status on main, as its page words it (PRD 2410, s3): Watching · n days left, Clean, Broke main
// or Could not check, and the breaks behind a Broke main. A PRD's status is the worst of its lanes':
// one lane that broke breaks the PRD; else a lane whose signal could not be read is Could not check (a
// missing read never reads clean); else a lane still watched is Watching; else Clean. A PRD nobody
// watched (it is not merged) has none.
import type { PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import { stamp } from '../dossier/page/dates';
import type { BreakKind, BreakRow, MainWatchRead, ParentResult, WatchRow } from './store';

export type MainState = 'watching' | 'clean' | 'broke' | 'unchecked';

/** One break, as the Main tab lists it. `lane` is set only when the PRD merged into several repositories. */
export type BreakView = { kind: BreakKind; label: string; title: string; url: string; lane: string | null; parent: string | null; at: string };

export type MainWatchView = {
  /** The PRD's number, for the `/omni:rewind <n>` line. */
  prd: PrdNumber;
  state: MainState;
  /** The head's words: `Watching · 3 days left`, `Clean`, `Broke main` or `Could not check`. */
  words: string;
  /** What more the tab says under the words; null when nothing. */
  detail: string | null;
  /** Each signal GitHub would not let the App read, in the lanes still watched. */
  unread: string[];
  breaks: BreakView[];
};

const DAY = 24 * 60 * 60 * 1000;

const KIND_LABELS: Readonly<Record<BreakKind, string>> = { 'ci-red': 'CI red', revert: 'Reverted', regression: 'Regression' };
const PARENT_WORDS: Readonly<Record<ParentResult, string>> = {
  green: 'the parent commit was green', red: 'the parent commit was already red', unknown: 'the parent commit\'s result is unknown',
};

/** The whole days left of a watch: rounded up, never below 0. */
export function daysLeft(watchUntil: string, now: number): number {
  return Math.max(0, Math.ceil((Date.parse(watchUntil) - now) / DAY));
}

const plural = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;

function breakView(row: BreakRow, lanes: number): BreakView {
  return {
    kind: row.kind,
    label: KIND_LABELS[row.kind],
    title: row.title,
    url: row.url,
    lane: lanes > 1 ? row.lane : null,
    parent: row.kind === 'ci-red' && row.parent !== null ? PARENT_WORDS[row.parent] : null,
    at: stamp(row.at),
  };
}

/** The PRD's lanes still watched, the one with the most days left first. */
const stillWatched = (watches: readonly WatchRow[]) =>
  watches.filter((w) => w.status === 'watching').sort((a, b) => Date.parse(b.watch_until) - Date.parse(a.watch_until));

/** The PRD's status on main; null when it holds no watch. */
export function mainWatchView(read: MainWatchRead | null | undefined, prd: PrdNumber, now: number): MainWatchView | null {
  if (!read || read.watches.length === 0) return null;
  const { watches } = read;
  const breaks = [...read.breaks].sort((a, b) => Date.parse(a.at) - Date.parse(b.at)).map((row) => breakView(row, watches.length));
  const watching = stillWatched(watches);
  const unread = watching.flatMap((w) => w.unread);
  const first = breaks[0];
  if (watches.some((w) => w.status === 'broke') || breaks.length > 0) {
    return { prd, state: 'broke', words: 'Broke main', detail: first ? `First signal: ${first.at}.` : null, unread, breaks };
  }
  if (unread.length > 0) {
    return { prd, state: 'unchecked', words: 'Could not check', detail: 'GitHub would not let the Omni App read every signal, so main is not called clean.', unread, breaks };
  }
  const longest = watching[0];
  if (longest) {
    const left = daysLeft(longest.watch_until, now);
    return { prd, state: 'watching', words: `Watching · ${plural(left)} left`, detail: null, unread, breaks };
  }
  return { prd, state: 'clean', words: 'Clean', detail: 'Seven days on main with no signal.', unread, breaks };
}
