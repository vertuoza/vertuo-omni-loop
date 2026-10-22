// A PRD's timeline, as its page draws it (PRD 2370, s5): the line under the stage words and the Timeline
// tab's pane, both pure functions of the PRD's stored milestones and `now`. The gaps come from
// ./timeline.ts, never computed here; the words for a moment not reached are the fix pages' (`not yet`,
// `not recorded`, ../fixes/timeline.ts).
import type { PrNumber } from 'omni-loop/kit/lib/ids.ts';
import { durationWords } from '../engineering/duration';
import { timeline, type Gap, type GapId, type Milestone, type Timeline } from './timeline';
import type { MilestoneId, MilestoneRow } from './store';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => String(n).padStart(2, '0');

/** `29 Sep 2026, 09:15 UTC`, in UTC: the same on the server and in any browser. */
function whenWords(iso: string): string {
  const at = new Date(iso);
  return `${at.getUTCDate()} ${MONTHS[at.getUTCMonth()]} ${at.getUTCFullYear()}, ${pad(at.getUTCHours())}:${pad(at.getUTCMinutes())} UTC`;
}

/** The muted words of a milestone not reached, as the fix pages write them. */
const MOMENT_WORDS = { 'not-yet': 'not yet', 'not-recorded': 'not recorded' } as const;

const LABELS:Readonly<Record<MilestoneId, string>> = {
  idea: 'Idea', plan: 'Plan', approved: 'Approved', opened: 'Opened', 'first-slice': 'First slice',
  'last-slice': 'Last slice', ready: 'Ready', merged: 'Merged',
};

/** One milestone of the tab: its date linked to its pull request, or `not yet` / `not recorded`. */
export type MilestoneLine = {
  kind: 'milestone';
  id: MilestoneId;
  label: string;
  state: 'done' | 'not-yet' | 'not-recorded';
  /** `29 Sep 2026, 09:15 UTC`; null when not reached. */
  when: string | null;
  /** The pull request that dates it; null for the PRD's own milestones and when not reached. */
  href: string | null;
  /** The muted words of a milestone not reached; null when it was. */
  words: string | null;
};

/** One gap, between two milestones: its duration and who it waits on, the longest marked. */
export type GapLine = {
  kind: 'gap';
  id: GapId;
  label: string;
  state: Gap['state'];
  /** `2.0 d`, `running 1.0 d`, or `not recorded`. */
  words: string;
  waitsOn: string;
  longest: boolean;
};

export type TimelineLine = MilestoneLine | GapLine;

/** The PRD's own milestones, or one lane's (a repository). */
export type TimelineSection = { title: string; lane: string | null; lines: TimelineLine[] };

/** The Timeline tab: its sections, or why it holds none. */
export type TimelineView =
  | { state: 'sections'; sections: TimelineSection[] }
  | { state: 'empty'; words: string }
  | { state: 'unread'; words: string };

const TIMELINE_EMPTY = 'No milestone is recorded for this PRD yet. The sync fills them in within 15 minutes of GitHub.';
const TIMELINE_UNREAD = 'The milestones could not be read. Reload the page in a moment.';

const toMilestone = (row: MilestoneRow): Milestone => ({ lane: row.lane, milestone: row.milestone, reachedAt: row.reached_at, pr: row.pr });

/** The PRD's timeline from its stored milestones; null when it holds none. */
function timelineOf(rows: readonly MilestoneRow[], now: number): Timeline | null {
  return rows.length === 0 ? null : timeline(rows.map(toMilestone), now);
}

/** The line under the stage words: `Idea → merged: 12.0 d · Longest: Review, 5.0 d`, or while running
 * `Running for 4.0 d · Now: Building, 1.0 d`; null when no milestone is recorded. */
export function headerLine(rows: readonly MilestoneRow[] | null | undefined, now: number): string | null {
  if (!rows) return null;
  const t = timelineOf(rows, now);
  if (t === null || t.total === null) return null;
  const longest = t.longest?.ms == null ? '' : ` · Longest: ${t.longest.label}, ${durationWords(t.longest.ms)}`;
  if (!t.total.running) return `Idea → merged: ${durationWords(t.total.ms)}${longest}`;
  const current = t.now?.ms == null ? '' : ` · Now: ${t.now.label}, ${durationWords(t.now.ms)}`;
  return `Running for ${durationWords(t.total.ms)}${current}`;
}

const PRD_LEVEL: readonly MilestoneId[] = ['idea', 'plan', 'approved'];
const LANE_LEVEL: readonly MilestoneId[] = ['opened', 'first-slice', 'last-slice', 'ready', 'merged'];

/** The gap that sits after each milestone, on the line that reaches the next. */
const GAP_AFTER: Readonly<Partial<Record<MilestoneId, GapId>>> = {
  idea: 'writing', plan: 'approval', opened: 'starting', 'first-slice': 'building', 'last-slice': 'finishing', ready: 'review',
};

const href = (lane: string, pr: PrNumber | null) => (pr === null ? null : `https://github.com/${lane}/pull/${pr}`);

function gapLine(gap: Gap, longest: Gap | null): GapLine {
  const words = gap.state === 'not-recorded' ? MOMENT_WORDS['not-recorded']
    : gap.state === 'running' ? `running ${durationWords(gap.ms)}` : durationWords(gap.ms);
  return { kind: 'gap', id: gap.id, label: gap.label, state: gap.state, words, waitsOn: gap.waitsOn, longest: longest === gap };
}

function section(title: string, lane: string | null, ids: readonly MilestoneId[], rows: readonly MilestoneRow[], gaps: readonly Gap[], longest: Gap | null): TimelineSection {
  const mine = rows.filter((r) => ids.includes(r.milestone));
  const lines: TimelineLine[] = [];
  const reachedLater = (id: MilestoneId) => mine.some((r) => ids.indexOf(r.milestone) > ids.indexOf(id));
  for (const id of ids) {
    const row = mine.find((r) => r.milestone === id);
    if (row) {
      lines.push({ kind: 'milestone', id, label: LABELS[id], state: 'done', when: whenWords(row.reached_at), href: href(row.lane, row.pr), words: null });
    } else {
      const state = reachedLater(id) ? 'not-recorded' : 'not-yet';
      lines.push({ kind: 'milestone', id, label: LABELS[id], state, when: null, href: null, words: MOMENT_WORDS[state] });
    }
    const gapId = GAP_AFTER[id];
    const gap = gapId === undefined ? undefined : gaps.find((g) => g.id === gapId);
    if (gap) lines.push(gapLine(gap, longest));
  }
  return { title, lane, lines };
}

/** The Timeline tab: the PRD's milestones, then one lane per repository, each gap between its two
 * milestones with its duration and who it waits on, the longest marked. */
export function timelineView(rows: readonly MilestoneRow[] | null | undefined, now: number): TimelineView {
  if (!rows) return { state: 'unread', words: TIMELINE_UNREAD };
  const t = timelineOf(rows, now);
  if (t === null) return { state: 'empty', words: TIMELINE_EMPTY };
  const own = section('The PRD', null, PRD_LEVEL, rows, t.gaps, t.longest);
  const lanes = t.lanes.map((l) => section(l.lane, l.lane, LANE_LEVEL, rows.filter((r) => r.lane === l.lane), l.gaps, t.longest));
  return { state: 'sections', sections: [own, ...lanes] };
}

/** What a PRD's page reads of its milestones: the tab, the line under the stage words and how many there
 * are. `rows` left out means the page did not ask for them: nothing is drawn, no tab is dimmed. */
export function pageTimeline(rows: readonly MilestoneRow[] | null | undefined, now: number): { view: TimelineView | null; line: string | null; count: number | null } {
  if (rows === undefined) return { view: null, line: null, count: null };
  return { view: timelineView(rows, now), line: headerLine(rows, now), count: rows?.length ?? null };
}
