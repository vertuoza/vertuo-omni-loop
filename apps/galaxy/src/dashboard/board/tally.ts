import { faceOf, type Face } from '../../people/face';
import { SOLO, type FleetTag } from '../../people/types';
import type { StageId, StoredStage } from '../../stages/stage';
import { UNREADABLE, type Read } from '../part';
import { brusselsDay, type PeriodWindow } from './period';
import { at, defined } from 'vertuo-omni-plan/kit/lib/narrow.ts';

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
// them so): opened when the issue opened, started when its phase-0 merged, shipped when its feature PR
// merged. They draw the per-day chart only: events of the period, never where a PRD is now.
//
// Where a PRD is now (PRD 587) is its current stage (src/stages/stage.ts): the latest stored one for a
// numbered PRD, idea for a draft with an answered question. The PRDs tile counts the scope's PRDs at
// each of the seven stages, and the People table groups each person's into open (idea, PRD, inbox),
// building (building, outbox) and shipped (shipped, retro). A PRD is the scope's when it opened it: by
// the GitHub login its prd-opened row credits, or by the account that opened its dossier.

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
  /** Their player row's stored hero, unchecked (PRD 652); null or absent with none. */
  hero?: unknown;
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

/** The PRD events of the per-day chart, and the kind of `contributions` row that marks each. */
export type PrdEvent = 'opened' | 'started' | 'shipped';
const EVENT_OF: Readonly<Record<string, PrdEvent>> = {
  'prd-opened': 'opened',
  'prd-started': 'started',
  'prd-shipped': 'shipped',
};
export const EVENTS: readonly PrdEvent[] = ['opened', 'started', 'shipped'];

export type Events = Record<PrdEvent, number>;
const noEvents = (): Events => ({ opened: 0, started: 0, shipped: 0 });

/** One day of the PRs merged chart. */
export interface ChartDay { date: string; count: number }
/** One day of the PRD events chart. */
export type EventDay = { date: string } & Events;

export function mergesPerDay(rows: readonly DayActivity[], days: readonly string[]): ChartDay[] {
  const counts = new Map(days.map((d) => [d, 0]));
  for (const r of rows) {
    const count = counts.get(r.day);
    if (r.kind === MERGED && count !== undefined) counts.set(r.day, count + 1);
  }
  return days.map((date) => ({ date, count: defined(counts.get(date), `the merges of ${date}`) }));
}

export function prdEventsPerDay(rows: readonly DayActivity[], days: readonly string[]): EventDay[] {
  const byDay = new Map(days.map((d) => [d, noEvents()]));
  for (const r of rows) {
    const event = EVENT_OF[r.kind];
    const day = byDay.get(r.day);
    if (event && day) day[event] += 1;
  }
  return days.map((date) => ({ date, ...defined(byDay.get(date), `the PRD events of ${date}`) }));
}

export function eventCounts(rows: readonly Activity[]): Events {
  const events = noEvents();
  for (const r of rows) {
    const event = EVENT_OF[r.kind];
    if (event) events[event] += 1;
  }
  return events;
}

// ── PRDs now (PRD 587) ────────────────────────────────────────────────────

/** A PRD as the board counts it: its current stage, and who opened it, as far as is known. */
export interface PrdNow {
  stage: StageId;
  /** The GitHub login its prd-opened row credits, in lower case; null when none was read. */
  login: string | null;
  /** The account that opened its dossier; null with no dossier, or one nobody opened. */
  userId: string | null;
}

/** What PRDs now are made of: the stored current stages, the prd-opened rows and the dossiers. */
export interface PrdsInput {
  stages: readonly { repository: string; prd: number; stage: StoredStage }[];
  openers: readonly Pick<Activity, 'repo' | 'number' | 'login'>[];
  dossiers: readonly { home_repo: string; prd: number | null; opened_by: string | null; answered: number }[];
}

const repoName = (repository: string) => at(repository.toLowerCase().split('/'), -1, `the name of ${repository}`);

/** Each stored PRD at its current stage with who opened it, then each draft with an answered question
 * at idea. A prd-opened row names the repository as the workspace's sectors do (its name, no owner). */
export function prdsNow({ stages, openers, dossiers }: PrdsInput): PrdNow[] {
  const logins = new Map(openers.map((o) => [`${repoName(o.repo)}#${o.number}`, o.login.toLowerCase()]));
  const openedBy = new Map(dossiers.flatMap((d) => (d.prd === null ? [] : [[`${d.home_repo.toLowerCase()}#${d.prd}`, d.opened_by]])));
  const numbered = stages.map((s): PrdNow => ({
    stage: s.stage,
    login: logins.get(`${repoName(s.repository)}#${s.prd}`) ?? null,
    userId: openedBy.get(`${s.repository.toLowerCase()}#${s.prd}`) ?? null,
  }));
  const ideas = dossiers.filter((d) => d.prd === null && d.answered > 0).map((d): PrdNow => ({ stage: 'idea', login: null, userId: d.opened_by }));
  return [...numbered, ...ideas];
}

/** Whether the scope opened this PRD: the workspace every one, else by login or by account. */
export function openedBy(circle: Circle, prd: PrdNow): boolean {
  if (circle.logins === 'all' || circle.userIds === 'all') return true;
  return (prd.login !== null && circle.logins.has(prd.login.toLowerCase())) || (prd.userId !== null && circle.userIds.has(prd.userId));
}

/** How many PRDs sit at each of the seven stages now, in track order. */
export type StageTally = Record<StageId, number>;

/** One value for each of the seven stages, in track order: a record the compiler holds to every stage. */
export function perStage<T>(value: (stage: StageId) => T): Record<StageId, T> {
  return {
    idea: value('idea'), prd: value('prd'), inbox: value('inbox'), building: value('building'),
    outbox: value('outbox'), shipped: value('shipped'), retro: value('retro'),
  };
}

export function stageTally(prds: readonly PrdNow[]): StageTally {
  const tally = perStage(() => 0);
  for (const p of prds) tally[p.stage] += 1;
  return tally;
}

/** The People table's three groups of a person's PRDs now. */
export type PrdGroup = 'open' | 'building' | 'shipped';
export const GROUPS: readonly PrdGroup[] = ['open', 'building', 'shipped'];
const GROUP_OF: Readonly<Record<StageId, PrdGroup>> = {
  idea: 'open', prd: 'open', inbox: 'open', building: 'building', outbox: 'building', shipped: 'shipped', retro: 'shipped',
};
export type PrdGroups = Record<PrdGroup, number>;

export function groupsOf(prds: readonly PrdNow[]): PrdGroups {
  const groups: PrdGroups = { open: 0, building: 0, shipped: 0 };
  for (const p of prds) groups[GROUP_OF[p.stage]] += 1;
  return groups;
}

/** A repository the work touched in the period. */
export interface RepoRow { repo: string; prs: number; prdEvents: number }

export function repositoriesOf(rows: readonly Activity[]): RepoRow[] {
  const repos = new Map<string, RepoRow>();
  for (const r of rows) {
    const merged = r.kind === MERGED, event = EVENT_OF[r.kind];
    if (!merged && !event) continue;
    const row = repos.get(r.repo) ?? { repo: r.repo, prs: 0, prdEvents: 0 };
    if (merged) row.prs += 1;
    else row.prdEvents += 1;
    repos.set(r.repo, row);
  }
  return [...repos.values()].sort((a, b) => b.prs + b.prdEvents - (a.prs + a.prdEvents) || a.repo.localeCompare(b.repo));
}

/** The four tiles: the PRDs tile counts the scope's PRDs by where they are now. */
export interface Tiles { prs: number; prds: StageTally; repositories: number; answered: number }

export function tilesOf(rows: readonly Activity[], answered: number, prds: readonly PrdNow[]): Tiles {
  return {
    prs: rows.filter((r) => r.kind === MERGED).length,
    prds: stageTally(prds),
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

/** A fleet as a row names it: its label, in its colour (null when the galaxy does not say), and its
 * mascot (PRD 652). The chips' own type (src/people/types.ts). */
export { SOLO, type FleetTag };

/** One member's row. A GitHub-counted column is null (a dash) for a member with no login, and
 * 'unreadable' for everyone when its read failed. PRDs count the PRDs they opened, by login or by
 * account, so a member with no login still has theirs. */
export interface PersonRow {
  userId: string;
  name: string;
  login: string | null;
  avatarUrl: string | null;
  /** Their face, as faceOf decides it (PRD 652): their hero, else their GitHub photo, else their initial. */
  face: Face;
  fleet: FleetTag | typeof SOLO;
  points: number | null | typeof UNREADABLE;
  prs: number | null | typeof UNREADABLE;
  prds: PrdGroups | typeof UNREADABLE;
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
  /** The workspace's PRDs now: each member's own are picked by who opened them. */
  prds: Read<readonly PrdNow[]>;
}

const rank = (n: PersonRow['prs']) => (typeof n === 'number' ? n : -1);

const nameOf = (m: Member) => m.name?.trim() || m.login || 'A member';

const fleetOf = (m: Member, fleets: ReadonlyMap<string, FleetTag>): PersonRow['fleet'] =>
  !m.fleet ? SOLO : fleets.get(m.fleet) ?? { name: m.fleet, label: m.fleet.toUpperCase(), color: null, mascot: null };

/** The member's PRDs now, grouped: the ones they opened, by login or by account. */
function prdsOfMember(prds: PeopleInput['prds'], login: string | null, userId: string): PersonRow['prds'] {
  if (prds === UNREADABLE) return UNREADABLE;
  return groupsOf(prds.filter((p) => (login !== null && p.login?.toLowerCase() === login) || p.userId === userId));
}

const answeredOf = (answered: PeopleInput['answered'], userId: string): PersonRow['answered'] =>
  answered === UNREADABLE ? UNREADABLE : answered.get(userId) ?? 0;

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
    const name = nameOf(m);
    const fleet = fleetOf(m, fleets);
    return {
      userId: m.userId,
      name,
      login,
      avatarUrl: m.avatarUrl,
      face: faceOf({ name, login, avatarUrl: m.avatarUrl, hero: m.hero, color: fleet === SOLO ? null : fleet.color }),
      fleet,
      points: byGithub(input.heroes === UNREADABLE, () => points.get(defined(login, "the member's login")) ?? 0),
      prs: byGithub(input.activity === UNREADABLE, () => mine.filter((r) => r.kind === MERGED).length),
      prds: prdsOfMember(input.prds, login, m.userId),
      answered: answeredOf(input.answered, m.userId),
      you: m.userId === viewerId,
    };
  });
  return rows.sort((a, b) => rank(b.prs) - rank(a.prs) || rank(b.points) - rank(a.points)
    || a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
}
