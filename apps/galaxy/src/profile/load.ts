import { boardOf, readBoard, type BoardRead, type BoardReads, type BoardValue } from '../dashboard/board/load';
import { periodWindow, type Period } from '../dashboard/board/period';
import type { Member } from '../dashboard/board/tally';
import { settle, UNREADABLE, type Read } from '../dashboard/part';
import type { Place } from '../dashboard/you';
import type { PullRequestRow, ReviewRow } from '../engineering/tally';
import { faceOf, type Face } from '../people/face';
import { SOLO, type FleetTag } from '../people/types';
import type { CurrentStages, HistoryItem } from '../dossier/page/history';
import type { DossierListRow } from '../dossier/store';
import { ofWork } from '../dossier/page/work';
import type { FixFacts, FixItem } from '../fixes/list';
import {
  fixesOf, moreHref, prdsOf, profileStageLinks, pullRequestsOf, reviewsOf, seeAllHref, type Capped, type ProfilePullRequest, type ProfileReview,
} from './select';

// A person's profile (PRD 698 s3), read in the viewer's workspace: the board's five reads (the roster
// among them, which says whether the login is a member), and the tracked repositories, then that
// person's pull requests and reviews of the period in them. The reads start together, each on its
// own (settle). A login no member holds is "not in this workspace", and the page shows nothing read.
// Their board is Home's with scope *you*, built with their id and login, its PRDs counts opening /prd
// for them. No read here calls GitHub, and none is new: every member reads these rows today on
// /app/workspace and /app/engineering. The reads are a port (ProfileReads) so the loader is tested on
// fakes; the page's are in ./profile.ts.
// PRD 698 s5: with them, the workspace's dossiers (dossier_list, as the viewer, as /prd reads them), each
// numbered one's stored stage, and what GitHub says of each fix through the fix lists' own cached reader
// (so no GitHub read /bugs and /visual do not already make), for the PRDs they opened and the fixes they
// asked for. The stages and the facts are the lists' best effort: when they cannot be read, the rows show
// no stage, or `—`. The dossiers unreadable, the three lists say so.

export interface ProfileReads extends BoardReads {
  /** The workspace's tracked repositories, `owner/name`. */
  tracked(): Promise<string[]>;
  /** The person's pull requests in those repositories, opened or merged within [from, to). */
  pullRequests(login: string, from: Date, to: Date, repos: string[]): Promise<PullRequestRow[]>;
  /** The person's first reviews in those repositories, given within [from, to). */
  reviews(login: string, from: Date, to: Date, repos: string[]): Promise<ReviewRow[]>;
  /** The workspace's dossiers: its PRDs and its fixes, as /prd, /bugs and /visual read them. */
  dossiers(): Promise<DossierListRow[]>;
  /** Each numbered dossier's current stored stage, by stageKeyOf. */
  stages(rows: DossierListRow[]): Promise<CurrentStages>;
  /** What GitHub says of each fix, by dossier id, through the fix lists' reader. */
  fixFacts(rows: DossierListRow[]): Promise<FixFacts>;
}

export interface ProfileRequest {
  /** The login the path names, in lower case. */
  login: string;
  viewerId: string | null;
  period: Period;
  now: Date;
}

/** A pull request list: its rows and whether more exist, with where **see all** goes. */
export type WorkList<T> = Capped<T> & { moreHref: string };

/** Their pull requests and reviews; none to show when the workspace tracks no repository. */
export type ProfileWork =
  | { kind: 'no-repository' }
  | { kind: 'lists'; pullRequests: Read<WorkList<ProfilePullRequest>>; reviews: Read<WorkList<ProfileReview>> };

/** The header: who they are, their fleet and their season place (null when not ranked). */
export interface ProfileHead {
  login: string;
  name: string;
  face: Face;
  fleet: FleetTag | typeof SOLO;
  place: Read<Place | null>;
}

/** A list of their dossiers: its rows, whether more exist, and where **see all** goes. */
export type DossierList<T> = Capped<T> & { moreHref: string };

/** The PRDs they opened, and the bug fixes and visual updates they asked for, of the period. */
export interface ProfileLists {
  prd: DossierList<HistoryItem>;
  bug: DossierList<FixItem>;
  visual: DossierList<FixItem>;
}

export type ProfileValue =
  | { kind: 'not-member'; login: string }
  | { kind: 'unreadable'; login: string }
  | { kind: 'profile'; person: ProfileHead; board: BoardValue; work: Read<ProfileWork>; lists: Read<ProfileLists> };

/** What a profile is drawn from: the board's reads, and the work of the period (unreadable when the
 * tracked repositories could not be read). */
export interface ProfileRead {
  board: BoardRead;
  work: Read<{ tracked: string[]; pullRequests: Read<PullRequestRow[]>; reviews: Read<ReviewRow[]> }>;
  /** The workspace's dossiers, their stages and their fixes' facts (unreadable when the dossiers are). */
  dossiers: Read<{ rows: DossierListRow[]; stages: CurrentStages; facts: FixFacts }>;
}

function fleetOf(member: Member, board: BoardRead): FleetTag | typeof SOLO {
  if (!member.fleet) return SOLO;
  const team = board.galaxy === UNREADABLE ? undefined : board.galaxy.teams.find((t) => t.name === member.fleet);
  return { name: member.fleet, label: team?.label ?? member.fleet.toUpperCase(), color: team?.color ?? null, mascot: team?.mascot ?? null };
}

/** Their place among the season's heroes, ranked as the galaxy ranks them (points, then name), as
 * Home's hero block reads its own; null with no points yet. */
export function placeOf(heroes: readonly { name: string; points: number }[], login: string): Place | null {
  const ranked = [...heroes].sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  const at = ranked.findIndex((h) => h.name.toLowerCase() === login);
  if (at < 0 || ranked[at].points <= 0) return null;
  return { rank: at + 1, of: ranked.length };
}

function workOf(read: ProfileRead['work'], request: ProfileRequest): Read<ProfileWork> {
  if (read === UNREADABLE) return UNREADABLE;
  if (read.tracked.length === 0) return { kind: 'no-repository' };
  const window = periodWindow(request.period, request.now);
  const { login } = request;
  return {
    kind: 'lists',
    pullRequests: read.pullRequests === UNREADABLE ? UNREADABLE
      : { ...pullRequestsOf(read.pullRequests, login, window), moreHref: moreHref('authored', login, read.tracked) },
    reviews: read.reviews === UNREADABLE ? UNREADABLE
      : { ...reviewsOf(read.reviews, login, window), moreHref: moreHref('reviewed', login, read.tracked) },
  };
}

function listsOf(read: ProfileRead['dossiers'], member: Member, request: ProfileRequest): Read<ProfileLists> {
  if (read === UNREADABLE) return UNREADABLE;
  const window = periodWindow(request.period, request.now);
  const { login } = request;
  const whom = new Set([member.userId]);
  return {
    prd: { ...prdsOf(read.rows, login, whom, window, read.stages), moreHref: seeAllHref('prd', login) },
    bug: { ...fixesOf(read.rows, 'bug', login, whom, window, read.facts), moreHref: seeAllHref('bug', login) },
    visual: { ...fixesOf(read.rows, 'visual', login, whom, window, read.facts), moreHref: seeAllHref('visual', login) },
  };
}

/** The profile, from what was read: pure, so the loader and the demo draw it the same way. */
export function profileOf(read: ProfileRead, request: ProfileRequest): ProfileValue {
  const { login } = request;
  if (read.board.roster === UNREADABLE) return { kind: 'unreadable', login };
  const member = read.board.roster.find((m) => m.login?.toLowerCase() === login);
  if (!member) return { kind: 'not-member', login };
  const fleet = fleetOf(member, read.board);
  const name = member.name?.trim() || login;
  const galaxy = read.board.galaxy;
  const scope = { kind: 'you', userId: member.userId, login } as const;
  const board = boardOf(read.board, { scope, people: scope, viewerId: request.viewerId, period: request.period, now: request.now });
  return {
    kind: 'profile',
    person: {
      login,
      name,
      face: faceOf({ name, login, avatarUrl: member.avatarUrl, hero: member.hero, color: fleet === SOLO ? null : fleet.color }),
      fleet,
      place: galaxy === UNREADABLE ? UNREADABLE : placeOf(galaxy.heroes, login),
    },
    board: { ...board, stageLinks: profileStageLinks(login) },
    work: workOf(read.work, request),
    lists: listsOf(read.dossiers, member, request),
  };
}

/** Their pull requests and reviews of the period, once the tracked repositories are known. */
async function readWork(reads: ProfileReads, request: ProfileRequest): Promise<ProfileRead['work']> {
  const tracked = await settle('the tracked repositories', () => reads.tracked());
  if (tracked === UNREADABLE || tracked.length === 0) return tracked === UNREADABLE ? UNREADABLE : { tracked, pullRequests: [], reviews: [] };
  const { from, to } = periodWindow(request.period, request.now);
  const [pullRequests, reviews] = await Promise.all([
    settle('their pull requests', () => reads.pullRequests(request.login, from, to, tracked)),
    settle('their reviews', () => reads.reviews(request.login, from, to, tracked)),
  ]);
  return { tracked, pullRequests, reviews };
}

/** The workspace's dossiers, then their stages and their fixes' facts together; either failing reads as none. */
async function readDossiers(reads: ProfileReads): Promise<ProfileRead['dossiers']> {
  const rows = await settle('the dossiers', () => reads.dossiers());
  if (rows === UNREADABLE) return UNREADABLE;
  const fixes = [...ofWork(rows, 'bug'), ...ofWork(rows, 'visual')];
  const [stages, facts] = await Promise.all([
    fixes.length === rows.length ? new Map() : settle('the PRDs\' stages', () => reads.stages(rows)),
    fixes.length === 0 ? new Map() : settle('the fixes on GitHub', () => reads.fixFacts(fixes)),
  ]);
  return { rows, stages: stages === UNREADABLE ? new Map() : stages, facts: facts === UNREADABLE ? new Map() : facts };
}

/** The profile's reads together, each on its own, then profileOf. */
export async function loadProfile(reads: ProfileReads, request: ProfileRequest): Promise<ProfileValue> {
  const [board, work, dossiers] = await Promise.all([readBoard(reads, request), readWork(reads, request), readDossiers(reads)]);
  return profileOf({ board, work, dossiers }, request);
}
