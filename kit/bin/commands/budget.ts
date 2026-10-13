// `omni budget measure context [--json] | set context` (PRD 1679): what every agent session reads
// here, in bytes, and the ceilings it is held to. `measure` prints one line per target — briefing,
// each form as `omni kb show` prints it, each `paths.context` file, and session, their sum — and
// exits 1 when one could not be measured, naming why. `set` writes a first ceiling for each target
// that has none into `budgets.context.file`, at today's size rounded up to the next KiB, and never
// raises one that exists; on a measurement error it writes nothing and exits 1. Neither reads
// `budgets.context.enabled`: a repository measures and sets before it turns budgets on.
import { measureContextBudget, readCeilings, setCeilings, writeCeilings } from '../../lib/budgets/index.ts';
import type { Measure } from '../../lib/budgets/index.ts';
import { contextBudget } from '../../lib/config.ts';
import { messageOf } from '../../lib/narrow.ts';
import { parseArgs, println, usageError } from '../args.ts';
import type { Command, CommandIo } from '../io.ts';
import { synchronous } from '../synchronous.ts';

const USAGE = 'usage: omni budget measure context [--json] | omni budget set context';
/** The only budget the kit measures today. */
const CONTEXT = 'context';

/** About how many tokens `bytes` holds, for people: a quarter of them. */
const tokens = (bytes: number): number => Math.round(bytes / 4);

/** One measure as a line: the target, its bytes and its approximate tokens, or why it has none. */
function measureLine(measure: Measure, width: number): string {
  const name = measure.target.padEnd(width);
  if ('error' in measure) return `${name}  error: ${measure.error}`;
  return `${name}  ${String(measure.bytes).padStart(7)} bytes  ~${tokens(measure.bytes)} tokens`;
}

function measure(rest: string[], json: boolean, { ctx, stdout }: CommandIo): number {
  if (rest.length !== 1 || rest[0] !== CONTEXT) throw usageError('usage: omni budget measure context [--json]');
  const measures = measureContextBudget({ ctx });
  if (json) {
    const object = Object.fromEntries(measures.map((one) => [one.target, 'error' in one ? { error: one.error } : one.bytes]));
    println(stdout, JSON.stringify(object, null, 2));
  } else {
    const width = Math.max(...measures.map(({ target }) => target.length));
    for (const one of measures) println(stdout, measureLine(one, width));
  }
  return measures.some((one) => 'error' in one) ? 1 : 0;
}

function set(rest: string[], json: boolean, { ctx, stdout, stderr }: CommandIo): number {
  if (rest.length !== 1 || rest[0] !== CONTEXT || json) throw usageError('usage: omni budget set context');
  const { file } = contextBudget(ctx.config);
  const where = { root: ctx.root, file };
  let result;
  try {
    result = setCeilings(readCeilings(where), measureContextBudget({ ctx }));
  } catch (error) {
    println(stderr, `omni budget set context: ${messageOf(error)} — nothing written`);
    return 1;
  }
  const { ceilings, added } = result;
  if (added.length > 0) writeCeilings(where, ceilings);
  for (const { target, ceiling } of added) println(stdout, `set ${target} ${ceiling}`);
  const kept = Object.keys(ceilings).length - added.length;
  println(stdout, `budget set context — ${added.length} first ceiling(s) written to ${file}; ${kept} kept as they were.`);
  return 0;
}

export const budget: Command = {
  run: synchronous((args: string[], io: CommandIo): number => {
    const { positional, flags } = parseArgs('budget', args, { booleans: ['json'] });
    const [sub, ...rest] = positional;
    if (sub === 'measure') return measure(rest, flags.json === true, io);
    if (sub === 'set') return set(rest, flags.json === true, io);
    throw usageError(USAGE);
  }),
};
