// `omni retro outcome <prd> <finding> (--became <playbook/form#slot> | --stays-here <why>)` (PRD 2338) —
// records a kept lesson's outcome in its PRD's `retro.json` and the line under it in `retro.md`.
// Exit 0 when written, 1 when refused (an id that does not resolve, an empty reason, a finding the
// retro did not keep, a lesson that already has an outcome), nothing written; 2 on a usage error.
import type { PrdNumber } from '../../lib/ids.ts';
import { recordOutcome } from '../../lib/retro/record-outcome.ts';
import type { LessonOutcome } from '../../lib/retro/outcome.ts';
import { parseArgs, prdArg, println, usageError } from '../args.ts';
import type { Command, CommandIo } from '../io.ts';
import { synchronous } from '../synchronous.ts';

const USAGE = "usage: omni retro outcome <prd> <finding> (--became <playbook/<form>#<slot>> | --stays-here '<why>')";

type Request = { prd: PrdNumber; finding: string; outcome: LessonOutcome };

/** What `omni retro <args>` asks for, or a usage error saying what is wrong. */
function requestOf(args: readonly string[]): Request {
  const [verb, ...rest] = args;
  if (verb !== 'outcome') throw usageError(USAGE);
  const { positional, flags } = parseArgs('retro', rest, { values: ['became', 'stays-here'] });
  const [prdText, finding] = positional;
  if (positional.length !== 2 || prdText === undefined || finding === undefined) throw usageError(USAGE);
  const { became, 'stays-here': staysHere } = flags;
  if ((became === undefined) === (staysHere === undefined)) throw usageError(`omni retro: give exactly one of --became and --stays-here.\n${USAGE}`);
  return { prd: prdArg('retro', 'the PRD', prdText), finding, outcome: became === undefined ? { staysHere: staysHere ?? '' } : { became } };
}

export const retro: Command = {
  run: synchronous((args: string[], { ctx, stdout, stderr }: CommandIo): number => {
    const { prd, finding, outcome } = requestOf(args);
    const recorded = recordOutcome({ ctx, prd, finding, outcome });
    if (!recorded.ok) {
      println(stderr, `omni retro: ${recorded.reason}. Nothing written.`);
      return 1;
    }
    const note = recorded.markdown === null ? ` (no line for it in ${recorded.json.replace(/retro\.json$/, 'retro.md')})` : ` and ${recorded.markdown}`;
    println(stdout, `retro outcome — PRD ${String(prd)}, lesson \`${finding}\` recorded in ${recorded.json}${note}.`);
    return 0;
  }),
};
