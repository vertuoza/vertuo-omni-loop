// The `omni / budgets` check run's output (PRD 1679 s3): its conclusion, its title and its summary, from
// the ratchet's verdicts. The words are the kit's own, never written twice: each red target's five
// parts come from `redMessage`, the table from `budgetTable`, a target not measured from
// `neutralLines` (kit/lib/budgets/message.ts), in the order `omni check context` prints them, so the
// check and the command say the same thing.
//
// | the verdicts                          | conclusion | title                                                |
// |---------------------------------------|------------|------------------------------------------------------|
// | a target over budget, or a raise with no yes | failure | `1 target over budget · 1 ceiling raised, waiting on a person's yes` |
// | every target under its ceiling        | success    | `within budget`                                      |
// | a target could not be measured        | neutral    | `not measured`: why, and that it blocks nothing (D6) |
// | the whole measure could not run       | neutral    | `not measured`, the reason                           |
// | the ceilings file does not parse      | failure    | `the ceilings file does not parse`, as the command reds it |
import { budgetTable, neutralLines, redMessage, type MessageContext } from 'vertuo-omni-plan/kit/lib/budgets/message.ts';
import { overall, type TargetVerdict } from 'vertuo-omni-plan/kit/lib/budgets/ratchet.ts';
import { MAX_SUMMARY } from '../publish/publish.ts';

/** The check run's name on every pull request of a repository with budgets on. */
export const BUDGETS_CHECK_NAME = 'omni / budgets';

/** What the check run says. */
export type BudgetsOutput = { conclusion: 'success' | 'failure' | 'neutral'; title: string; summary: string };

/** What a measure that never ran says it blocks: nothing. */
const BLOCKS_NOTHING = 'A measurement that fails never blocks a merge.';

/** `count` of `noun`, its plural when not one. */
const counted = (count: number, noun: string, plural = `${noun}s`): string => `${count} ${count === 1 ? noun : plural}`;

/** The red title: how many targets are over budget, and how many raises wait on a person's yes. */
function redTitle(verdicts: readonly TargetVerdict[]): string {
  const over = verdicts.filter(({ verdict }) => verdict === 'over-budget').length;
  const waiting = verdicts.filter(({ verdict }) => verdict === 'needs-yes').length;
  return [
    ...(over > 0 ? [`${counted(over, 'target')} over budget`] : []),
    ...(waiting > 0 ? [`${counted(waiting, 'ceiling')} raised, waiting on a person's yes`] : []),
  ].join(' · ');
}

/** The summary, cut to what GitHub keeps. */
const summaryOf = (lines: readonly string[]): string => lines.join('\n').slice(0, MAX_SUMMARY);

/** The check run the ratchet's verdicts ask for, its red written from `context`. */
export function budgetsOutput(verdicts: readonly TargetVerdict[], context: MessageContext): BudgetsOutput {
  const state = overall(verdicts);
  if (state === 'red') {
    const red = verdicts.filter(({ verdict }) => verdict === 'over-budget' || verdict === 'needs-yes');
    const lines = red.flatMap((verdict, index) => [...(index > 0 ? [''] : []), ...redMessage(verdict, context)]);
    return { conclusion: 'failure', title: redTitle(verdicts), summary: summaryOf([...lines, '', ...budgetTable(verdicts)]) };
  }
  if (state === 'neutral') {
    return { conclusion: 'neutral', title: 'not measured', summary: summaryOf([...neutralLines(verdicts), '', ...budgetTable(verdicts)]) };
  }
  return { conclusion: 'success', title: 'within budget', summary: summaryOf(budgetTable(verdicts)) };
}

/** The check run of a measure that could not run at all: neutral, saying why (D6). */
export function notMeasuredOutput(reason: string): BudgetsOutput {
  return { conclusion: 'neutral', title: 'not measured', summary: summaryOf([`Not measured: ${reason}.`, BLOCKS_NOTHING]) };
}

/** The check run of a ceilings file that does not parse: red, as `omni check context` reds it. */
export function unreadableCeilingsOutput(reason: string): BudgetsOutput {
  return { conclusion: 'failure', title: 'the ceilings file does not parse', summary: summaryOf([reason]) };
}
