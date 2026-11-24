import type { Board } from '../../runners/runners.contract';
import { runnerJob } from '../../runners/page/terminal-model';
import { WORDS as MISSION_WORDS } from '../../missions/page/missions-tab';
import type { ListFleetRead } from '../list/list';
import type { FleetJobRow, FleetRunnerRow, FleetRunnersView } from './runners-view';

// An AI fleet's Runners tab and its Runs on line (PRD 3233 s4, screens 4.A to 4.E of the before/after page): what the fleet's page
// draws of the runners view of s2, in words. Pure, so each edge state is tested without a page. The head (mission line and Runs on)
// shows under the fleet's name on every tab; the tab's body lists its own runners, the Shared runners running its work and the jobs
// waiting for a slot.

export const TAB_WORDS = {
  own: 'Its own runners',
  shared: 'Shared runners running its work',
  waiting: 'Waiting for a slot',
  answers: 'Waiting on you',
  runsOn: 'Runs on',
  noRunnerYet: 'No runner yet',
  startOne: 'Start one:',
  giveIt: 'Give it a runner: ',
  giveItLink: 'Runners',
  sharedMark: 'Shared',
  nothingRuns: 'Nothing runs.',
  answer: 'Answer',
} as const;

/** Where the Runners page lives, for the line under the tab. */
export const RUNNERS_PATH = '/app/runners';

const plural = (n: number, one: string, many: string) => `${String(n)} ${n === 1 ? one : many}`;

/** One runner of the Runs on line: its state dot, name and slots (or `Shared, 1 job`). */
export interface RunsOnChip {
  id: string;
  name: string;
  tone: string;
  words: string;
  shared: boolean;
}

/** The mission line under the fleet's name: title, `3 of 6 merged`, `1 waits on you`; null with no mission moving. */
export interface HeadMission {
  title: string;
  merged: string | null;
  waits: string | null;
}

export interface FleetHead {
  mission: HeadMission | null;
  runsOn: RunsOnChip[];
  /** What the Runs on line says with no runner: `No runner yet` (none in the workspace) or the view's warning; null when it lists some. */
  none: string | null;
}

/** The mission a head shows: the one that is moving (running, waiting on a person or paused). */
const LIVE = new Set(['running', 'waiting', 'paused']);

/** A runner's words on the Runs on line: `Busy, 3 of 3`, `1 of 2`, `Shared, 1 job`; an offline or paused runner says so. */
function chipWords(row: FleetRunnerRow): string {
  if (row.shared) return `${TAB_WORDS.sharedMark}, ${plural(row.jobs.length, 'job', 'jobs')}`;
  if (row.offline || row.state === 'online' && row.stateWords !== 'Online') return row.stateWords;
  return row.state === 'busy' ? `${row.stateWords}, ${row.slotsWords}` : row.slotsWords;
}

/** The head under the fleet's name: its mission line and the runners it runs on, each linking to the Runners tab. */
export function fleetHeadOf(view: FleetRunnersView, missions: ListFleetRead['missions']): FleetHead {
  const live = missions.find((mission) => LIVE.has(mission.status));
  const answers = view.answers.length + (live?.waits.length ?? 0);
  const merged = live === undefined || live.progress === MISSION_WORDS.writingRoadmap ? null : (live.progress.split(' · ')[0] ?? null);
  return {
    mission: live === undefined ? null : { title: live.title, merged, waits: answers === 0 ? null : `${String(answers)} waits on you` },
    runsOn: view.runsOn.map((row) => ({ id: row.id, name: row.name, tone: row.tone, words: chipWords(row), shared: row.shared })),
    none: view.runsOn.length > 0 ? null : view.empty === 'none-in-workspace' ? TAB_WORDS.noRunnerYet : view.warning,
  };
}

/** A runner of the tab: its row, the free-slot or idle line, and the job its Terminal button opens. */
export interface TabRunner {
  row: FleetRunnerRow;
  /** `Nothing runs.`, `1 slot free.`, or null. */
  note: string | null;
  /** The job its Terminal opens (its running job, else its last); null with none. */
  terminalJob: string | null;
}

export interface RunnersTab {
  own: TabRunner[];
  shared: TabRunner[];
  waiting: FleetJobRow[];
  /** The fleet's jobs that wait on the viewer's answer, each with `Answer`. */
  answers: FleetJobRow[];
  /** `No runner of its own.` or `No runner in this workspace.`; null otherwise. */
  emptyWords: string | null;
  startCommand: string | null;
  /** `Out of tokens until 14:00` when the fleet's runners are all out of tokens and a job waits; null otherwise. */
  tokens: string | null;
  notes: string[];
}

/** `Nothing runs.` for a runner with no job of the fleet, `1 slot free.` when one runs and a slot is open. */
function noteOf(row: FleetRunnerRow): string | null {
  if (row.jobs.length === 0) return TAB_WORDS.nothingRuns;
  const free = row.slots - row.used;
  return row.offline || free <= 0 ? null : `${plural(free, 'slot', 'slots')} free.`;
}

const tabRunner = (row: FleetRunnerRow, board: Board): TabRunner => ({
  row, note: noteOf(row), terminalJob: runnerJob({ id: row.id }, board.jobs)?.id ?? null,
});

/** The tab, from the runners view and the board it was read from (for each runner's Terminal). */
export function runnersTabOf(view: FleetRunnersView, board: Board): RunnersTab {
  const tokens = view.waiting.find((job) => job.reason?.startsWith('Out of tokens') === true)?.reason ?? null;
  return {
    own: view.own.map((row) => tabRunner(row, board)), shared: view.shared.map((row) => tabRunner(row, board)), waiting: view.waiting, answers: view.answers,
    emptyWords: view.emptyWords, startCommand: view.startCommand, tokens, notes: view.notes,
  };
}
