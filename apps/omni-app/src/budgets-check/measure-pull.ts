// The `omni / budgets` check's measure of one pull request (PRD 1679 s3): what `omni check context` does
// in a checkout, done on snapshots read through GitHub's Git Data API, with the kit's own code.
//
//   head      the head's config, then every file a session's targets are made of — the playbook, the
//             decision records, the ceilings file, each `paths.context` file — then every page a
//             form's pointer reads; measured by `measureContextBudget`, as `omni kb show` prints them
//   base      the ceilings file at the merge base (`null` when it holds none: an install, D8)
//   raises    the PRD's settled raise items (./raises.ts): the PRD the head branch works on, or the
//             product PRD the body names (`Part of mobile-12`)
//   verdict   `ratchet`, then the output (./output.ts); on a red, what grew, gathered by the kit's
//             `targetGrowth` from the base's snapshot and the range's commits read from GitHub
//
// Nothing fetched is run: only YAML, JSON and Markdown are read, through the kit's parsers (PRD 28,
// decision 5). A snapshot over its bound, or a head config that does not parse, is a measure that
// could not run: neutral, saying why (D6). A ceilings file that does not parse is red, as the command
// says it. Every temporary folder is removed whatever happens.
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseCeilings, readCeilings, type Ceilings } from 'vertuo-omni-plan/kit/lib/budgets/ceilings.ts';
import { measureContextBudget } from 'vertuo-omni-plan/kit/lib/budgets/measure.ts';
import { targetGrowth } from 'vertuo-omni-plan/kit/lib/budgets/message-growth.ts';
import type { Growth } from 'vertuo-omni-plan/kit/lib/budgets/message.ts';
import { ratchet } from 'vertuo-omni-plan/kit/lib/budgets/ratchet.ts';
import { prdOfBranch } from 'vertuo-omni-plan/kit/lib/ask/context.ts';
import { CONFIG_FILE, ConfigError, contextBudget, parseConfig } from 'vertuo-omni-plan/kit/lib/config.ts';
import { createContext, type Context } from 'vertuo-omni-plan/kit/lib/context.ts';
import { parseProductPrdId, type PrdNumber, type ProductPrdId } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { parseFolderName } from 'vertuo-omni-plan/kit/lib/layout.ts';
import { FORM_IDS, readForm } from 'vertuo-omni-plan/kit/lib/playbook/forms.ts';
import { z } from 'zod';
import { productPrdOf } from '../approved-check/state.ts';
import type { PullFacts } from '../outbox-check/github.ts';
import { ComparePageSchema, TreeSchema, type GitHubClient, type Repo } from '../outbox-check/github-schema.ts';
import { SnapshotBoundError, snapshot } from '../snapshot/snapshot.ts';
import { budgetsOutput, notMeasuredOutput, unreadableCeilingsOutput, type BudgetsOutput } from './output.ts';
import { raisesFor, type OutboxRowsReader } from './raises.ts';

/** The most commits of a target's growth, as the kit lists them. */
const MAX_COMMITS = 10;

/** What the measure reads besides GitHub. */
export type MeasureSeams = { readOutboxRows: OutboxRowsReader | null; log: (line: string) => void };

/** A commit of the range, as `git log --format=%h%x09%s` prints it. */
type RangeCommit = { sha: string; subject: string };

const CompareSchema = ComparePageSchema.extend({ merge_base_commit: z.looseObject({ sha: z.string() }).nullish() });
const CommitsSchema = z.array(z.looseObject({ sha: z.string() }));

/** The paths of `paths` once each, in order. */
const unique = (paths: readonly (string | null)[]): string[] => [...new Set(paths.filter((path): path is string => path !== null && path !== ''))];

/** Every file a session's targets are made of, before any pointer is followed. */
function sessionPaths(ctx: Context, ceilingsFile: string): string[] {
  const { layout, config } = ctx;
  return unique([ceilingsFile, layout.playbookDir, layout.adrDir, ...FORM_IDS.map((form) => layout.formPath(form)), ...config.paths.context]);
}

/** Every page a form's pointer reads at the head: a section's `See:` line, a pointer form's target and index. */
function pointedPaths(ctx: Context): string[] {
  return unique(FORM_IDS.flatMap((form) => {
    const read = readForm(form, { ctx });
    if (!read.exists || !read.ok) return [];
    const { pointsTo, index, slots } = read.form;
    return [pointsTo, index, ...slots.map(({ body }) => (body.kind === 'pointer' ? body.see.path : null))];
  }));
}

/** The names of the folders directly under `dir` at `ref`; none when it is not there. Reads no blob. */
async function foldersAt(octokit: GitHubClient, { owner, repo, ref, dir }: Repo & { ref: string; dir: string }): Promise<string[]> {
  let sha = ref;
  for (const segment of [...dir.split('/').filter(Boolean), null]) {
    const { data } = await octokit.request('GET /repos/{owner}/{repo}/git/trees/{tree_sha}', { owner, repo, tree_sha: sha });
    const trees = TreeSchema.parse(data).tree.filter((entry) => entry.type === 'tree');
    if (segment === null) return trees.map((entry) => entry.path);
    const next = trees.find((entry) => entry.path === segment);
    if (!next) return [];
    sha = next.sha;
  }
  return [];
}

/** The PRD the pull request belongs to: the product PRD its body names, else the one its head branch works on. */
async function prdOfPull(octokit: GitHubClient, ctx: Context, { owner, repo, pr }: Repo & { pr: PullFacts }): Promise<PrdNumber | ProductPrdId | null> {
  const product = productPrdOf(pr.body);
  if (product) return parseProductPrdId(product.id);
  const { inbox, outbox } = ctx.layout.dirs;
  const folders = await foldersAt(octokit, { owner, repo, ref: pr.headSha, dir: inbox });
  const prd = prdOfBranch(pr.headRef, { branches: ctx.config.branches, folders });
  if (prd === null) return null;
  // The `git` store reads the PRD's folder and its ledger at the head.
  const names = folders.filter((name) => parseFolderName(name)?.prd === prd);
  await snapshot(octokit, { owner, repo, ref: pr.headSha, paths: names.flatMap((name) => [`${inbox}/${name}`, `${outbox}/${name}`]), dest: ctx.root });
  return prd;
}

/** The merge base of the range and its commits, newest first, from GitHub's compare endpoint. */
async function rangeOf(octokit: GitHubClient, { owner, repo, pr }: Repo & { pr: PullFacts }): Promise<{ base: string; commits: RangeCommit[] }> {
  const { data } = await octokit.request('GET /repos/{owner}/{repo}/compare/{basehead}', { owner, repo, basehead: `${pr.baseSha}...${pr.headSha}`, per_page: 100, page: 1 });
  const compare = CompareSchema.parse(data);
  const commits = (compare.commits ?? []).map(({ sha, commit }) => ({ sha, subject: (commit?.message ?? '').split('\n')[0] ?? '' }));
  return { base: compare.merge_base_commit?.sha ?? pr.baseSha, commits: commits.reverse() };
}

/** The ceilings file at the base, or `null` when it holds none, or none that parses: an install. */
function baseCeilings(folder: string, file: string): Ceilings | null {
  const path = join(folder, file);
  if (!existsSync(path)) return null;
  try {
    return parseCeilings(readFileSync(path, 'utf8'), file);
  } catch {
    return null;
  }
}

/** Why a value thrown is thrown, in a line. */
const reasonOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * What grew behind each red target since `base`: the kit's `targetGrowth`, its git read from the base's
 * snapshot (a file's size) and the range's commits that GitHub says changed its files. It asks twice:
 * once to learn the files, once with their commits read.
 */
async function growthOf(
  octokit: GitHubClient,
  ctx: Context,
  { owner, repo, pr, targets, range, baseFolder }: Repo & { pr: PullFacts; targets: string[]; range: { base: string; commits: RangeCommit[] }; baseFolder: string },
): Promise<Record<string, Growth>> {
  const asked = new Set<string>();
  const changedBy = new Map<string, Set<string>>();
  const size = (path: string): string => {
    const file = join(baseFolder, path);
    if (!existsSync(file) || !statSync(file).isFile()) throw new Error(`${path} is not at the base`);
    return String(statSync(file).size);
  };
  const log = (paths: readonly string[]): string => {
    for (const path of paths) asked.add(path);
    const touched = range.commits.filter(({ sha }) => paths.some((path) => changedBy.get(path)?.has(sha)));
    return touched.slice(0, MAX_COMMITS).map(({ sha, subject }) => `${sha.slice(0, 7)}\t${subject}`).join('\n');
  };
  const exec = (_file: string, args: readonly string[]): string => {
    if (args[0] === 'cat-file') return size((args[2] ?? '').slice(range.base.length + 1));
    return log(args.slice(args.indexOf('--') + 1));
  };
  const gather = () => Object.fromEntries(targets.map((target) => [target, targetGrowth({ ctx, target, base: range.base, exec })]));
  await snapshot(octokit, { owner, repo, ref: range.base, paths: [...sessionPaths(ctx, contextBudget(ctx.config).file), ...pointedPaths(ctx)], dest: baseFolder });
  gather();
  for (const path of asked) {
    const { data } = await octokit.request('GET /repos/{owner}/{repo}/commits', { owner, repo, sha: pr.headSha, path, per_page: 100 });
    changedBy.set(path, new Set(CommitsSchema.parse(data).map(({ sha }) => sha)));
  }
  return gather();
}

/** The check run the context budget asks for on pull request `pr`, measured at its head against its merge base. */
export async function measurePull(
  octokit: GitHubClient,
  { owner, repo, pr }: Repo & { pr: PullFacts },
  { readOutboxRows, log }: MeasureSeams,
): Promise<BudgetsOutput> {
  const head = mkdtempSync(join(tmpdir(), 'omni-budgets-head-'));
  const base = mkdtempSync(join(tmpdir(), 'omni-budgets-base-'));
  try {
    await snapshot(octokit, { owner, repo, ref: pr.headSha, paths: [CONFIG_FILE], dest: head });
    let ctx: Context;
    try {
      ctx = createContext(head, parseConfig(readFileSync(join(head, CONFIG_FILE), 'utf8'), CONFIG_FILE));
    } catch (error) {
      if (!(error instanceof ConfigError) && existsSync(join(head, CONFIG_FILE))) throw error;
      return notMeasuredOutput(`the head's ${CONFIG_FILE} cannot be read — ${reasonOf(error)}`);
    }
    const { file } = contextBudget(ctx.config);
    await snapshot(octokit, { owner, repo, ref: pr.headSha, paths: sessionPaths(ctx, file), dest: head });
    await snapshot(octokit, { owner, repo, ref: pr.headSha, paths: pointedPaths(ctx), dest: head });
    let ceilings: Ceilings;
    try {
      ceilings = readCeilings({ root: head, file });
    } catch (error) {
      return unreadableCeilingsOutput(reasonOf(error));
    }
    const range = await rangeOf(octokit, { owner, repo, pr });
    await snapshot(octokit, { owner, repo, ref: range.base, paths: [file], dest: base });
    const prd = await prdOfPull(octokit, ctx, { owner, repo, pr });
    const verdicts = ratchet({
      base: baseCeilings(base, file),
      head: ceilings,
      measures: measureContextBudget({ ctx }),
      raises: await raisesFor({ ctx, prd, repository: `${owner}/${repo}`, readOutboxRows, log }),
    });
    const red = verdicts.filter(({ verdict }) => verdict === 'over-budget' || verdict === 'needs-yes').map(({ target }) => target);
    const growth = red.length === 0 ? {} : await growthOf(octokit, ctx, { owner, repo, pr, targets: red, range, baseFolder: base });
    return budgetsOutput(verdicts, { prd, ceilingsFile: file, growth });
  } catch (error) {
    if (error instanceof SnapshotBoundError) return notMeasuredOutput(error.message);
    throw error;
  } finally {
    rmSync(head, { recursive: true, force: true });
    rmSync(base, { recursive: true, force: true });
  }
}
