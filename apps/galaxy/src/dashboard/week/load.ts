import { at, dateParts } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import type { PartLoader } from '../part';
import { chartDays, weekDays, type ChartDay, type Merge } from './chart';

// A week of merges (PRD 328, slice s4): the 7-day chart of the pull requests you authored that merged
// into their repository's default branch, in Brussels days, read from `contributions` (kind
// `pr-merged`, which the game workflow fills: supabase/migrations/20260929100000_contributions.sql).
// A sub-PR merges into a feature branch, so the workflow never records one and it never counts. The
// part's value, its read, its view (Week.tsx), its demo (demo.ts) and its styles (week.css) are this
// folder's alone; the dashboard's shared files compose them (src/dashboard/part.ts).

/** What the week shows: its seven days, today last; or, with no GitHub login, the way to link one. */
export type WeekValue =
  | { kind: 'week'; days: ChartDay[] }
  | { kind: 'no-github' };

const HOUR = 3_600_000;

/** An instant no later than the week's first midnight in Brussels, which is never more than two hours
 * ahead of UTC: the read starts there, and chartDays keeps only the rows of the week's days. */
function weekStart(now: Date): string {
  const [year, month, day] = dateParts(at(weekDays(now), 0, "the week's first day"));
  return new Date(Date.UTC(year, month - 1, day) - 2 * HOUR).toISOString();
}

/**
 * The week's read, as the signed-in person: the workspace's merged pull requests authored by your
 * login (ignoring case: `ilike` with no wildcard, and chartDays matches exactly), since the week's
 * start, counted on each Brussels day. With no login it reads nothing; a failed read throws, and the
 * dashboard shows this part alone as unreadable, its error logged (settle).
 */
export const loadWeek: PartLoader<WeekValue> = async ({ db, workspace, login, now }) => {
  if (!login) return { kind: 'no-github' };
  // `data` is widened to null: the rows are read here unparsed.
  const { data, error }: { data: Merge[] | null; error: { message: string } | null } = await db
    .from('contributions')
    .select('kind, login, at')
    .eq('workspace_id', workspace)
    .eq('kind', 'pr-merged')
    .ilike('login', login)
    .gte('at', weekStart(now));
  if (error) throw new Error(`contributions: ${error.message}`);
  return { kind: 'week', days: chartDays(data ?? [], now, login) };
};
