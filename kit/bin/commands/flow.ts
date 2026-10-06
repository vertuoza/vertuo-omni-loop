// `omni flow show [<point>] [--prd <n> --slice <id> | --path <p>] [--json]` and
// `omni flow verdict <point> --from <file>` and `omni flow check merge --pr <n>` (PRD 1089) — the
// repository's flow, as an agent follows it, through `kit/lib/flow/show.ts`, `verdict.ts` and
// `merge-gate.ts`.
//
// - `show <point>` prints the point's resolved hooks — every `before`, the `replace`, every `after`,
//   each with its area, its text with the inputs filled in and its verdict line — and `kitStep: run`
//   or `kitStep: replaced`. With `--prd` and `--slice` it reads the slice's territory from the plan;
//   with `--path` the path is the territory; with neither, the default area's hooks. Exit 1, each
//   problem on a `not ok` line, when a hook file is not there or names another point: fail closed.
// - `show --path <p>` prints the path's area with every rule and hook that applies there.
// - `show` alone prints what this repository changes from the kit's defaults, area by area.
// - `verdict <point> --from <file>` reads a hook's output: `ok`, exit 0, or `not ok <point> <why>`,
//   exit 1; output that does not end with the point's verdict line is `not ok … no verdict`.
// - `check merge --pr <n> [--repo <target>]` reads the sub-PR from GitHub (`../github.ts`), finds its
//   slice by its head branch in the inbox's plans, and applies `rules.subPr` through
//   `kit/lib/flow/merge-gate.ts`: `ok` and the merge command to run, exit 0, or one `not ok <area>:
//   <rule> — <why>` line per reason, exit 1. What merges anyway is printed as `report` lines.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fillBranch } from '../../lib/board.ts';
import type { Context } from '../../lib/context.ts';
import { FLOW_POINTS, flowPoint, type FlowPoint } from '../../lib/flow/points.ts';
import { resolveFlow } from '../../lib/flow/resolve.ts';
import { flowDifferences, ruleLines, showPath, showPoint, type AreaDifference, type PathView, type PointView, type ShownHook } from '../../lib/flow/show.ts';
import { readVerdict, verdictLine } from '../../lib/flow/verdict.ts';
import { mergeGate } from '../../lib/flow/merge-gate.ts';
import { parsePlanSlices } from '../../lib/inbox/territory.ts';
import { parseFolderName, prdFoldersIn } from '../../lib/layout.ts';
import { parseArgs, prArg, prdArg, println, readUserFile, sliceArg, usageError } from '../args.ts';
import { openPullRequestsInto, subPrFor } from '../github.ts';
import type { Command, CommandIo } from '../io.ts';
import { synchronous } from '../synchronous.ts';

const USAGE =
  'usage: omni flow show [<point>] [--prd <n> --slice <id> | --path <p>] [--json] | omni flow verdict <point> --from <file>' +
  ' | omni flow check merge --pr <n> [--repo <target>] [--json]';
const KNOWN = FLOW_POINTS.map(({ point }) => point).join(', ');

/** The point named `name`, or a usage error listing the catalog. */
function pointArg(verb: string, name: string): FlowPoint {
  const point = flowPoint(name);
  if (!point) throw usageError(`omni flow ${verb}: ${name} is not a point of the catalog (${KNOWN}).`);
  return point;
}

/** A hook file's text, or `null` when the repository has no such file. */
const hookReader = (root: string) => (path: string): string | null => {
  const file = join(root, path);
  return existsSync(file) && statSync(file).isFile() ? readFileSync(file, 'utf8') : null;
};

/** PRD n's slice: its territory, and the inputs it gives a hook. */
function sliceInputs(ctx: Context, prdText: string, sliceText: string): { territory: string[]; values: Record<string, string> } {
  const prd = prdArg('flow show', '--prd', prdText);
  const slice = sliceArg('flow show', '--slice', sliceText);
  const where = ctx.layout.whereIs(prd);
  const planPath = ctx.layout.planPath(prd);
  if (where === null || planPath === null) throw usageError(`omni flow show: PRD ${prd} has no inbox or shipped folder.`);
  const file = join(ctx.root, planPath);
  if (!existsSync(file)) throw usageError(`omni flow show: no plan at ${planPath}.`);
  const row = parsePlanSlices(readFileSync(file, 'utf8')).find(({ id }) => id === slice);
  if (!row) throw usageError(`omni flow show: PRD ${prd}'s plan has no slice ${slice}.`);
  const topic = parseFolderName(where.name)?.topic;
  return {
    territory: row.territory,
    values: {
      prd: String(prd),
      slice,
      territory: row.territory.join(' '),
      ...(topic === undefined ? {} : { branch: fillBranch(ctx.config.branches.slice, { topic, slice }) }),
    },
  };
}

/** One hook's line: its path, then its area. */
const hookLine = ({ path, area, alias }: ShownHook) => `${path}  (${area}${alias === null ? '' : `, alias ${alias}`})`;

/** A point's view as text: its areas, each hook by mode, `kitStep`, then each hook's text in the order it runs. */
function pointText(view: PointView): string {
  const lines = [`point    ${view.point}`, `areas    ${view.areas.join(', ')}`];
  if (view.territory !== null) lines.push(`territory ${view.territory.join(' ')}`);
  const hooks = [...view.before, ...(view.replace ? [view.replace] : []), ...view.after];
  if (hooks.length === 0) lines.push('hooks    none');
  for (const hook of hooks) lines.push(`${hook.mode.padEnd(8)} ${hookLine(hook)}`);
  lines.push(`kitStep: ${view.kitStep}`);
  if (hooks.length === 0) return lines.join('\n');
  lines.push(`verdict  ${view.verdict}`);
  for (const hook of hooks) {
    lines.push('', `## ${hook.mode} ${hook.path} (${hook.area})`);
    lines.push(hook.text === null ? `follow ${hook.path} as Claude Code resolves it.` : hook.text.trimEnd());
  }
  return lines.join('\n');
}

/** A path's view as text: its area and patterns, its rules, its hooks. */
function pathText(view: PathView): string {
  const rules = ruleLines(view.rules);
  const lines = [`path     ${view.path}`, `area     ${view.area}${view.paths.length > 0 ? `  ${view.paths.join(' ')}` : ''}`];
  if (view.knowledge !== null) lines.push(`knowledge ${view.knowledge}`);
  lines.push(`rules    ${rules.length > 0 ? rules.join(' · ') : "the kit's defaults"}`);
  const hooks = Object.entries(view.hooks).flatMap(([point, { before, replace, after }]) => [
    ...before.map((path) => `${point} before ${path}`),
    ...(replace === null ? [] : [`${point} replace ${replace}`]),
    ...after.map((path) => `${point} after ${path}`),
  ]);
  lines.push(...(hooks.length > 0 ? hooks.map((hook) => `hook     ${hook}`) : ['hooks    none']));
  return lines.join('\n');
}

/** The differences as text: one block per area. */
function differencesText(differences: AreaDifference[]): string {
  if (differences.length === 0) return "flow — none: this repository runs the kit's defaults.";
  const lines = ["flow — what this repository changes from the kit's defaults"];
  for (const { area, paths, inherit, rules, hooks } of differences) {
    const where = paths.length === 0 ? 'every path no area claims' : paths.join(' ');
    lines.push('', `${area}  ${where}${inherit || area === 'default' ? '' : '  (inherit: false)'}`);
    lines.push(...rules.map((rule) => `  rule  ${rule}`));
    lines.push(...hooks.map(({ point, mode, path }) => `  hook  ${point} ${mode} ${path}`));
  }
  return lines.join('\n');
}

function show(args: string[], { ctx, stdout }: CommandIo): number {
  const { positional, flags } = parseArgs('flow show', args, { values: ['prd', 'slice', 'path'], booleans: ['json'] });
  if (positional.length > 1) throw usageError(USAGE);
  const flow = resolveFlow(ctx.config);
  const [name] = positional;
  const bySlice = flags.prd !== undefined || flags.slice !== undefined;
  if (bySlice && (flags.prd === undefined || flags.slice === undefined)) throw usageError('omni flow show: --prd and --slice go together.');
  if (bySlice && flags.path !== undefined) throw usageError('omni flow show: either --prd and --slice, or --path, not both.');
  const print = (json: unknown, text: string): void => {
    println(stdout, flags.json ? JSON.stringify(json, null, 2) : text);
  };

  if (name === undefined) {
    if (bySlice) throw usageError('omni flow show: --prd and --slice name a point\'s slice — give the point.');
    if (flags.path !== undefined) {
      const view = showPath(flow, flags.path);
      print(view, pathText(view));
      return 0;
    }
    const differences = flowDifferences(flow);
    print(differences, differencesText(differences));
    return 0;
  }

  const point = pointArg('show', name);
  const slice = bySlice ? sliceInputs(ctx, flags.prd ?? '', flags.slice ?? '') : null;
  const territory = slice?.territory ?? (flags.path === undefined ? undefined : [flags.path]);
  const view = showPoint(flow, point, {
    ...(territory === undefined ? {} : { territory }),
    ...(slice === null ? {} : { values: slice.values }),
    readHook: hookReader(ctx.root),
  });
  print(view, pointText(view));
  for (const problem of view.problems) println(stdout, `not ok ${point.point} ${problem}`);
  return view.problems.length > 0 ? 1 : 0;
}

function verdict(args: string[], { ctx, stdout }: CommandIo): number {
  const { positional, flags } = parseArgs('flow verdict', args, { values: ['from'] });
  const [name] = positional;
  const from = flags.from;
  if (positional.length !== 1 || name === undefined || from === undefined) throw usageError('usage: omni flow verdict <point> --from <file>');
  const point = pointArg('verdict', name);
  const read = readVerdict(point.point, readUserFile('flow verdict', ctx, from));
  println(stdout, verdictLine(point.point, read));
  return read.ok ? 0 : 1;
}

const MERGE_USAGE = 'usage: omni flow check merge --pr <n> [--repo <target>] [--json]';

/** The slug `--repo` names: `owner/name` as it is, or a target's short name looked up in `plan.targets`. */
function repoArg(ctx: Context, value: string | undefined): string | null {
  if (value === undefined) return null;
  if (value.includes('/')) return value;
  const target = (ctx.config.plan?.targets ?? []).find(({ repo }) => repo.split('/')[1] === value);
  if (!target) throw usageError(`omni flow check merge: ${value} is not a target of plan.targets — give owner/name.`);
  return target.repo;
}

/** Every slice of every PRD in the inbox, by its slice branch, with its territory. */
function sliceTerritories(ctx: Context): Map<string, string[]> {
  return new Map([...sliceGround(ctx)].map(([branch, { territory }]) => [branch, territory]));
}

/** Every slice of every PRD in the inbox, by its slice branch: its territory, and its PRD's outbox
 * folder, the ground every slice writes its decisions in (as `/omni:wave`'s territory check reads it). */
function sliceGround(ctx: Context): Map<string, { territory: string[]; outbox: string }> {
  const byBranch = new Map<string, { territory: string[]; outbox: string }>();
  for (const { name } of prdFoldersIn(join(ctx.root, ctx.layout.dirs.inbox))) {
    const topic = parseFolderName(name)?.topic;
    const plan = join(ctx.root, ctx.layout.dirs.inbox, name, 'plan.md');
    if (topic === undefined || !existsSync(plan)) continue;
    for (const { id, territory } of parsePlanSlices(readFileSync(plan, 'utf8'))) {
      byBranch.set(fillBranch(ctx.config.branches.slice, { topic, slice: id }), { territory, outbox: `${ctx.layout.dirs.outbox}/${name}/` });
    }
  }
  return byBranch;
}

function checkMerge(args: string[], { ctx, stdout, exec, env }: CommandIo): number {
  const [what, ...rest] = args;
  if (what !== 'merge') throw usageError(MERGE_USAGE);
  const { positional, flags } = parseArgs('flow check merge', rest, { values: ['pr', 'repo'], booleans: ['json'] });
  if (positional.length > 0 || flags.pr === undefined) throw usageError(MERGE_USAGE);
  const number = prArg('flow check merge', '--pr', flags.pr);
  const repo = repoArg(ctx, flags.repo);
  const resolved = resolveFlow(ctx.config);
  const slug = repo ?? ctx.config.repo.slug;
  const pr = subPrFor(ctx, { repo: slug, number, exec, env });
  const slices = sliceTerritories(ctx);
  const countsOpen = [resolved.defaultArea, ...resolved.areas].some(({ rules }) => rules.subPr.maxOpen !== null);
  const open = countsOpen
    ? openPullRequestsInto(ctx, { repo: slug, base: pr.base, exec, env }).flatMap(({ number: n, head }) => {
        const territory = slices.get(head);
        return territory === undefined ? [] : [{ number: n, territory }];
      })
    : [];
  const own = sliceGround(ctx).get(pr.head);
  const verdict = mergeGate({
    flow: resolved,
    pr,
    territory: own?.territory ?? null,
    defaultBranch: ctx.config.repo.defaultBranch,
    open,
    repo,
    ground: own === undefined ? [] : [own.outbox],
  });
  if (flags.json) {
    println(stdout, JSON.stringify(verdict, null, 2));
  } else {
    const lines = verdict.command === null ? verdict.reasons.map((reason) => `not ok ${reason}`) : ['ok', verdict.command.join(' ')];
    println(stdout, [...lines, ...verdict.reported.map((line) => `report ${line}`)].join('\n'));
  }
  return verdict.ok ? 0 : 1;
}

export const flow: Command = {
  run: synchronous((args: string[], io: CommandIo): number => {
    const [sub, ...rest] = args;
    if (sub === 'show') return show(rest, io);
    if (sub === 'verdict') return verdict(rest, io);
    if (sub === 'check') return checkMerge(rest, io);
    throw usageError(USAGE);
  }),
};
