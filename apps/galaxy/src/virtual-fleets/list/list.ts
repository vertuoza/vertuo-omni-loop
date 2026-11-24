import { roleOf, type HeroRole } from 'omni-loop/kit/lib/virtual-fleet/roles.ts';
import type { Board } from '../../runners/runners.contract';
import type { PrdTitles } from '../../runners/page/model';
import { WORDS as MISSION_WORDS, type MissionView } from '../../missions/page/missions-tab';
import { AI_FLEET_PATH } from '../../dashboard/fleet/redirect';
import type { FleetTag } from '../../people/types';
import { fleetRunnersView, type FleetRunnerRow } from '../runners/runners-view';

// The AI Fleet list (PRD 3233 s3, `/app/ai-fleet`): one row per AI fleet of the workspace, from one read of the Runners board
// (never one per row): its heroes' roles, its mission line, what waits on the viewer and the runners it runs on. Pure, so each
// row is tested without a page. The season place and rank are not shown: they belong to the players' fleets.

export const WORDS = {
  title: 'AI Fleet',
  empty: 'No AI fleet yet.',
  noMission: 'No mission yet.',
  goalOnly: 'Goal only: PM writing PRDs',
  nothing: 'Nothing',
  open: 'Open',
  shared: 'Shared',
  players: 'Players’ fleets: ',
  playersLink: 'Fleet',
} as const;

/** What the list reads of one fleet: its look, its heroes' roles and its missions (newest first). */
export interface ListFleetRead {
  tag: FleetTag;
  roles: readonly HeroRole[];
  missions: readonly Pick<MissionView, 'id' | 'title' | 'status' | 'progress' | 'waits'>[];
}

/** One runner of the Runs on cell: its state dot, name and slots, a Shared one marked. */
export interface RunsOnItem {
  id: string;
  name: string;
  tone: string;
  /** `Busy, 3 of 3`. */
  words: string;
  shared: boolean;
  /** A Shared runner: `1 for Orion`. */
  forFleet: string | null;
}

export interface MissionCell {
  kind: 'mission' | 'goal-only' | 'none';
  title: string | null;
  /** `3 of 6 merged · 2 ready`, or the line of a goal-only mission or of none. */
  line: string;
}

export interface AiFleetRow {
  name: string;
  tag: FleetTag;
  /** The roles of its heroes, as the Heroes tab names them. */
  heroes: string[];
  mission: MissionCell;
  /** `1 answer`, `1 approval`, or `Nothing`. */
  waits: string;
  waitCount: number;
  runsOn: RunsOnItem[];
  /** The runners view's one warning line, or null. */
  warning: string | null;
  href: string;
}

export interface AiFleetList {
  fleets: AiFleetRow[];
  /** `<k> of <n> fleets wait on you`. */
  line: string;
}

/** A mission is the one shown while it is moving: running, waiting on a person or paused; else none. */
const LIVE = new Set(['running', 'waiting', 'paused']);

const plural = (n: number, one: string, many: string) => `${String(n)} ${n === 1 ? one : many}`;

/** The mission a row shows, and its line. */
export function missionCellOf(missions: ListFleetRead['missions']): MissionCell {
  const live = missions.find((mission) => LIVE.has(mission.status));
  if (live === undefined) return { kind: 'none', title: null, line: WORDS.noMission };
  if (live.progress === MISSION_WORDS.writingRoadmap) return { kind: 'goal-only', title: live.title, line: WORDS.goalOnly };
  return { kind: 'mission', title: live.title, line: live.progress };
}

const runsOnOf = (row: FleetRunnerRow): RunsOnItem => ({
  id: row.id, name: row.name, tone: row.tone, words: `${row.stateWords}, ${row.slotsWords}`, shared: row.shared, forFleet: row.forFleetWords,
});

/** What waits on the viewer: the jobs waiting for their answer, and the approvals the mission's PRDs wait on. */
export function waitsOf(answers: number, approvals: number): string {
  const parts = [...(answers > 0 ? [plural(answers, 'answer', 'answers')] : []), ...(approvals > 0 ? [plural(approvals, 'approval', 'approvals')] : [])];
  return parts.length === 0 ? WORDS.nothing : parts.join(' · ');
}

/** The list, from one read of the Runners board. */
export function aiFleetList(board: Board, fleets: readonly ListFleetRead[], now: Date, prds: PrdTitles = {}): AiFleetList {
  const known = fleets.map((fleet) => ({ name: fleet.tag.name, label: fleet.tag.label }));
  const rows = fleets.map((read): AiFleetRow => {
    const live = read.missions.find((mission) => LIVE.has(mission.status));
    const ids = read.missions.map((mission) => mission.id);
    const view = fleetRunnersView(board, { name: read.tag.name, label: read.tag.label }, ids, now, prds, known);
    const approvals = live === undefined ? 0 : live.waits.length;
    return {
      name: read.tag.name, tag: read.tag, heroes: read.roles.map((role) => roleOf(role).name), mission: missionCellOf(read.missions),
      waits: waitsOf(view.answers.length, approvals), waitCount: view.answers.length + approvals, runsOn: view.runsOn.map(runsOnOf), warning: view.warning,
      href: `${AI_FLEET_PATH}?fleet=${encodeURIComponent(read.tag.name)}`,
    };
  });
  return { fleets: rows, line: `${String(rows.filter((row) => row.waitCount > 0).length)} of ${String(rows.length)} fleets wait on you` };
}
