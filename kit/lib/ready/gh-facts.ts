// PRD 2898, s3: the facts the ready rule reads (`checks.ts`), read through `gh` at a feature PR's latest
// commit — its check runs, the acceptance report its `acceptance` check run carries, the diff against the
// default branch, and the PRD's plan, spec and outbox ledger at that commit. Read-only: every call is a
// GET. A fact `gh` cannot give comes back as `{ ok: false, why }`, never as an empty one, so the rule
// names it `not judged`. `gh` is injected: a function that runs it and returns its text, throwing when it
// fails, so a test hands it a table and no real GitHub is ever called.
import { z } from 'zod';
import { messageOf, propertyOf } from '../narrow.ts';
import { OutboxItemIdSchema } from '../ids.ts';
import type { OutboxItemId } from '../ids.ts';
import { parsePlanSlices } from '../inbox/territory.ts';
import { plainText } from '../outbox/plain-text.ts';
import { parseSettledEntries } from '../outbox/settle.ts';
import type { Markers } from '../outbox/settle.ts';
import { parseCriteria } from './criteria.ts';
import type { Criterion, ParsedCriteria } from './criteria.ts';
import type { CheckRun, ReadyFacts } from './checks.ts';
import { excuseItems } from './excuses.ts';
import type { DiffFile } from './loosening.ts';
import { ACCEPTANCE_CHECK_NAME, parseAcceptanceReport } from './report.ts';
import type { AcceptanceReport } from './report.ts';

/** Runs `gh` with these arguments and returns its text; throws when it fails. */
export type Gh = (args: readonly string[]) => string;

/** A fact as read: its value, or why it could not be read. */
type Readable<T> = { ok: true; value: T } | { ok: false; why: string };

/** Where the PRD's files are: its folder (a path prefix, no trailing slash) and its outbox's. */
export type PrdPlace = { dir: string; outboxDir: string };

/** What the facts are read from. */
export type FactsSource = {
  gh: Gh;
  /** `owner/name`. */
  repo: string;
  defaultBranch: string;
  prd: PrdPlace;
  /** The folders (path prefixes) that are the PRD's own, and the generated paths, from the config. */
  prdFolders: readonly string[];
  generated: readonly string[];
  markers: Pick<Markers, 'settledOpenRe' | 'settledClose'>;
  full: readonly string[];
};

/** The feature PR the facts are read for. */
export type FeaturePr = { number: number; head: string; draft: boolean };

const SETTLED_FILE = 'settled.md';

/** Why a `gh` call failed, in one line. */
function failure(error: unknown): string {
  const text = plainText(propertyOf(error, 'stderr')).trim() || messageOf(error).trim();
  return text.split('\n')[0] ?? 'gh failed';
}

/** GitHub's answer for a path it does not hold. */
const isNotFound = (why: string) => /\bHTTP 404\b|Not Found/.test(why);

const PrListSchema = z.array(z.object({ number: z.number().int().positive(), headRefOid: z.string().min(7), isDraft: z.boolean() }));

/** The open pull request from `branch`, or why there is none to read. */
export function findFeaturePr(gh: Gh, repo: string, branch: string): Readable<FeaturePr> {
  try {
    const read = PrListSchema.parse(JSON.parse(gh(['pr', 'list', '--repo', repo, '--head', branch, '--state', 'open', '--json', 'number,headRefOid,isDraft'])));
    const [first] = read;
    if (first === undefined) return { ok: false, why: `no open pull request from ${branch}` };
    return { ok: true, value: { number: first.number, head: first.headRefOid, draft: first.isDraft } };
  } catch (error) {
    return { ok: false, why: `could not list the pull requests of ${branch}: ${failure(error)}` };
  }
}

const CheckRunsSchema = z.object({
  check_runs: z.array(
    z.object({
      name: z.string(),
      status: z.enum(['queued', 'in_progress', 'completed', 'waiting', 'requested', 'pending']),
      conclusion: z.string().nullable(),
      html_url: z.string().nullable().optional(),
      output: z.object({ text: z.string().nullable().optional() }).optional(),
    }),
  ),
});

type RunRead = { runs: CheckRun[]; reports: Map<string, string | null> };

/** The check runs of `head`, and the text of each one's output (where the acceptance report lives). */
function readRuns(source: FactsSource, head: string): Readable<RunRead> {
  try {
    const read = CheckRunsSchema.parse(JSON.parse(source.gh(['api', `repos/${source.repo}/commits/${head}/check-runs?per_page=100`])));
    const runs = read.check_runs.map(({ name, status, conclusion, html_url }): CheckRun => ({ name, status, conclusion, url: html_url ?? null }));
    const reports = new Map(read.check_runs.map((run) => [run.name, run.output?.text ?? null] as const));
    return { ok: true, value: { runs, reports } };
  } catch (error) {
    return { ok: false, why: `could not read the check runs of ${head.slice(0, 8)}: ${failure(error)}` };
  }
}

/** The acceptance report the `acceptance` run carries; null while there is no such run or it has no text. */
function readReport(runs: Readable<RunRead>): Readable<AcceptanceReport | null> {
  if (!runs.ok) return runs;
  const text = runs.value.reports.get(ACCEPTANCE_CHECK_NAME);
  if (text === undefined || text === null || text.trim() === '') return { ok: true, value: null };
  const read = parseAcceptanceReport(text.trim());
  return read.ok ? { ok: true, value: read.report } : { ok: false, why: read.why };
}

/** A file's text at `ref`, `null` when the repository has none there, or why it could not be read. */
function readFile(source: FactsSource, path: string, ref: string): Readable<string | null> {
  try {
    return { ok: true, value: source.gh(['api', '-H', 'Accept: application/vnd.github.raw', `repos/${source.repo}/contents/${path}?ref=${ref}`]) };
  } catch (error) {
    const why = failure(error);
    return isNotFound(why) ? { ok: true, value: null } : { ok: false, why: `could not read ${path} at ${ref.slice(0, 8)}: ${why}` };
  }
}

const CompareSchema = z.object({
  merge_base_commit: z.object({ sha: z.string() }),
  files: z
    .array(z.object({ filename: z.string(), status: z.string(), previous_filename: z.string().optional() }))
    .default([]),
});

/** The text of a file's side of the diff, null when it has none there or could not be read. */
const sideOf = (read: Readable<string | null>): string | null => (read.ok ? read.value : null);

/** The diff of `head` against the default branch, each file with its text at the merge base and at the head. */
function readDiff(source: FactsSource, head: string): Readable<DiffFile[]> {
  let compare: z.infer<typeof CompareSchema>;
  try {
    compare = CompareSchema.parse(JSON.parse(source.gh(['api', `repos/${source.repo}/compare/${source.defaultBranch}...${head}`])));
  } catch (error) {
    return { ok: false, why: `could not read the diff against ${source.defaultBranch}: ${failure(error)}` };
  }
  const base = compare.merge_base_commit.sha;
  return { ok: true, value: compare.files.map((file) => diffFile(source, file, base, head)) };
}

const STATUSES: Record<string, DiffFile['status']> = { added: 'added', removed: 'deleted', renamed: 'renamed' };

/** One file of the compare, with its text at the merge base and at the head; a generated path is never read. */
function diffFile(source: FactsSource, file: { filename: string; status: string; previous_filename?: string | undefined }, base: string, head: string): DiffFile {
  const { filename, previous_filename: previous } = file;
  const status = STATUSES[file.status] ?? 'modified';
  const skipped = source.generated.some((prefix) => filename.startsWith(prefix));
  const before = status === 'added' || skipped ? null : sideOf(readFile(source, previous ?? filename, base));
  const after = status === 'deleted' || skipped ? null : sideOf(readFile(source, filename, head));
  return { path: filename, status, ...(previous === undefined ? {} : { previousPath: previous }), before, after };
}

/** The spec's criteria at `ref`; none (an empty list) when the file is not there. */
function readSpec(source: FactsSource, ref: string): Readable<string | null> {
  return readFile(source, `${source.prd.dir}/spec.md`, ref);
}

/** The slices' territories of the plan at the head, with the PRD's own folders and the generated paths. */
function readArea(source: FactsSource, head: string): ReadyFacts['area'] {
  const plan = readFile(source, `${source.prd.dir}/plan.md`, head);
  if (!plan.ok) return plan;
  if (plan.value === null) return { ok: false, why: `${source.prd.dir}/plan.md is not on the pull request's head` };
  try {
    const territories = parsePlanSlices(plan.value).flatMap((slice) => slice.territory);
    return { ok: true, value: { territories, prdFolders: source.prdFolders, generated: source.generated } };
  } catch (error) {
    return { ok: false, why: `the plan does not read: ${messageOf(error).split('\n')[0] ?? ''}` };
  }
}

const DirSchema = z.array(z.object({ name: z.string(), type: z.string() }));

/** The open items of the PRD's outbox at the head, each with its text; empty when it has no folder. */
function readOpenItems(source: FactsSource, head: string): Readable<{ id: OutboxItemId; text: string }[]> {
  let names: string[];
  try {
    const dir = DirSchema.parse(JSON.parse(source.gh(['api', `repos/${source.repo}/contents/${source.prd.outboxDir}?ref=${head}`])));
    names = dir.filter((entry) => entry.type === 'file' && entry.name.endsWith('.md') && entry.name !== SETTLED_FILE).map((entry) => entry.name);
  } catch (error) {
    const why = failure(error);
    return isNotFound(why) ? { ok: true, value: [] } : { ok: false, why: `could not list ${source.prd.outboxDir}: ${why}` };
  }
  const items: { id: OutboxItemId; text: string }[] = [];
  for (const name of names) {
    const id = OutboxItemIdSchema.safeParse(name.slice(0, -'.md'.length));
    if (!id.success) continue;
    const text = readFile(source, `${source.prd.outboxDir}/${name}`, head);
    if (!text.ok) return text;
    if (text.value !== null) items.push({ id: id.data, text: text.value });
  }
  return { ok: true, value: items };
}

/** The ledger at the head: each settled entry and each open item, as the ready rule reads them. */
function readLedger(source: FactsSource, head: string): ReadyFacts['ledger'] {
  const settled = readFile(source, `${source.prd.outboxDir}/${SETTLED_FILE}`, head);
  if (!settled.ok) return settled;
  const open = readOpenItems(source, head);
  if (!open.ok) return open;
  const entries = settled.value === null ? [] : parseSettledEntries(settled.value, source.markers);
  return { ok: true, value: excuseItems({ settled: entries, open: open.value }) };
}

/** A criteria list of the spec at `ref`, parsed. */
const criteriaOf = (spec: Readable<string | null>): Readable<ParsedCriteria> => {
  if (!spec.ok) return spec;
  return { ok: true, value: spec.value === null ? { criteria: [], problems: [] } : parseCriteria(spec.value) };
};

/** The criteria of the spec on the default branch; none when the spec is not there yet. */
const baseCriteriaOf = (spec: Readable<string | null>): Readable<readonly Criterion[]> => {
  const parsed = criteriaOf(spec);
  return parsed.ok ? { ok: true, value: parsed.value.criteria } : parsed;
};

/** Everything the ready rule reads of `pr`, through `gh`, at its latest commit. */
export function readFacts(source: FactsSource, pr: FeaturePr): ReadyFacts {
  const runs = readRuns(source, pr.head);
  return {
    head: pr.head,
    runs: runs.ok ? { ok: true, value: runs.value.runs } : runs,
    full: source.full,
    criteria: criteriaOf(readSpec(source, pr.head)),
    baseCriteria: baseCriteriaOf(readSpec(source, source.defaultBranch)),
    report: readReport(runs),
    diff: readDiff(source, pr.head),
    area: readArea(source, pr.head),
    ledger: readLedger(source, pr.head),
  };
}
