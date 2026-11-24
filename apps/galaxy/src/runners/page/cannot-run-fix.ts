import type { Board, Job, Runner } from '../runners.contract';
import { UPDATE_COMMAND } from './health';
import { START_COMMAND } from './model';

// The one fix a Cannot run job offers beside Cancel (PRD 3232 s2), chosen by the reason `cannotRunReason` gave: a command to copy, a
// fleet picker to focus (a workspace owner only), or the same job sent to any runner.

export type CannotRunFix =
  | { kind: 'copy'; label: string; command: string }
  | { kind: 'fleet'; runner: string }
  | { kind: 'any' };

/** The fix for a Cannot run job's reason, or null when the reason has none (or the viewer may not take it). */
export function cannotRunFix(
  job: Pick<Job, 'repo'>,
  reason: string | null,
  runners: readonly Pick<Runner, 'id' | 'repos'>[],
  viewer: Pick<Board['viewer'], 'owner'>,
): CannotRunFix | null {
  if (reason === null) return null;
  if (reason === `No runner holds ${job.repo}` || (reason.endsWith(` does not hold ${job.repo}`) && !reason.startsWith('No runner'))) {
    return { kind: 'copy', label: 'Copy runner command', command: START_COMMAND };
  }
  if (reason === "Update the runner's kit") return { kind: 'copy', label: 'Copy omni update', command: UPDATE_COMMAND };
  if (reason === 'The runner it was sent to is gone' || /^Fleet .+ is gone$/.test(reason)) return { kind: 'any' };
  if (reason.startsWith('No runner of ') && reason.endsWith(` holds ${job.repo}`)) {
    const holder = runners.find((runner) => runner.repos.includes(job.repo));
    return viewer.owner && holder !== undefined ? { kind: 'fleet', runner: holder.id } : null;
  }
  return null;
}
