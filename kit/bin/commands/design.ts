// `omni design touched [<base>]` (PRD 1369): whether the branch's diff since its merge base with
// `<base>` touches a screen — `design: off` while `design.enabled` is false, else `ui: yes` and the
// matching paths, `ui: no`, or `ui: unknown` (`design.paths` empty, or a base git cannot read). The
// base defaults to the branch's own (`kit/lib/design/base.ts`). It only reports: every answer exits 0;
// only a usage mistake exits 2.
import { defaultDesignBase } from '../../lib/design/base.ts';
import { designTouched, formatTouched, type Touched } from '../../lib/design/touched.ts';
import { branchPaths } from '../branch-range.ts';
import { parseArgs, println, usageError } from '../args.ts';
import type { Command, CommandIo } from '../io.ts';
import { synchronous } from '../synchronous.ts';

const USAGE = 'usage: omni design touched [<base>]';

/** The checked-out branch, or null on a detached head or when git cannot say. */
function currentBranch({ ctx, exec }: CommandIo): string | null {
  try {
    const name = exec('git', ['symbolic-ref', '--quiet', '--short', 'HEAD'], { cwd: ctx.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return name || null;
  } catch {
    return null;
  }
}

function touched(io: CommandIo, given: string | undefined): Touched {
  const { design } = io.ctx.config;
  if (!design.enabled) return designTouched(design, []);
  const base = given ?? defaultDesignBase(currentBranch(io), io.ctx.config);
  let changed: string[];
  try {
    changed = branchPaths(io.ctx.root, base, io.exec);
  } catch {
    return { ui: 'unknown', reason: `cannot read ${base} — fetch it or pass another base` };
  }
  return designTouched(design, changed);
}

export const design: Command = {
  run: synchronous((args: string[], io: CommandIo): number => {
    const { positional } = parseArgs('design', args);
    const [verb, base, ...rest] = positional;
    if (verb !== 'touched' || rest.length > 0) throw usageError(USAGE);
    for (const line of formatTouched(touched(io, base))) println(io.stdout, line);
    return 0;
  }),
};
