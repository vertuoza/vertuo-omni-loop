// `omni roadmap check [<n>]` (PRD 1162) — grades every roadmap of the inbox, or roadmap n alone,
// through `kit/lib/roadmap/` (`index.ts` says where they live, `grade.ts` what it refuses). Prints,
// for each roadmap, its PRDs wave by wave, then every violation (exit 1) or its pass line. An inbox
// with no roadmap passes; a roadmap number with no folder is a usage error, exit 2.
import { formatFailure, formatPass } from '../../lib/check-report.ts';
import { gradeRoadmaps } from '../../lib/roadmap/index.ts';
import type { GradedRoadmap } from '../../lib/roadmap/index.ts';
import { roadmapWaves } from '../../lib/roadmap/parse.ts';
import { issueArg, parseArgs, println, usageError } from '../args.ts';
import type { Command, CommandIo, Out } from '../io.ts';
import { synchronous } from '../synchronous.ts';

const USAGE = 'usage: omni roadmap check [<n>]';

/** One roadmap's waves, then its violations or its pass line; whether it passed. */
function report(stdout: Out, graded: GradedRoadmap): boolean {
  const { number, file, roadmap, violations } = graded;
  if (roadmap !== null) {
    const waves = roadmapWaves(roadmap);
    println(stdout, `omni roadmap check — roadmap ${number}: ${roadmap.prds.length} PRD(s) across ${waves.length} wave(s) (${file}).`);
    for (const { wave, rows } of waves) {
      const members = rows.map((row) => `${row.id} #${row.prd}${row.repos === null ? '' : ` (${row.repos.join(', ')})`}`);
      println(stdout, `  wave ${wave}: ${members.join(', ')}`);
    }
  }
  if (violations.length > 0) {
    println(stdout, formatFailure(`omni roadmap check — roadmap ${number}: violation(s):`, violations));
    return false;
  }
  println(stdout, formatPass(`omni roadmap check — roadmap ${number}: every row, blocker and question holds.`));
  return true;
}

/** `omni roadmap check [<n>]`: exit 0 when every roadmap graded passes, 1 otherwise. */
function checkCommand(rest: string[], { ctx, stdout }: Pick<CommandIo, 'ctx' | 'stdout'>): number {
  const { positional } = parseArgs('roadmap check', rest);
  if (positional.length > 1) throw usageError(USAGE);
  const wanted = positional[0] === undefined ? null : issueArg('roadmap check', '<n>', positional[0]);
  const all = gradeRoadmaps(ctx);
  const graded = wanted === null ? all : all.filter((entry) => entry.number === wanted);
  if (wanted !== null && graded.length === 0) throw usageError(`omni roadmap check: roadmap ${wanted} has no folder under the inbox's roadmaps.`);
  if (graded.length === 0) {
    println(stdout, formatPass('omni roadmap check — no roadmap in the inbox.'));
    return 0;
  }
  const passed = graded.map((entry) => report(stdout, entry));
  return passed.every(Boolean) ? 0 : 1;
}

export const roadmap: Command = {
  run: synchronous((args: string[], { ctx, stdout }: CommandIo): number => {
    const [sub, ...rest] = args;
    if (sub !== 'check') throw usageError(USAGE);
    return checkCommand(rest, { ctx, stdout });
  }),
};
