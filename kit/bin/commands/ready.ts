// `omni ready <prd> [--json]` (PRD 2898, s3) — whether PRD <prd>'s feature pull request may be marked
// ready: five checks run on its latest commit, each `pass`, `fail`, `not finished` or `not judged`,
// ready only on five passes (`../../lib/ready/checks.ts`). It reads the facts itself through `gh`
// (`../../lib/ready/gh-facts.ts`): the head commit's check runs, the `acceptance` check run's report,
// the diff against the default branch, the plan, the spec and the outbox ledger at the head. It prints
// one line per check, then the verdict as the last line; exit 0 only on 5 of 5, exit 1 on anything
// else, a pull request it cannot find included. `--json` prints the same as one object. It writes
// nothing and merges nothing. Whether the PRD is in a mission (`../../lib/mission/membership.ts`) is
// printed beside it as `gated`, and never changes the verdict: the gate that asks `omni ready` decides
// whom to ask.
import { fillBranch } from '../../lib/board.ts';
import type { PrdNumber } from '../../lib/ids.ts';
import { parseFolderName } from '../../lib/layout.ts';
import { missionsOfPrd } from '../../lib/mission/membership.ts';
import { readyVerdict } from '../../lib/ready/checks.ts';
import { findFeaturePr, readFacts } from '../../lib/ready/gh-facts.ts';
import type { FactsSource, FeaturePr, Gh } from '../../lib/ready/gh-facts.ts';
import { parseArgs, prdArg, println, usageError } from '../args.ts';
import { githubEnv } from '../github.ts';
import type { Command, CommandIo } from '../io.ts';
import { synchronous } from '../synchronous.ts';

const USAGE = 'usage: omni ready <prd> [--json]';

/** `gh`, run with the repository's token, returning its text. */
function ghOf({ ctx, exec, env }: Pick<CommandIo, 'ctx' | 'exec' | 'env'>): Gh {
  const ghEnv = githubEnv(ctx, { exec, env });
  return (args) => exec('gh', [...args], { encoding: 'utf8', ...(ghEnv ? { env: ghEnv } : {}) });
}

/** Where the facts are read from, or the one line that says why they cannot be. */
function sourceOf(io: CommandIo, prd: ReturnType<typeof prdArg>): { source: FactsSource; branch: string } | string {
  const { ctx } = io;
  const repo = ctx.config.repo.slug;
  if (!repo) return 'no repository slug — set repo.slug in the config';
  const place = ctx.layout.whereIs(prd);
  const outboxDir = ctx.layout.outboxDir(prd);
  if (!place || !outboxDir) return `PRD ${String(prd)} is in neither ${ctx.layout.dirs.inbox} nor ${ctx.layout.dirs.shipped}`;
  const topic = parseFolderName(place.name)?.topic ?? place.name;
  const { inbox, shipped } = ctx.layout.dirs;
  const source: FactsSource = {
    gh: ghOf(io),
    repo,
    defaultBranch: ctx.config.repo.defaultBranch,
    prd: { dir: place.dir, outboxDir },
    prdFolders: [`${inbox}/${place.name}/`, `${shipped}/${place.name}/`, `${outboxDir}/`],
    generated: (ctx.config.generated ?? []).map((entry) => entry.path),
    markers: ctx.markers,
    full: ctx.config.ready.full,
  };
  return { source, branch: fillBranch(ctx.config.branches.feature, { topic }) };
}

/** Whether the PRD is named by a mission's record here, in one line. */
function gatedLine(io: CommandIo, prd: ReturnType<typeof prdArg>) {
  const missions = missionsOfPrd(io.ctx, prd);
  const scope = io.ctx.config.ready.checks;
  const inMission = missions.length > 0;
  const why = inMission ? `in mission ${missions.map((mission) => `#${String(mission)}`).join(', ')}` : 'in no mission';
  return { scope, inMission, why: `ready.checks is ${scope}, PRD ${why}` };
}

type Verdict = ReturnType<typeof readyVerdict>;

/** One line per check, then the verdict's headline. */
function lines(verdict: Verdict): string[] {
  return [...verdict.checks.map((check, index) => `${String(index + 1)} ${check.state} · ${check.title} — ${check.why}`), verdict.headline];
}

/** The verdict as one object, with the pull request it was read for. */
function report(prd: PrdNumber, pr: FeaturePr, gated: ReturnType<typeof gatedLine>, verdict: Verdict): string {
  return JSON.stringify({ prd, pr: { number: pr.number, head: pr.head, draft: pr.draft }, gated, ...verdict });
}

export const ready: Command = {
  run: synchronous((args: string[], io: CommandIo): number => {
    const { positional, flags } = parseArgs('ready', args, { booleans: ['json'] });
    if (positional.length !== 1) throw usageError(USAGE);
    const prd = prdArg('ready', '<prd>', positional[0] ?? '');
    const where = sourceOf(io, prd);
    if (typeof where === 'string') {
      println(io.stderr, `omni ready: ${where}`);
      return 2;
    }
    const pr = findFeaturePr(where.source.gh, where.source.repo, where.branch);
    if (!pr.ok) {
      println(io.stdout, flags.json ? JSON.stringify({ prd, state: 'not judged', why: pr.why }) : `not judged: ${pr.why}`);
      return 1;
    }
    const verdict = readyVerdict(readFacts(where.source, pr.value));
    const gated = gatedLine(io, prd);
    if (flags.json) println(io.stdout, report(prd, pr.value, gated, verdict));
    else for (const line of [`PRD ${String(prd)} · pull request #${String(pr.value.number)} · ${pr.value.head.slice(0, 8)} · ${gated.why}`, ...lines(verdict)]) println(io.stdout, line);
    return verdict.ready ? 0 : 1;
  }),
};
