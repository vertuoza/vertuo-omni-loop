import { UNREADABLE, type Read } from '../part';
import { brusselsDay, type PeriodWindow } from './period';

// The board's numbers (PRD 572), in pure functions over what the loader read: the workspace's roster
// (workspace_roster), its `contributions` over the period, the answered counts per member
// (answered_counts) and the season's heroes and fleets (the galaxy). A board is drawn for a scope:
//
// | scope          | its activity (merges, PRD events)          | its people and questions      |
// |----------------|--------------------------------------------|-------------------------------|
// | you            | rows of your login                         | your account                  |
// | a fleet        | rows of the logins of the fleet's members  | the fleet's members           |
// | the workspace  | every row, a non-member's merges included  | every member                  |
//
// Logins match ignoring case. PRD events are credited to the PRD issue's author (the poller writes
// them so): drafted when the issue opened, in progress when its phase-0 merged, shipped when its
// feature PR merged.

/** A workspace member, as workspace_roster returns them. */
export interface Member {
  userId: string;
  /** The player's arcade name, else the account's full name; null with neither. */
  name: string | null;
  /** Their GitHub login, in lower case; null with none linked. */
  login: string | null;
  avatarUrl: string | null;
  /** Their fleet (`players.team`); null for a solo player or a member with no player row. */
  fleet: string | null;
}

/** A row of `contributions`, as the board reads it. */
export interface Activity {
  kind: string;
  repo: string;
  number: number;
  login: string;
  /** An ISO instant, as the row stores it. */
  at: string;
}

/** A row of the period, with the Brussels day it fell on. */
export type DayActivity = Activity & { day: string };

export type Scope =
  | { kind: 'you'; userId: string; login: string | null }
  | { kind: 'fleet'; fleet: string }
  | { kind: 'workspace' };

/** Who a scope holds: the logins its activity is counted by, and the accounts its questions are. */
export interface Circle {
  logins: Set<string> | 'all';
  userIds: Set<string> | 'all';
}

export function circleOf(scope: Scope, roster: readonly Member[]): Circle {
  switch (scope.kind) {
    case 'workspace':
      return { logins: 'all', userIds: 'all' };
    case 'you':
      return { logins: new Set(scope.login ? [scope.login.toLowerCase()] : []), userIds: new Set([scope.userId]) };
    case 'fleet': {
      const members = roster.filter((m) => m.fleet === scope.fleet);
      return {
        logins: new Set(members.flatMap((m) => (m.login ? [m.login.toLowerCase()] : []))),
        userIds: new Set(members.map((m) => m.userId)),
      };
    }
  }
}

export const inCircle = (circle: Circle, row: Pick<Activity, 'login'>) =>
  circle.logins === 'all' || circle.logins.has(row.login.toLowerCase());

/** The members a scope's People table lists. */
export function membersOf(scope: Scope, roster: readonly Member[]): Member[] {
  const { userIds } = circleOf(scope, roster);
  return userIds === 'all' ? [...roster] : roster.filter((m) => userIds.has(m.userId));
}

/** The rows that fell on one of the period's Brussels days, each with its day. */
export function inPeriod(rows: readonly Activity[], window: Pick<PeriodWindow, 'days'>): DayActivity[] {
  const days = new Set(window.days);
  return rows.flatMap((row) => {
    const day = brusselsDay(row.at);
    return day !== null && days.has(day) ? [{ ...row, day }] : [];
  });
}

export const MERGED = 'pr-merged';

/** The PRD stages, and the kind of `contributions` row that marks each. */
export type Stage = 'drafted' | 'inProgress' | 'shipped';
export const STAGE_OF: Readonly<Record<string, Stage>> = {
  'prd-opened': 'drafted',
  'prd-started': 'inProgress',
  'prd-shipped': 'shipped',
};
export const STAGES: readonly Stage[] = ['drafted', 'inProgress', 'shipped'];

export type Stages = Record<Stage, number>;
const noStages = (): Stages => ({ drafted: 0, inProgress: 0, shipped: 0 });

/** One day of the PRs merged chart. */
export interface ChartDay { date: string; count: number }
/** One day of the PRD events chart. */
export type StageDay = { date: string } & Stages;

export function mergesPerDay(rows: readonly DayActivity[], days: readonly string[]): ChartDay[] {
  const counts = new Map(days.map((d) => [d, 0]));
  for (const r of rows) if (r.kind === MERGED && counts.has(r.day)) counts.set(r.day, counts.get(r.day)! + 1);
  return days.map((date) => ({ date, count: counts.get(date)! }));
}

export function prdEventsPerDay(rows: readonly DayActivity[], days: readonly string[]): StageDay[] {
  const byDay = new Map(days.map((d) => [d, noStages()]));
  for (const r of rows) {
    const stage = STAGE_OF[r.kind];
    const day = byDay.get(r.day);
    if (stage && day) day[stage] += 1;
  }
  return days.map((date) => ({ date, ...byDay.get(date)! }));
}

export function stageCounts(rows: readonly Activity[]): Stages {
  const stages = noStages();
  for (const r of rows) {
    const stage = STAGE_OF[r.kind];
    if (stage) stages[stage] += 1;
  }
  return stages;
}

/** A repository the work touched in the period. */
export interface RepoRow { repo: string; prs: number; prdEvents: number }

export function repositoriesOf(rows: readonly Activity[]): RepoRow[] {
  const repos = new Map<string, RepoRow>();
  for (const r of rows) {
    const merged = r.kind === MERGED, stage = STAGE_OF[r.kind];
    if (!merged && !stage) continue;
    const row = repos.get(r.repo) ?? { repo: r.repo, prs: 0, prdEvents: 0 };
    if (merged) row.prs += 1;
    else row.prdEvents += 1;
    repos.set(r.repo, row);
  }
  return [...repos.values()].sort((a, b) => b.prs + b.prdEvents - (a.prs + a.prdEvents) || a.repo.localeCompare(b.repo));
}

/** The four tiles. */
export interface Tiles { prs: number; prds: Stages; repositories: number; answered: number }

export function tilesOf(rows: readonly Activity[], answered: number): Tiles {
  return {
    prs: rows.filter((r) => r.kind === MERGED).length,
    prds: stageCounts(rows),
    repositories: repositoriesOf(rows).length,
    answered,
  };
}

/** The questions answered by the scope's accounts. */
export function answeredIn(counts: ReadonlyMap<string, number>, circle: Circle): number {
  let sum = 0;
  for (const [userId, n] of counts) if (circle.userIds === 'all' || circle.userIds.has(userId)) sum += n;
  return sum;
}

// ── People ────────────────────────────────────────────────────────────────

/** A fleet as a row names it: its label, in its colour (null when the galaxy does not say). */
export interface FleetTag { name: string; label: string; color: string | null }
export const SOLO = 'solo';

/** One member's row. A GitHub-counted column is null (a dash) for a member with no login, and
 * 'unreadable' for everyone when its read failed. */
export interface PersonRow {
  userId: string;
  name: string;
  login: string | null;
  avatarUrl: string | null;
  fleet: FleetTag | typeof SOLO;
  points: number | null | typeof UNREADABLE;
  prs: number | null | typeof UNREADABLE;
  prds: Stages | null | typeof UNREADABLE;
  answered: number | typeof UNREADABLE;
  you: boolean;
}

export interface PeopleInput {
  /** The period's rows, unscoped: each member's own are picked by login. */
  activity: Read<readonly DayActivity[]>;
  answered: Read<ReadonlyMap<string, number>>;
  /** The season's heroes, by GitHub login: their points. */
  heroes: Read<readonly { name: string; points: number }[]>;
  fleets: readonly FleetTag[];
}

const rank = (n: PersonRow['prs'] | PersonRow['points']) => (typeof n === 'number' ? n : -1);

export function peopleRows(members: readonly Member[], input: PeopleInput, viewerId: string | null): PersonRow[] {
  const byLogin = new Map<string, DayActivity[]>();
  if (input.activity !== UNREADABLE) {
    for (const r of input.activity) {
      const key = r.login.toLowerCase();
      byLogin.set(key, [...(byLogin.get(key) ?? []), r]);
    }
  }
  const points = new Map<string, number>();
  if (input.heroes !== UNREADABLE) for (const h of input.heroes) points.set(h.name.toLowerCase(), h.points);
  const fleets = new Map(input.fleets.map((f) => [f.name, f]));

  const rows = members.map((m): PersonRow => {
    const login = m.login?.toLowerCase() ?? null;
    const mine = login ? byLogin.get(login) ?? [] : [];
    const byGithub = <T>(unreadable: boolean, value: () => T): T | null | typeof UNREADABLE =>
      (!login ? null : unreadable ? UNREADABLE : value());
    return {
      userId: m.userId,
      name: m.name?.trim() || m.login || 'A member',
      login,
      avatarUrl: m.avatarUrl,
      fleet: !m.fleet ? SOLO : fleets.get(m.fleet) ?? { name: m.fleet, label: m.fleet.toUpperCase(), color: null },
      points: byGithub(input.heroes === UNREADABLE, () => points.get(login!) ?? 0),
      prs: byGithub(input.activity === UNREADABLE, () => mine.filter((r) => r.kind === MERGED).length),
      prds: byGithub(input.activity === UNREADABLE, () => stageCounts(mine)),
      answered: input.answered === UNREADABLE ? UNREADABLE : input.answered.get(m.userId) ?? 0,
      you: m.userId === viewerId,
    };
  });
  return rows.sort((a, b) => rank(b.prs) - rank(a.prs) || rank(b.points) - rank(a.points)
    || a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
}
