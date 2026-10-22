// The retro's part in settling its kept lessons (PRD 2338). Every lesson a retro keeps ends in one of
// two outcomes a person approves by merging the retro PR: it became a playbook rule, or it stays here,
// with the reason why. `/omni:retro-apply --retro <retro PR>` settles them; the retro writes that line
// in the retro PR's body, and queues it for a runner (`runner-queue.ts`), while a kept lesson has none.
//
// A kept lesson is the key of its retro issue in a run's `issues` (the id of the finding the judge
// kept); its outcome is the one any run records under the same key in `outcomes`, so a day-14 run may
// settle what the merge run kept. The kit's `omni check retro` reads them the same way
// (`kit/lib/retro/check-retro.ts`). Pure.
import type { PrNumber } from 'omni-loop/kit/lib/ids.ts';
import type { LessonOutcome } from 'omni-loop/kit/lib/retro/outcome.ts';
import type { IssueLinks } from './retro.types.ts';

/** The skill that settles a retro PR's kept lessons. */
const APPLY_SKILL = 'retro-apply';

/** The line that settles retro PR `retroPr`'s kept lessons, on a runner or in a terminal. */
export function applyLine(retroPr: PrNumber): string {
  return `/omni:${APPLY_SKILL} --retro ${String(retroPr)}`;
}

/** A run, as far as the outcomes are read: its kept lessons' issues and its outcomes. */
type OutcomeRun = { issues?: IssueLinks | undefined; outcomes?: Record<string, LessonOutcome> | undefined };

/** Every outcome the runs record, by the finding of its lesson; a later run's wins. */
export function outcomesOf(runs: readonly OutcomeRun[]): Record<string, LessonOutcome> {
  const outcomes: Record<string, LessonOutcome> = {};
  for (const run of runs) Object.assign(outcomes, run.outcomes);
  return outcomes;
}

/** The kept lessons, by their finding, in run order and each once, that no run gives an outcome. */
export function unsettledLessons(runs: readonly OutcomeRun[]): string[] {
  const settled = outcomesOf(runs);
  const kept = new Set(runs.flatMap((run) => Object.keys(run.issues ?? {})));
  return [...kept].filter((finding) => !(finding in settled));
}
