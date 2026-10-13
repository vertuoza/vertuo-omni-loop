import { checkLine, type Board, type Runner, type RunnerState, type Target } from '../runners.contract';

// Send to terminal's targets (PRD 1830 s4): what its picker lists for one line of one repository, read
// from the workspace's runners and what the viewer may do there (the Runners page's read, Board). In
// order: Any runner, then each fleet with a runner, then each runner by name with its state. Each only
// when the viewer may send there (the service's rule: anyone to a runner with no fleet or to any runner,
// a fleet's players and the workspace's owners to a fleet or a runner in one), and only runners that
// hold the line's repository, since no other would ever claim the job. Any runner shows only when a
// runner with no fleet would take it: a runner in a fleet never takes a job sent to any runner.

/** One choice of the picker: the target the route takes, its words, and its state when it has one. */
export type SendOption = { key: string; group: 'any' | 'fleet' | 'runner'; label: string; state: string | null; target: Target };

/** What Send to terminal needs on a page: the page's repository and the choices the viewer has. */
export type SendSetup = { repo: string; options: SendOption[] };

const STATE_WORDS: Record<RunnerState, string> = { online: 'Online', busy: 'Busy', offline: 'Offline' };

/** Whether a runner may run `line`: a listed skill with checked arguments. */
export const sendable = (line: string): boolean => checkLine(line).ok;

/** Whether the viewer may send to this runner: it has no fleet, or the viewer is its player or an owner. */
const mayUse = (viewer: Board['viewer'], runner: Runner) => runner.fleet === null || viewer.owner || viewer.fleet === runner.fleet;

/** A fleet's state: how many of its runners are up, or Offline when none is. */
function fleetState(runners: readonly Runner[]): string {
  const up = runners.filter((runner) => runner.state !== 'offline').length;
  return up === 0 ? STATE_WORDS.offline : `${String(up)} online`;
}

/** The picker's choices for a line of `repo`, in order; none when the viewer has no runner to send to. */
export function sendOptions({ runners, viewer }: Pick<Board, 'runners' | 'viewer'>, repo: string): SendOption[] {
  const wanted = repo.toLowerCase();
  const usable = runners
    .filter((runner) => runner.repos.some((held) => held.toLowerCase() === wanted) && mayUse(viewer, runner))
    .sort((a, b) => a.name.localeCompare(b.name));
  const fleets = [...new Set(usable.flatMap((runner) => (runner.fleet === null ? [] : [runner.fleet])))].sort((a, b) => a.localeCompare(b));
  const any: SendOption[] = usable.some((runner) => runner.fleet === null)
    ? [{ key: 'any', group: 'any', label: 'Any runner', state: null, target: { kind: 'any' } }]
    : [];
  return [
    ...any,
    ...fleets.map((fleet): SendOption => ({
      key: `fleet:${fleet}`, group: 'fleet', label: fleet, state: fleetState(usable.filter((runner) => runner.fleet === fleet)), target: { kind: 'fleet', fleet },
    })),
    ...usable.map((runner): SendOption => ({
      key: `runner:${runner.id}`, group: 'runner', label: runner.name, state: STATE_WORDS[runner.state], target: { kind: 'runner', runner: runner.id },
    })),
  ];
}

/** `Queued for cyan`, once sent. */
export const queuedWords = (option: SendOption): string => `Queued for ${option.group === 'any' ? 'any runner' : option.label}`;

/** The job on the Runners page. */
export const jobHref = (id: string): string => `/app/runners#job-${id}`;
