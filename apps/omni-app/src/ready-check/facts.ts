// The facts the `omni / ready` check judges (PRD 2898 s7), read through GitHub at a feature PR's latest
// commit, never from a checkout: the head commit's check runs, the `acceptance` run's report, the diff
// against the default branch, the plan, the spec at both ends and the PRD's outbox. The rule is the
// kit's (`readyVerdict`, kit/lib/ready/checks.ts), run on these facts as `omni ready` runs it on its own.
//
//   prd        the feature PR's PRD: its head branch's topic among the delivery folders at the head, as
//              the budgets check finds it; its folder and its outbox snapshotted into the head folder
//   runs       every check run of the head commit, as GitHub lists them (the latest of each name)
//   report     the `acceptance` run's report, read from its output's text (or its summary): the JSON the
//              kit's report format names, alone or in a ```json block. No run, or one still going, and
//              the rule says check 3 is not finished
//   diff       GitHub's compare of the default branch and the head, each changed file read at the merge
//              base and at the head when the loosening detector may read it (code, a snapshot, JSON)
//   area       the plan's territories, the PRD's folders and the generated paths
//   ledger     the settled entries and the open items of the PRD's outbox, at the head
//
// Nothing fetched is run: only Markdown and JSON are read, through the kit's parsers (PRD 28, decision 5).
// A snapshot over its bound leaves the diff not judged; any other failure is thrown, for the job to retry.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Context } from 'omni-loop/kit/lib/context.ts';
import { prdOfBranch } from 'omni-loop/kit/lib/ask/context.ts';
import type { PrNumber, PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import { parsePlanSlices } from 'omni-loop/kit/lib/inbox/territory.ts';
import { parseFolderName } from 'omni-loop/kit/lib/layout.ts';
import { outboxItemFiles, parseOutboxItem, SETTLED_FILE } from 'omni-loop/kit/lib/outbox/outbox.ts';
import { parseSettledEntries } from 'omni-loop/kit/lib/outbox/settle.ts';
import type { CheckRun, ReadyFacts } from 'omni-loop/kit/lib/ready/checks.ts';
import { parseCriteria, type Criterion, type ParsedCriteria } from 'omni-loop/kit/lib/ready/criteria.ts';
import { excuseItems, type ExcuseItem } from 'omni-loop/kit/lib/ready/excuses.ts';
import type { DiffFile } from 'omni-loop/kit/lib/ready/loosening.ts';
import { ACCEPTANCE_CHECK_NAME, parseAcceptanceReport, type AcceptanceReport } from 'omni-loop/kit/lib/ready/report.ts';
import { z } from 'zod';
import type { PullFacts } from '../outbox-check/github.ts';
import { TreeSchema, type GitHubClient, type Repo } from '../outbox-check/github-schema.ts';
import { PER_PAGE, paginate } from '../retro/github.ts';
import { SnapshotBoundError, snapshot } from '../snapshot/snapshot.ts';

/** A fact as read: its value, or why it could not be read. */
type Readable<T> = { ok: true; value: T } | { ok: false; why: string };

const read = <T>(value: T): Readable<T> => ({ ok: true, value });
const unread = <T>(why: string): Readable<T> => ({ ok: false, why });

/** One check run of the head commit, as GitHub lists it: what the rule reads, its link and its output. */
const RunSchema = z.looseObject({
  name: z.string(),
  status: z.enum(['queued', 'in_progress', 'completed', 'waiting', 'requested', 'pending']),
  conclusion: z.string().nullish(),
  html_url: z.string().nullish(),
  output: z.looseObject({ title: z.string().nullish(), summary: z.string().nullish(), text: z.string().nullish() }).nullish(),
});
type Run = z.infer<typeof RunSchema>;

const RunsPageSchema = z.looseObject({ check_runs: z.array(RunSchema) });

/** One page of the compare: each file, with its path at the base when it was renamed, and the merge base. */
const ComparePageSchema = z.looseObject({
  merge_base_commit: z.looseObject({ sha: z.string() }).nullish(),
  files: z.array(z.looseObject({ filename: z.string(), status: z.string(), previous_filename: z.string().nullish() })).nullish(),
});

/** The compare's file statuses, as the loosening detector reads them; a copy is a file added. */
const STATUS: Readonly<Record<string, DiffFile['status']>> = Object.freeze({
  added: 'added',
  copied: 'added',
  removed: 'deleted',
  modified: 'modified',
  changed: 'modified',
  renamed: 'renamed',
});

/** The files the loosening detector may read: code, a snapshot, a floor or a baseline. */
const READ_AT_BOTH_ENDS = /\.(?:[cm]?[jt]sx?|snap|json)$/;

/** Where the PRD of a feature PR lives at its head: its number, and the context rooted at the head's snapshot. */
export type PrdAtHead = { prd: PrdNumber; ctx: Context };

/** The names of the folders directly under `dir` at `ref`; none when it is not there. Reads no blob. */
async function subfolders(octokit: GitHubClient, { owner, repo, ref, dir }: Repo & { ref: string; dir: string }): Promise<string[]> {
  const treeOf = async (sha: string) => TreeSchema.parse((await octokit.request('GET /repos/{owner}/{repo}/git/trees/{tree_sha}', { owner, repo, tree_sha: sha })).data).tree;
  let entries = await treeOf(ref);
  for (const segment of dir.split('/').filter(Boolean)) {
    const next = entries.find((entry) => entry.type === 'tree' && entry.path === segment);
    if (next === undefined) return [];
    entries = await treeOf(next.sha);
  }
  return entries.filter((entry) => entry.type === 'tree').map((entry) => entry.path);
}

/**
 * The PRD the feature PR works on, its folder and its outbox snapshotted at the head into `ctx.root`; null
 * when no delivery folder at the head carries its branch's topic.
 */
export async function prdAtHead(octokit: GitHubClient, ctx: Context, { owner, repo, pr }: Repo & { pr: PullFacts }): Promise<PrdNumber | null> {
  const { inbox, outbox, shipped } = ctx.layout.dirs;
  // An open PRD keeps its ledger in the outbox folder; a shipped one inside its own folder (#2891).
  const places = [
    { dir: inbox, read: (name: string) => [`${inbox}/${name}`, `${outbox}/${name}`] },
    { dir: shipped, read: (name: string) => [`${shipped}/${name}`] },
  ];
  const named: { name: string; read: string[] }[] = [];
  for (const { dir, read: readOf } of places) {
    for (const name of await subfolders(octokit, { owner, repo, ref: pr.headSha, dir })) named.push({ name, read: readOf(name) });
  }
  const prd = prdOfBranch(pr.headRef, { branches: ctx.config.branches, folders: named.map(({ name }) => name) });
  if (prd === null) return null;
  const paths = named.filter(({ name }) => parseFolderName(name)?.prd === prd).flatMap((folder) => folder.read);
  await snapshot(octokit, { owner, repo, ref: pr.headSha, paths, dest: ctx.root });
  return prd;
}

/** Every check run of the head commit. */
async function runsOf(octokit: GitHubClient, { owner, repo, headSha }: Repo & { headSha: string }): Promise<Run[]> {
  return paginate(async (page) => {
    const { data } = await octokit.request('GET /repos/{owner}/{repo}/commits/{ref}/check-runs', { owner, repo, ref: headSha, per_page: PER_PAGE, page });
    return RunsPageSchema.parse(data).check_runs;
  });
}

/** The changed files of `base...head` and the merge base they are compared from. */
async function compareOf(octokit: GitHubClient, { owner, repo, pr }: Repo & { pr: PullFacts }) {
  let mergeBase: string | null = null;
  const files = await paginate(async (page) => {
    const { data } = await octokit.request('GET /repos/{owner}/{repo}/compare/{basehead}', { owner, repo, basehead: `${pr.baseSha}...${pr.headSha}`, per_page: PER_PAGE, page });
    const compare = ComparePageSchema.parse(data);
    mergeBase ??= compare.merge_base_commit?.sha ?? null;
    return compare.files ?? [];
  });
  return { mergeBase: mergeBase ?? pr.baseSha, files };
}

/** A file's text under `root`, or null when it is not there. */
function textAt(root: string, path: string): string | null {
  const file = join(root, path);
  return existsSync(file) ? readFileSync(file, 'utf8') : null;
}

/** The report the `acceptance` run's output carries: the JSON alone, or the first ```json block. Null when it carries none. */
function reportText(run: Run): string | null {
  for (const text of [run.output?.text, run.output?.summary]) {
    if (!text?.trim()) continue;
    if (text.trim().startsWith('{')) return text;
    const block = /```json\s*\n([\s\S]*?)\n```/.exec(text)?.[1];
    if (block !== undefined) return block;
  }
  return null;
}

/** The acceptance report of the head commit, from its `acceptance` run; null while there is none. */
function reportOf(runs: readonly Run[]): Readable<AcceptanceReport | null> {
  const run = runs.find((candidate) => candidate.name === ACCEPTANCE_CHECK_NAME);
  if (run?.status !== 'completed') return read(null);
  const text = reportText(run);
  if (text === null) return read(null);
  const parsed = parseAcceptanceReport(text);
  return parsed.ok ? read(parsed.report) : unread(parsed.why);
}

/** The spec's criteria in a folder; `missing` when the spec is not there. */
function criteriaAt(root: string, specPath: string | null): ParsedCriteria | null {
  const text = specPath === null ? null : textAt(root, specPath);
  return text === null ? null : parseCriteria(text);
}

/** The PRD's outbox at the head, as the ready rule reads it: settled entries, then open items. */
function ledgerOf({ prd, ctx }: PrdAtHead): ExcuseItem[] {
  const dir = ctx.layout.outboxDir(prd);
  if (dir === null) return [];
  const settledText = textAt(ctx.root, `${dir}/${SETTLED_FILE}`);
  const settled = settledText === null ? [] : parseSettledEntries(settledText, ctx.markers);
  const open = outboxItemFiles({ ctx })
    .filter((file) => file.startsWith(`${dir}/`))
    .flatMap((file) => {
      const text = readFileSync(join(ctx.root, file), 'utf8');
      const parsed = parseOutboxItem(text, { file });
      return parsed.ok ? [{ id: parsed.item.id, text }] : [];
    });
  return excuseItems({ settled, open });
}

/** The PRD's area: the plan's territories, its folders and the generated paths. */
function areaOf({ prd, ctx }: PrdAtHead): ReadyFacts['area'] {
  const planPath = ctx.layout.planPath(prd);
  const plan = planPath === null ? null : textAt(ctx.root, planPath);
  if (plan === null) return unread(`the plan is not at the head (${planPath ?? 'no PRD folder'})`);
  const where = ctx.layout.whereIs(prd);
  const outbox = ctx.layout.outboxDir(prd);
  const prdFolders = [where?.dir, outbox].filter((dir) => dir !== null && dir !== undefined).map((dir) => `${dir}/`);
  return read({
    territories: parsePlanSlices(plan).flatMap((slice) => slice.territory),
    prdFolders,
    generated: (ctx.config.generated ?? []).map((entry) => entry.path),
  });
}

/** The links a person follows to each check's evidence. */
function evidenceOf({ owner, repo, prNumber, headSha, runs, planPath }: Repo & { prNumber: PrNumber; headSha: string; runs: readonly Run[]; planPath: string | null }, full: readonly string[]) {
  const github = `https://github.com/${owner}/${repo}`;
  const checks = `${github}/pull/${String(prNumber)}/checks`;
  const linkOf = (name: string) => runs.find((run) => run.name === name || run.name.startsWith(`${name} (`))?.html_url ?? null;
  return {
    ci: checks,
    full: full.map(linkOf).find((link) => link !== null) ?? checks,
    acceptance: linkOf(ACCEPTANCE_CHECK_NAME) ?? checks,
    loosening: `${github}/pull/${String(prNumber)}/files`,
    area: planPath === null ? `${github}/pull/${String(prNumber)}/files` : `${github}/blob/${headSha}/${planPath}`,
  };
}

/** Each changed file, read at both ends when the detector may read it; the diff not judged past the snapshot's bound. */
async function diffOf(
  octokit: GitHubClient,
  { owner, repo, pr, base, files }: Repo & { pr: PullFacts; base: string; files: Awaited<ReturnType<typeof compareOf>>['files'] },
): Promise<Readable<DiffFile[]>> {
  const diff = files.flatMap((file): Omit<DiffFile, 'before' | 'after'>[] => {
    const status = STATUS[file.status];
    if (status === undefined) return [];
    return [{ path: file.filename, status, ...(file.previous_filename ? { previousPath: file.previous_filename } : {}) }];
  });
  const wanted = diff.filter((file) => READ_AT_BOTH_ENDS.test(file.path));
  try {
    const head = await snapshot(octokit, { owner, repo, ref: pr.headSha, paths: wanted.filter((file) => file.status !== 'deleted').map((file) => file.path) });
    const before = await snapshot(octokit, {
      owner,
      repo,
      ref: base,
      paths: wanted.filter((file) => file.status !== 'added').map((file) => file.previousPath ?? file.path),
    });
    return read(diff.map((file) => {
      if (!READ_AT_BOTH_ENDS.test(file.path)) return { ...file, before: null, after: null };
      return { ...file, before: textAt(before, file.previousPath ?? file.path), after: textAt(head, file.path) };
    }));
  } catch (error) {
    if (error instanceof SnapshotBoundError) return unread(`the diff is too large to read: ${error.message}`);
    throw error;
  }
}

/** The facts, and what the PRD page shows beside the verdict: the criteria at the head and the report. */
export type ReadFacts = { facts: ReadyFacts; criteria: readonly Criterion[]; report: AcceptanceReport | null };

/** The facts of the feature PR `pr` of PRD `prd`, read at its head, its folder already in `ctx.root`. */
export async function readyFacts(
  octokit: GitHubClient,
  at: PrdAtHead,
  { owner, repo, prNumber, pr, baseFolder }: Repo & { prNumber: PrNumber; pr: PullFacts; baseFolder: string },
): Promise<ReadFacts> {
  const { prd, ctx } = at;
  const runs = await runsOf(octokit, { owner, repo, headSha: pr.headSha });
  const { mergeBase, files } = await compareOf(octokit, { owner, repo, pr });
  const specPath = ctx.layout.specPath(prd);
  const head = criteriaAt(ctx.root, specPath);
  if (specPath !== null) await snapshot(octokit, { owner, repo, ref: mergeBase, paths: [specPath], dest: baseFolder });
  const base = criteriaAt(baseFolder, specPath);
  const report = reportOf(runs);
  const full = ctx.config.ready.full;
  const facts: ReadyFacts = {
    head: pr.headSha,
    runs: read(runs.map((run): CheckRun => ({ name: run.name, status: run.status, conclusion: run.conclusion ?? null, url: run.html_url ?? null }))),
    full,
    criteria: head === null ? unread(`the spec is not at the head (${specPath ?? 'no PRD folder'})`) : read(head),
    baseCriteria: read(base?.criteria ?? []),
    report,
    diff: await diffOf(octokit, { owner, repo, pr, base: mergeBase, files }),
    area: areaOf(at),
    ledger: read(ledgerOf(at)),
    evidence: evidenceOf({ owner, repo, prNumber, headSha: pr.headSha, runs, planPath: ctx.layout.planPath(prd) }, full),
  };
  return { facts, criteria: head?.criteria ?? [], report: report.ok ? report.value : null };
}
