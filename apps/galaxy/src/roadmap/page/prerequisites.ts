// What a roadmap's Prerequisites tab shows (PRD 1218, s6), built from the stored prerequisites (../store.ts,
// s5's, read here and never changed) and the last result's machine and time, pure: a count line, then the
// rows grouped by category, the groups holding a row that waits on you first and those rows first in
// their group, each with its need, its state, what it blocks, who does it, its author card (open when it
// waits on you or was never checked) and where and when it was last checked. And the roadmap page's two
// tabs, Overview and Prerequisites, picked by `?tab=` as the PRD page's are. And Mark as done (s7): a
// `person` row not ticked yet offers it to a member where marking is open; the row a member just ticked
// shows ticked (`?ticked=`) until the next check records it, and a tick that was not posted says why
// (`?tick_error=`).
import { PREREQUISITE_CATEGORIES, type PrerequisiteCard, type PrerequisiteState, type RoadmapPrerequisiteRow } from '../store';

/** The roadmap page's tabs: today's page, and the prerequisites. */
const ROADMAP_TABS = ['overview', 'prerequisites'] as const;
export type RoadmapTab = (typeof ROADMAP_TABS)[number];

const TAB_LABELS: Record<RoadmapTab, string> = { overview: 'Overview', prerequisites: 'Prerequisites' };

/** The tab `?tab=` names; Overview for anything else. */
export const roadmapTabOf = (value: string | null | undefined): RoadmapTab => (value === 'prerequisites' ? 'prerequisites' : 'overview');

/** A tab of the roadmap page, as its bar links it; `badge` is how many prerequisites wait on you. */
export interface RoadmapTabLink {
  tab: RoadmapTab;
  label: string;
  href: string;
  current: boolean;
  badge: number | null;
}

export function roadmapTabsOf(href: string, current: RoadmapTab, waiting: number): RoadmapTabLink[] {
  return ROADMAP_TABS.map((tab) => ({
    tab,
    label: TAB_LABELS[tab],
    href: tab === 'overview' ? href : `${href}?tab=${tab}`,
    current: tab === current,
    badge: tab === 'prerequisites' && waiting > 0 ? waiting : null,
  }));
}

type Category = RoadmapPrerequisiteRow['category'];

/** Each category's heading, in words for someone who is not technical. */
const CATEGORY_LABELS: Record<Category, string> = {
  local: 'On the machine',
  access: 'Access to packages and repositories',
  permissions: 'Permissions and secrets',
  github: 'GitHub',
  services: 'Services',
};

const WHO_LABELS: Record<RoadmapPrerequisiteRow['who'], string> = {
  agent: 'the agent checks it and fixes it',
  check: 'the agent checks it, a person fixes it',
  person: 'a person ticks it',
};

/** A row's state as the tab shows it: `unchecked` when no result names it yet. */
export type PrerequisiteShown = PrerequisiteState | 'unchecked';

const STATE_LABELS: Record<PrerequisiteShown, string> = {
  ok: 'ok',
  fixed: 'fixed by the agent',
  ticked: 'ticked',
  waits: 'waits on you',
  unchecked: 'not checked yet',
};

/** Where a row sorts: waiting on you, then never checked, then settled. */
const RANK: Record<PrerequisiteShown, number> = { waits: 0, unchecked: 1, ok: 2, fixed: 2, ticked: 2 };

export interface PrerequisiteView {
  id: string;
  need: string;
  state: PrerequisiteShown;
  stateLabel: string;
  who: string;
  /** `blocks every PRD`, `blocks P1.1, P2.2` or `blocks nothing`. */
  blocks: string;
  card: PrerequisiteCard | null;
  /** The card opens by itself: the row waits on you, or was never checked. */
  open: boolean;
  /** `last checked on <machine>, <time>`, or null when no result names it. */
  checked: string | null;
  /** A `person` row not ticked yet, shown to a member where marking is open: Mark as done. */
  tickable: boolean;
}

export interface PrerequisiteGroup {
  category: Category;
  label: string;
  rows: PrerequisiteView[];
}

export interface PrerequisitesView {
  /** `7 ok · 1 fixed · 2 wait on you`; null for a roadmap without prerequisites. */
  count: string | null;
  /** How many rows wait on you. */
  waiting: number;
  groups: PrerequisiteGroup[];
  /** Where and when the last result was found, or null when none was pushed. */
  checked: string | null;
  /** Why the last Mark as done posted nothing, in words, or null. */
  tickError: string | null;
}

/** What the tab knows of Mark as done: whether it is offered, the row just ticked, why one was not posted. */
export interface TickAsk {
  tickable: boolean;
  ticked: string | null;
  tickError: string | null;
}

const NO_TICK: TickAsk = { tickable: false, ticked: null, tickError: null };

const JUST_TICKED = 'ticked by you: the next check records it';

/** Why a tick was not posted (src/roadmap/tick/tick.ts's codes), in words. */
const TICK_ERROR_WORDS: Record<string, string> = {
  signin: 'Sign in first, then mark it as done again.',
  state: 'That authorisation was not this page\'s, so nothing was posted: try again.',
  gone: 'This roadmap could not be read any more, so nothing was posted.',
  'not-person': 'Only a row a person ticks is marked as done, so nothing was posted.',
  refused: 'GitHub\'s authorisation was refused, so nothing was posted.',
  down: 'GitHub did not answer, so nothing was posted. Try again in a moment.',
  'no-access': 'Your GitHub account may not comment on the roadmap\'s issue, so nothing was posted.',
};

const tickErrorWords = (code: string | null): string | null =>
  code === null ? null : (Object.hasOwn(TICK_ERROR_WORDS, code) ? TICK_ERROR_WORDS[code] : undefined) ?? 'Nothing was posted: try again.';

const pad = (n: number) => String(n).padStart(2, '0');

/** `2026-10-20 11:58 UTC`, or null for a time that does not parse. */
function timeOf(at: string): string | null {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

function checkedLine(machine: string | null, checkedAt: string | null): string | null {
  if (machine === null) return null;
  const time = checkedAt === null ? null : timeOf(checkedAt);
  return time === null ? `last checked on ${machine}` : `last checked on ${machine}, ${time}`;
}

function blocksOf(row: RoadmapPrerequisiteRow): string {
  if (row.blocks_all) return 'blocks every PRD';
  return row.blocks.length === 0 ? 'blocks nothing' : `blocks ${row.blocks.join(', ')}`;
}

function countOf(rows: readonly PrerequisiteView[]): string {
  const n = (state: PrerequisiteShown) => rows.filter((r) => r.state === state).length;
  const waiting = n('waits');
  const parts = [`${n('ok')} ok`, `${n('fixed')} fixed`];
  if (n('ticked') > 0) parts.push(`${n('ticked')} ticked`);
  parts.push(`${waiting} ${waiting === 1 ? 'waits' : 'wait'} on you`);
  if (n('unchecked') > 0) parts.push(`${n('unchecked')} not checked yet`);
  return parts.join(' · ');
}

export function prerequisitesOf(
  rows: readonly RoadmapPrerequisiteRow[], machine: string | null, checkedAt: string | null, tick: TickAsk = NO_TICK,
): PrerequisitesView {
  const checked = checkedLine(machine, checkedAt);
  const views = rows.map((row): PrerequisiteView => {
    const person = row.who === 'person';
    const justTicked = person && row.row_id === tick.ticked && row.state !== 'ticked';
    const state: PrerequisiteShown = justTicked ? 'ticked' : row.state ?? 'unchecked';
    return {
      id: row.row_id,
      need: row.need,
      state,
      stateLabel: justTicked ? JUST_TICKED : STATE_LABELS[state],
      who: WHO_LABELS[row.who],
      blocks: blocksOf(row),
      card: row.card,
      open: RANK[state] < 2,
      checked: row.state === null ? null : checked,
      tickable: tick.tickable && person && state !== 'ticked',
    };
  });
  const tickError = tickErrorWords(tick.tickError);
  if (views.length === 0) return { count: null, waiting: 0, groups: [], checked: null, tickError };
  const first = (list: readonly PrerequisiteView[]) => Math.min(...list.map((r) => RANK[r.state]));
  const groups = PREREQUISITE_CATEGORIES.map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    // A stable sort: the table's order holds within a rank.
    rows: views.filter((_, i) => rows[i]?.category === category).sort((a, b) => RANK[a.state] - RANK[b.state]),
  }))
    .filter((g) => g.rows.length > 0)
    .sort((a, b) => first(a.rows) - first(b.rows));
  return { count: countOf(views), waiting: views.filter((r) => r.state === 'waits').length, groups, checked, tickError };
}
