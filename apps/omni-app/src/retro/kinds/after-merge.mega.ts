// The day-14 look of a multi-repository PRD (PRD 1130, slice s3). Beside the bugs naming `#<prd>`, the
// plan repository holds the issues `/omni:mega-bug-fix` opens: labelled `labels.bug`, their body
// carrying the line `For PRD #<prd>`, and their fix plan in one comment marked
// `<!-- omni-bug:fix-plan -->`, whose table names each fix PR as `owner/name#n` or its link, in order.
//
// `gatherMega` reads, only when the run's scope has targets (`scope.targets`, as the merge run read
// them):
//   - those issues, opened within the window, and each one's fix plan;
//   - each fix PR the plan names, in its own repository, and its files reduced to change blocks;
//   - from the merge run's fact sheet (`scope.atMerge.repositories`), each target's churn ranges.
// A PRD of one repository reads nothing more, and its records carry no `mega`.
//
// The rest is pure: which planned fixes count for a bug, and which churn ranges a fix is placed
// against, its repository's own. A fix PR GitHub will not let the app read is named, never guessed.
//
// The fix PRs are read with the Octokit the kind is given, the plan repository's installation: a
// target in another installation is answered 403 or 404 and listed as not read (item of PRD 1130 s3).
import { z } from 'zod';
import { IssueNumberSchema, PrNumberSchema, type IssueNumber, type PrNumber, type PrdNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { fixPlanRows, linksPrd, FIX_PLAN_MARKER } from 'vertuo-omni-plan/kit/lib/care/list.ts';
import type { Config } from 'vertuo-omni-plan/kit/lib/types.ts';
import { PER_PAGE, paginate } from '../github.ts';
import { shortName } from '../targets.ts';
import type { FactSheet, TargetRead } from '../retro.types.ts';
import type { Octokit } from './index.ts';
import { ChurnAtMergeSchema } from './records.ts';
import { ClosedPullSchema, IssueCommentSchema, IssueSchema } from './schema.ts';
import type { Issue } from './schema.ts';
import { listFiles, readOrRefused, within, type FixFile, type Window } from './after-merge.reads.ts';

const text = z.string();
const BlockSchema = z.tuple([z.number(), z.number(), z.number(), z.number()]);
const RangeSchema = z.object({ path: text, from: z.number(), to: z.number() });

/** One fix PR a mega bug's fix plan names, as read in its own repository. */
const PlannedSchema = z.object({
  bug: IssueNumberSchema,
  repo: text,
  number: PrNumberSchema,
  url: text,
  mergedAt: z.string().nullable(),
  files: z.array(z.object({ path: text, previous: z.string().nullable(), blocks: z.array(BlockSchema).nullable() })).nullable(),
});

/** What GitHub would not let the app read: the `labels.bug` issues, a fix plan, a fix PR or its files. */
const MegaUnreadSchema = z.object({
  read: z.enum(['bugs', 'fix-plan', 'fix', 'files']),
  repo: text,
  number: z.number().exactOptional(),
  status: z.number(),
});

/** The records a multi-repository PRD adds to the after-merge kind's. */
export const MegaRecordsSchema = z.object({
  plan: text,
  bugs: z.array(IssueNumberSchema),
  planned: z.array(PlannedSchema),
  targets: z.array(z.object({ repo: text, name: text, ranges: z.array(RangeSchema) })),
  unread: z.array(MegaUnreadSchema),
});

export type MegaRecords = z.infer<typeof MegaRecordsSchema>;
export type Planned = MegaRecords['planned'][number];
export type MegaUnread = MegaRecords['unread'][number];
type Range = z.infer<typeof RangeSchema>;

/** A planned fix as a bug's facts keep it. */
export type PlannedFact = { repo: string; number: PrNumber; url: string };

const ISSUES = 'GET /repos/{owner}/{repo}/issues';
const COMMENTS = 'GET /repos/{owner}/{repo}/issues/{issue_number}/comments';
const PULL = 'GET /repos/{owner}/{repo}/pulls/{pull_number}';

type MegaScope = {
  owner: string;
  repo: string;
  prd: PrdNumber;
  config: Config;
  window: Window;
  targets: readonly TargetRead[];
  atMerge: FactSheet | undefined;
  /** The issues labelled `bug` the kind listed, read once. */
  listed: readonly Issue[];
  /** The label those issues carry. */
  label: string;
};

/** The mega bugs, opened within the window, as the kind keeps a bug. */
export type MegaBug = { number: IssueNumber; url: string; createdAt: string; closedAt: string | null };

/** The mega bugs and what a multi-repository PRD adds to the records; `null` for a PRD of one repository. */
export async function gatherMega(octokit: Octokit, scope: MegaScope): Promise<{ bugs: MegaBug[]; mega: MegaRecords } | null> {
  if (scope.targets.length === 0) return null;
  const plan = `${scope.owner}/${scope.repo}`;
  const unread: MegaUnread[] = [];
  const issues = await megaIssues(octokit, scope, unread);
  const bugs = issues.map((issue) => ({ number: issue.number, url: issue.html_url, createdAt: issue.created_at, closedAt: issue.closed_at ?? null }));
  const planned: Planned[] = [];
  for (const bug of bugs) planned.push(...(await plannedFixes(octokit, { plan, bug: bug.number }, unread)));
  const targets = scope.targets.map((target) => ({ repo: target.repo, name: target.name, ranges: targetRanges(scope.atMerge, target.repo) }));
  return { bugs, mega: { plan, bugs: bugs.map((bug) => bug.number), planned, targets, unread } };
}

/** The issues of the plan repository carrying `For PRD #<prd>`, opened within the window, by number. */
async function megaIssues(octokit: Octokit, scope: MegaScope, unread: MegaUnread[]): Promise<Issue[]> {
  const { owner, repo, config, window, prd, listed, label } = scope;
  const found = new Map<number, Issue>(listed.map((issue) => [issue.number, issue]));
  if (config.labels.bug !== label) {
    const more = await readOrRefused((): Promise<Issue[]> =>
      paginate((page: number) =>
        octokit
          .request(ISSUES, { owner, repo, labels: config.labels.bug, state: 'all', since: window.from, per_page: PER_PAGE, page })
          .then(({ data }) => IssueSchema.array().parse(data)),
      ),
    );
    if (more.status) unread.push({ read: 'bugs', repo: `${owner}/${repo}`, status: more.status });
    for (const issue of more.value ?? []) found.set(issue.number, issue);
  }
  return [...found.values()]
    .filter((issue) => !issue.pull_request && within(window, issue.created_at) && linksPrd(issue.body, prd))
    .sort((a, b) => a.number - b.number);
}

/** The fix PRs one mega bug's fix plan names, each read in its own repository, in the plan's order. */
async function plannedFixes(octokit: Octokit, { plan, bug }: { plan: string; bug: IssueNumber }, unread: MegaUnread[]): Promise<Planned[]> {
  const [owner, repo] = plan.split('/');
  const comments = await readOrRefused(() =>
    paginate((page: number) =>
      octokit.request(COMMENTS, { owner, repo, issue_number: bug, per_page: PER_PAGE, page }).then(({ data }) => IssueCommentSchema.array().parse(data)),
    ),
  );
  if (comments.status !== null) {
    unread.push({ read: 'fix-plan', repo: plan, number: bug, status: comments.status });
    return [];
  }
  const fixPlan = comments.value.find((comment) => (comment.body ?? '').trimStart().startsWith(FIX_PLAN_MARKER));
  const planned: Planned[] = [];
  for (const row of fixPlanRows(fixPlan?.body)) {
    const fix = await readFix(octokit, { bug, slug: row.slug, number: row.pr }, unread);
    if (fix) planned.push(fix);
  }
  return planned;
}

/** One fix PR, read in its repository, with its files once it merged; `null` when GitHub will not say. */
async function readFix(octokit: Octokit, { bug, slug, number }: { bug: IssueNumber; slug: string; number: PrNumber }, unread: MegaUnread[]): Promise<Planned | null> {
  const [owner, repo] = slug.split('/');
  const pull = await readOrRefused(async () => ClosedPullSchema.parse((await octokit.request(PULL, { owner, repo, pull_number: number })).data));
  if (pull.status !== null) {
    unread.push({ read: 'fix', repo: slug, number, status: pull.status });
    return null;
  }
  const mergedAt = pull.value.merged_at ?? null;
  let files: FixFile[] | null = null;
  if (mergedAt) {
    const read = await readOrRefused(() => listFiles(octokit, { owner, repo, number }));
    if (read.status) unread.push({ read: 'files', repo: slug, number, status: read.status });
    files = read.value;
  }
  return { bug, repo: slug, number, url: pull.value.html_url, mergedAt, files };
}

/** A target's churn ranges, as the merge run's fact sheet holds them; none for a target it did not read. */
function targetRanges(atMerge: FactSheet | undefined, repo: string): Range[] {
  const facts = atMerge?.repositories?.find((entry) => entry.repo === repo);
  const churn = ChurnAtMergeSchema.safeParse(facts?.kinds?.churn);
  return (churn.success ? (churn.data?.ranges ?? []) : []).map(({ path, from, to }) => ({ path, from, to }));
}

// ── pure ─────────────────────────────────────────────────────────────────────────────────────────

/** The fixes of one mega bug that count: merged within the window, and not a plan repository PR already counted. */
export function plannedFor(mega: MegaRecords, { bug, window, counted }: { bug: IssueNumber; window: Window; counted: readonly PrNumber[] }): Planned[] {
  return mega.planned.filter((fix) => fix.bug === bug && within(window, fix.mergedAt) && !(fix.repo === mega.plan && counted.includes(fix.number)));
}

/** Where a planned fix is placed: its repository's churn ranges, and the prefix of that repository's findings. */
export function placeOf(mega: MegaRecords, repo: string, planRanges: readonly Range[]): { ranges: readonly Range[]; prefix: string } {
  if (repo === mega.plan) return { ranges: planRanges, prefix: '' };
  const target = mega.targets.find((entry) => entry.repo === repo);
  return { ranges: target?.ranges ?? [], prefix: `${target?.name ?? shortName(repo)}/` };
}

/** A pull request named in its repository: `#12` in the plan repository's own words, `owner/name#12` otherwise. */
export function refOf(fix: { repo?: string | undefined; number: PrNumber }): string {
  return fix.repo ? `${fix.repo}#${fix.number}` : `#${fix.number}`;
}

/** The lines a multi-repository PRD adds after the bugs: what it could not read. */
export function megaUnreadLines(unread: readonly MegaUnread[]): string[] {
  return unread.map((entry) => {
    const ref = `${entry.repo}#${entry.number ?? ''}`;
    if (entry.read === 'bugs') return `- The bug issues of ${entry.repo} carrying \`For PRD\` were not read (GitHub answered ${entry.status}).`;
    if (entry.read === 'fix-plan') return `- The fix plan of ${ref} was not read (GitHub answered ${entry.status}), so its fixes are not counted.`;
    if (entry.read === 'fix') return `- ${ref} was not read (GitHub answered ${entry.status}), so it is not counted.`;
    return `- The files of ${ref} were not read (GitHub answered ${entry.status}), so it is not placed against the churn ranges of ${entry.repo}.`;
  });
}
