import type { Fleet, GalaxyView } from '@omni/galaxy';
import type { SupabaseClient } from '@supabase/supabase-js';
import { dossierList } from '../../dossier/store';
import { STAGES, type StageId } from '../../stages/stage';
import { stageStore, type StageStore } from '../../stages/store';
import { settle, UNREADABLE, type Read } from '../part';
import { rankFleets, type FleetRank } from '../rankings/rank';
import { seasonBounds, type Season } from '../season';
import { stageHref } from './links';
import { periodWindow, type Period, type PeriodWindow } from './period';
import {
  answeredIn, circleOf, inCircle, inPeriod, membersOf, MERGED, mergesPerDay, openedBy, peopleRows, prdEventsPerDay, prdsNow, repositoriesOf, stageTally,
  type Activity, type ChartDay, type DayActivity, type EventDay, type FleetTag, type Member, type PersonRow, type PrdNow, type RepoRow, type Scope,
  type StageTally,
} from './tally';

// The board's read (PRD 572): five reads, in parallel, as the signed-in person, each on its own. A
// read that fails leaves only the parts drawn from it saying they could not load, its error logged
// (settle), and the rest renders:
//
// | read                                       | the parts drawn from it                                       |
// |--------------------------------------------|---------------------------------------------------------------|
// | roster (workspace_roster)                  | People; with a fleet scope, everything the scope filters      |
// | contributions over the period's days       | PRs merged, PRDs and Repositories tiles, both charts, the     |
// |                                            | repositories, People's PRs and PRDs                           |
// | answered counts (answered_counts)          | Questions answered tile, People's questions                   |
// | the galaxy (season points, read once)      | People's points and fleets' colours, the fleet ranking        |
// | PRDs now (PRD 587: the stored stages, the  | PRDs tile, People's PRDs                                      |
// | prd-opened rows, the dossiers)             |                                                               |
//
// PRDs now are not of the period: each PRD at its current stage, read through the stage store
// (src/stages/store.ts), with who opened it. A board drawn without them (a caller that does not read
// them) says its PRDs parts could not load, never a count of zero.
// The reads are a port (BoardReads) so the loader is tested on fakes; supabaseReads is the one the
// pages use.

/** One member's questions answered in the window, as answered_counts returns it. */
export interface AnsweredCount { user_id: string; answered: number }

/** The season as the board needs it from the galaxy: the heroes' points, the fleets' look and rank. */
export type SeasonView = {
  heroes: readonly { name: string; points: number }[];
  teams: readonly Pick<Fleet, 'name' | 'label' | 'color' | 'points' | 'rank'>[];
};

/** The board's five reads. Each rejects when it cannot be read. */
export interface BoardReads {
  roster(): Promise<Member[]>;
  activity(from: Date, to: Date): Promise<Activity[]>;
  answered(from: Date, to: Date): Promise<AnsweredCount[]>;
  galaxy(): Promise<SeasonView>;
  prds(): Promise<PrdNow[]>;
}

/** What a board is drawn from: each read's value, or 'unreadable'; PRDs now left out read as unreadable. */
export interface BoardRead {
  roster: Read<Member[]>;
  activity: Read<Activity[]>;
  answered: Read<AnsweredCount[]>;
  galaxy: Read<SeasonView>;
  prds?: Read<PrdNow[]>;
}

/** What a board is drawn for. */
export interface BoardRequest {
  /** Whose tiles, charts and repositories. */
  scope: Scope;
  /** Whose rows the People table lists: the scope's, or (on Home) your team's. */
  people: Scope;
  /** The person looking: their row is marked. */
  viewerId: string | null;
  period: Period;
  now: Date;
}

export interface BoardTiles {
  prs: Read<number>;
  /** The scope's PRDs at each of the seven stages now. */
  prds: Read<StageTally>;
  repositories: Read<number>;
  answered: Read<number>;
}

/** Everything a board shows, each part as its value or 'unreadable'. */
export interface BoardValue {
  window: PeriodWindow;
  season: Season;
  tiles: BoardTiles;
  /** Where each stage's count opens: /prd filtered to that stage and the scope. */
  stageLinks: Record<StageId, string>;
  merges: Read<ChartDay[]>;
  prdEvents: Read<EventDay[]>;
  repositories: Read<RepoRow[]>;
  people: Read<PersonRow[]>;
  /** The season's fleet ranking, the viewer's fleet marked. */
  fleets: Read<FleetRank[]>;
}

const fleetTags = (season: Read<SeasonView>): FleetTag[] =>
  (season === UNREADABLE ? [] : season.teams.map((t) => ({ name: t.name, label: t.label, color: t.color })));

/** The board, from what was read: pure, so the loader and the demo draw it the same way. */
export function boardOf(read: BoardRead, request: BoardRequest): BoardValue {
  const window = periodWindow(request.period, request.now);
  const season = seasonBounds(request.now);
  const needsRoster = (s: Scope) => s.kind === 'fleet';
  const circle = needsRoster(request.scope) && read.roster === UNREADABLE
    ? UNREADABLE
    : circleOf(request.scope, read.roster === UNREADABLE ? [] : read.roster);

  const period = read.activity === UNREADABLE ? UNREADABLE : inPeriod(read.activity, window);
  const scoped: Read<DayActivity[]> = period === UNREADABLE || circle === UNREADABLE ? UNREADABLE : period.filter((r) => inCircle(circle, r));
  const counts = read.answered === UNREADABLE ? UNREADABLE : new Map(read.answered.map((a) => [a.user_id, a.answered]));
  const tally = <T>(draw: (rows: DayActivity[]) => T): Read<T> => (scoped === UNREADABLE ? UNREADABLE : draw(scoped));
  const prds = read.prds ?? UNREADABLE;

  const me = read.roster === UNREADABLE ? undefined : read.roster.find((m) => m.userId === request.viewerId);
  const people: Read<PersonRow[]> = read.roster === UNREADABLE ? UNREADABLE : peopleRows(membersOf(request.people, read.roster), {
    activity: period,
    answered: counts,
    heroes: read.galaxy === UNREADABLE ? UNREADABLE : read.galaxy.heroes,
    fleets: fleetTags(read.galaxy),
    prds,
  }, request.viewerId);

  return {
    window,
    season,
    tiles: {
      prs: tally((rows) => rows.filter((r) => r.kind === MERGED).length),
      prds: prds === UNREADABLE || circle === UNREADABLE ? UNREADABLE : stageTally(prds.filter((p) => openedBy(circle, p))),
      repositories: tally((rows) => repositoriesOf(rows).length),
      answered: counts === UNREADABLE || circle === UNREADABLE ? UNREADABLE : answeredIn(counts, circle),
    },
    stageLinks: Object.fromEntries(STAGES.map((s) => [s, stageHref(request.scope, s)])) as Record<StageId, string>,
    merges: tally((rows) => mergesPerDay(rows, window.days)),
    prdEvents: tally((rows) => prdEventsPerDay(rows, window.days)),
    repositories: tally(repositoriesOf),
    people,
    fleets: read.galaxy === UNREADABLE ? UNREADABLE : rankFleets(read.galaxy.teams, me?.fleet ?? null),
  };
}

/** The board's read: the five reads in parallel, each on its own, then boardOf. */
export async function loadBoard(reads: BoardReads, request: BoardRequest): Promise<BoardValue> {
  const window = periodWindow(request.period, request.now);
  const [roster, activity, answered, galaxy, prds] = await Promise.all([
    settle('the workspace\'s members', () => reads.roster()),
    settle('the contributions', () => reads.activity(window.from, window.to)),
    settle('the questions answered', () => reads.answered(window.from, window.to)),
    settle('the season', () => reads.galaxy()),
    settle('the PRDs\' stages', () => reads.prds()),
  ]);
  return boardOf({ roster, activity, answered, galaxy, prds }, request);
}

// ── The reads, from Supabase ──────────────────────────────────────────────

const PAGE = 1000;

type RosterRow = { user_id: string; name: string | null; github_login: string | null; avatar_url: string | null; fleet: string | null };

/** A PRD's key in the stage store (`owner/name#7`) back to its repository and number. */
function unkey(key: string): { repository: string; prd: number } {
  const at = key.lastIndexOf('#');
  return { repository: key.slice(0, at), prd: Number(key.slice(at + 1)) };
}

/** The board's reads of one workspace, as the signed-in person. `galaxy` is the page's, read once;
 * the stored stages are read through the stage store, as that person. */
export function supabaseReads(
  db: SupabaseClient, workspace: string, galaxy: () => Promise<GalaxyView>, stages: Pick<StageStore, 'currentStages'> = stageStore(db),
): BoardReads {
  async function openers(): Promise<Pick<Activity, 'repo' | 'number' | 'login'>[]> {
    const rows: Pick<Activity, 'repo' | 'number' | 'login'>[] = [];
    for (let start = 0; ; start += PAGE) {
      const { data, error } = await db
        .from('contributions')
        .select('repo, number, login')
        .eq('workspace_id', workspace)
        .eq('kind', 'prd-opened')
        .order('repo', { ascending: true })
        .order('number', { ascending: true })
        .range(start, start + PAGE - 1);
      if (error) throw new Error(`Supabase: could not read who opened the PRDs (${error.message})`);
      rows.push(...((data ?? []) as Pick<Activity, 'repo' | 'number' | 'login'>[]));
      if (!data || data.length < PAGE) return rows;
    }
  }
  return {
    async roster() {
      const { data, error } = await db.rpc('workspace_roster', { workspace });
      if (error) throw new Error(`Supabase: could not read the workspace's members (${error.message})`);
      return ((data ?? []) as RosterRow[]).map((r) => ({
        userId: r.user_id, name: r.name, login: r.github_login?.toLowerCase() ?? null, avatarUrl: r.avatar_url, fleet: r.fleet,
      }));
    },
    async activity(from, to) {
      const rows: Activity[] = [];
      for (let start = 0; ; start += PAGE) {
        const { data, error } = await db
          .from('contributions')
          .select('kind, repo, number, login, at')
          .eq('workspace_id', workspace)
          .gte('at', from.toISOString())
          .lt('at', to.toISOString())
          .order('at', { ascending: true })
          .order('kind', { ascending: true })
          .order('repo', { ascending: true })
          .order('number', { ascending: true })
          .range(start, start + PAGE - 1);
        if (error) throw new Error(`Supabase: could not read the contributions (${error.message})`);
        rows.push(...((data ?? []) as Activity[]));
        if (!data || data.length < PAGE) return rows;
      }
    },
    async answered(from, to) {
      const { data, error } = await db.rpc('answered_counts', { workspace, from_at: from.toISOString(), to_at: to.toISOString() });
      if (error) throw new Error(`Supabase: could not read the questions answered (${error.message})`);
      return ((data ?? []) as AnsweredCount[]).map((r) => ({ user_id: r.user_id, answered: Number(r.answered) }));
    },
    galaxy,
    async prds() {
      const [current, opened, dossiers] = await Promise.all([stages.currentStages(workspace), openers(), dossierList(db)]);
      return prdsNow({
        stages: [...current].map(([key, stage]) => ({ ...unkey(key), stage })),
        openers: opened,
        dossiers: dossiers.filter((d) => d.workspace_id === workspace),
      });
    },
  };
}
