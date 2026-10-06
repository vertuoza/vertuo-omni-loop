// Fourteen days later (PRD 72, "The facts, and what makes a finding"): the `bug` issues naming the
// PRD opened within `THRESHOLDS.afterMergeDays` days of the merge, fixed or not; the files their fixes
// touched, against the churn ranges the merge run found; and the jobs that ran on the merge commit.
// It takes part only in the day-14 run, and its section closes `retro.md`. Its findings are
// `bug:<issue number>`, of the kind `bug`, which `rules` ranks first.
//
// `gather` reads, for the window from the merge to the merge plus the days the rules give:
//   - the issues labelled `bug` updated since the merge, keeping those opened within the window whose
//     title or body names `#<prd>`;
//   - when there are any, the pull requests merged into the default branch within the window whose
//     title or body closes one of them with GitHub's closing words ("Fixes #40"), and each one's files
//     with its patch reduced to change blocks (`churn-lines.mjs`), never its text;
//   - the GitHub Actions jobs of every workflow run on the merge commit, never the check-runs API
//     (decision 14), as `kinds/ci.mjs` reads a slice's;
//   - and, from the merge run's fact sheet (`scope.atMerge`), the churn ranges it found.
// What GitHub will not let the app read is named, never guessed.
//
// `detect` and `describe` are pure. A fix is linked to churn when its change blocks, on the lines of
// the file it changed, overlap a churn range of that file (or of the file it renamed), or when GitHub
// sent it no patch for a file holding one: its lines cannot be placed, so the file is enough.
import { IssueNumberSchema, type IssueNumber, type PrNumber, type PrdNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { THRESHOLDS } from '../rules.ts';
import { PER_PAGE, MAX_PAGES, paginate } from '../github.ts';
import { runJobs } from './jobs.ts';
import type { Block } from './churn-lines.ts';
import type { Evidence, Kind, KindContext, KindScope, Octokit } from './index.ts';
import { ClosedPullSchema, IssueSchema, WorkflowRunsPageSchema } from './schema.ts';
import type { ClosedPull, Issue, Job, WorkflowRun } from './schema.ts';
import { listFiles, readOrRefused, within, type Repo } from './after-merge.reads.ts';
import { AfterMergeRecordsSchema, ChurnAtMergeSchema } from './records.ts';
import { gatherMega, megaUnreadLines, MegaRecordsSchema, placeOf, plannedFor, refOf, type MegaUnread, type PlannedFact } from './after-merge.mega.ts';
import type { z } from 'zod';
import { parseOrThrow } from 'vertuo-omni-plan/kit/lib/schema/parse-or-throw.ts';

/** The after-merge kind's records: the plan repository's, and what a multi-repository PRD adds (PRD 1130). */
const RecordsSchema = AfterMergeRecordsSchema.extend({ mega: MegaRecordsSchema.exactOptional() });

type Records = z.infer<typeof RecordsSchema>;
type Bug = Records['bugs'][number];
type Fix = Records['fixes'][number];
type MergeJob = Records['checks']['jobs'][number];
type MergeChecks = Records['checks'];
type ChurnRange = Records['ranges'][number];
type Unread = Records['unread'][number];

/** A fix placed against a churn range; `repo` names a fix read in a repository of its own (PRD 1130). */
type Link = { fix: PrNumber; repo?: string; path: string; from: number; to: number; finding: string; byFile: boolean };
type BugFacts = {
  number: IssueNumber;
  url: string;
  daysAfterMerge: number;
  closed: boolean;
  fixes: PrNumber[];
  /** A `For PRD #<n>` bug's fixes, as its fix plan names them (PRD 1130); absent for any other bug. */
  planned?: PlannedFact[];
  linked: Link[];
};
type Facts = {
  prd: PrdNumber | null;
  days: number;
  from: string;
  to: string;
  total: number;
  fixed: number;
  linked: number;
  bugs: BugFacts[];
  fixes: { number: PrNumber; url: string; mergedAt: string }[];
  checks: { commit: string; read: boolean; status: number | null; total: number; green: number; red: number; other: number; jobs: MergeJob[] };
  unread: Unread[];
  /** A multi-repository PRD's: how many bugs carry `For PRD #<n>`, and what was not read. */
  mega?: { bugs: number; unread: MegaUnread[] };
};

/** The label a bug report carries, as GitHub names it in every new repository. */
export const BUG_LABEL = 'bug';

const ISSUES = 'GET /repos/{owner}/{repo}/issues';
const PULLS = 'GET /repos/{owner}/{repo}/pulls';
const RUNS = 'GET /repos/{owner}/{repo}/actions/runs';

const DAY_MS = 24 * 60 * 60 * 1000;
const SHORT = 7;
const GREEN: ReadonlySet<string | null> = new Set(['success']);
const RED: ReadonlySet<string | null> = new Set(['failure', 'timed_out', 'startup_failure']);
/** GitHub's closing words, then the issue: `#40`, `owner/repo#40` or its URL. */
const CLOSING = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\b:?\s+(?:https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/issues\/(\d+)|([\w.-]+\/[\w.-]+)#(\d+)|#(\d+))(?!\d)/gi;

/** When the day-14 run wakes, and its window closes: the merge plus `THRESHOLDS.afterMergeDays` days. */
export function followUpAt(mergedAt: string | null): string {
  return new Date(Date.parse(mergedAt ?? '') + THRESHOLDS.afterMergeDays * DAY_MS).toISOString();
}

export const afterMerge: Kind<Records | null, Facts> = Object.freeze({
  id: 'after-merge',
  records: RecordsSchema.nullable(),
  section: 'After merge',
  runs: Object.freeze(['day-14'] as const),

  async gather(octokit: Octokit, { owner, repo, mergeSha, mergedAt, pr, prd, config, atMerge, targets }: Partial<KindScope> = {}) {
    if (!mergedAt || !mergeSha || !prd?.number || !config) return null;
    const window = { from: new Date(mergedAt).toISOString(), to: followUpAt(mergedAt) };
    const unread: Unread[] = [];

    const listed = await readOrRefused((): Promise<Issue[]> =>
      paginate((page: number) =>
        octokit
          .request(ISSUES, { owner, repo, labels: BUG_LABEL, state: 'all', since: window.from, per_page: PER_PAGE, page })
          .then(({ data }) => IssueSchema.array().parse(data)),
      ),
    );
    if (listed.status) unread.push({ read: 'bugs', status: listed.status });
    const megaScope = { owner: owner ?? '', repo: repo ?? '', prd: prd.number, config, window, targets: targets ?? [], atMerge, listed: listed.value ?? [], label: BUG_LABEL };
    const mega = await gatherMega(octokit, megaScope);
    const bugs = withMegaBugs(bugsNaming(listed.value ?? [], { window, names: namesPrd(prd.number, `${owner}/${repo}`) }), mega?.bugs ?? []);

    const fixes = await closingFixes(octokit, { owner, repo, base: config.repo.defaultBranch, window, featurePr: pr?.number, bugs, unread });
    const checks = await mergeJobs(octokit, { owner, repo, mergeSha, unread });
    const churnAtMerge = parseOrThrow(ChurnAtMergeSchema, atMerge?.kinds.churn, "The merge run's churn facts are of an unexpected shape");
    const ranges = (churnAtMerge?.ranges ?? []).map(({ path, from, to }) => ({ path, from, to }));
    return { window, bugs, fixes, checks, ranges, unread, ...(mega ? { mega: mega.mega } : {}) };
  },

  detect(records, { prd }: Partial<KindContext> = {}) {
    if (!records) return { facts: null, findings: [] };
    const { window } = records;
    const fixes = records.fixes.filter((fix) => within(window, fix.mergedAt));
    const bugs = records.bugs.filter((bug) => within(window, bug.createdAt)).map((bug) => bugFacts(bug, { records, fixes }));

    const facts: Facts = {
      prd: prd?.number ?? null,
      days: THRESHOLDS.afterMergeDays,
      from: window.from,
      to: window.to,
      total: bugs.length,
      fixed: bugs.filter((bug) => bug.fixes.length + (bug.planned?.length ?? 0) > 0).length,
      linked: bugs.filter((bug) => bug.linked.length > 0).length,
      bugs,
      fixes: fixes.filter((fix) => bugs.some((bug) => bug.fixes.includes(fix.number))).map(({ number, url, mergedAt }) => ({ number, url, mergedAt })),
      checks: checkFacts(records.checks),
      unread: records.unread,
      ...(records.mega ? { mega: { bugs: bugs.filter((bug) => bug.planned).length, unread: records.mega.unread } } : {}),
    };

    const urlOf = new Map(fixes.map((fix) => [fix.number, fix.url]));
    const findings = bugs.map((bug) => ({
      id: `bug:${bug.number}`,
      kind: 'bug',
      title: `Bug #${bug.number} was reported against the PRD after the merge`,
      happened: happened(bug, facts),
      evidence: [
        { label: `Bug #${bug.number}`, url: bug.url },
        ...bug.fixes.map((n): Evidence => ({ label: `Fix #${n}`, url: urlOf.get(n) ?? null })),
        ...(bug.planned ?? []).map((fix): Evidence => ({ label: `Fix ${refOf(fix)}`, url: fix.url })),
      ],
    }));
    return { facts, findings };
  },

  describe(facts) {
    if (!facts) return null;
    const refused = (read: Unread['read']) => facts.unread.find((entry) => entry.read === read);
    const lines = [...bugLines(facts, refused('bugs')), ...megaLine(facts)];

    const fixUrl = new Map(facts.fixes.map((fix) => [fix.number, fix.url]));
    for (const bug of facts.bugs) lines.push(bugLine(bug, fixUrl));

    const fixesUnread = refused('fixes');
    if (fixesUnread) lines.push(`- The pull requests merged after the merge were not read (GitHub answered ${fixesUnread.status}), so no fix is counted.`);

    lines.push(...checkLines(facts.checks));
    for (const entry of facts.unread.filter((item) => item.read === 'jobs')) {
      lines.push(`- The jobs of workflow run ${entry.run} were not read (GitHub answered ${entry.status}).`);
    }
    for (const entry of facts.unread.filter((item) => item.read === 'files')) {
      lines.push(`- The files of #${entry.pr} were not read (GitHub answered ${entry.status}), so it is not placed against the churn ranges.`);
    }
    lines.push(...megaUnreadLines(facts.mega?.unread ?? []));
    return lines;
  },
});

/** The `bug` issues naming the PRD, opened within the window, by number. */
function bugsNaming(listed: readonly Issue[], { window, names }: { window: Records['window']; names: (text: string) => boolean }): Bug[] {
  return listed
    .filter((issue) => !issue.pull_request && within(window, issue.created_at) && names(`${issue.title ?? ''}\n${issue.body ?? ''}`))
    .map((issue) => ({ number: issue.number, url: issue.html_url, createdAt: issue.created_at, closedAt: issue.closed_at ?? null }))
    .sort((a, b) => a.number - b.number);
}

/** The bugs naming the PRD and the `For PRD #<n>` ones, each once, by number. */
function withMegaBugs(bugs: readonly Bug[], mega: readonly Bug[]): Bug[] {
  const known = new Set(bugs.map((bug) => bug.number));
  return [...bugs, ...mega.filter((bug) => !known.has(bug.number))].sort((a, b) => a.number - b.number);
}

type FixesInput = Repo & { base: string; window: Records['window']; featurePr: PrNumber | undefined; bugs: readonly Bug[]; unread: Unread[] };

/** The pull requests merged into the default branch within the window that close one of the bugs, with their files. */
async function closingFixes(octokit: Octokit, { owner, repo, base, window, featurePr, bugs, unread }: FixesInput): Promise<Fix[]> {
  const fixes: Fix[] = [];
  if (bugs.length === 0) return fixes;
  const wanted = new Set(bugs.map((bug) => bug.number));
  const merged = await readOrRefused(() => mergedSince(octokit, { owner, repo, base, since: window.from }));
  if (merged.status) unread.push({ read: 'fixes', status: merged.status });
  const found = (merged.value ?? [])
    .filter((pull): pull is ClosedPull & { merged_at: string } => pull.number !== featurePr && within(window, pull.merged_at))
    .map((pull) => ({ pull, closes: closedBy(`${pull.title ?? ''}\n${pull.body ?? ''}`, `${owner}/${repo}`).filter((n) => wanted.has(n)) }))
    .filter(({ closes }) => closes.length > 0)
    .sort((a, b) => a.pull.merged_at.localeCompare(b.pull.merged_at) || a.pull.number - b.pull.number);
  for (const { pull, closes } of found) {
    const files = await readOrRefused(() => listFiles(octokit, { owner, repo, number: pull.number }));
    if (files.status) unread.push({ read: 'files', pr: pull.number, status: files.status });
    fixes.push({ number: pull.number, url: pull.html_url, mergedAt: pull.merged_at, closes, files: files.value });
  }
  return fixes;
}

/** One bug's facts: its fixes in the plan repository, a `For PRD #<n>` bug's planned fixes, and the churn each touched. */
function bugFacts(bug: Bug, { records, fixes }: { records: Records; fixes: readonly Fix[] }): BugFacts {
  const { window, ranges, mega } = records;
  const own = fixes.filter((fix) => fix.closes.includes(bug.number));
  const facts: BugFacts = {
    number: bug.number,
    url: bug.url,
    daysAfterMerge: Math.floor((Date.parse(bug.createdAt) - Date.parse(window.from)) / DAY_MS),
    closed: within(window, bug.closedAt),
    fixes: own.map((fix) => fix.number),
    linked: own.flatMap((fix) => linksOf(fix, ranges)),
  };
  if (!mega?.bugs.includes(bug.number)) return facts;
  const planned = plannedFor(mega, { bug: bug.number, window, counted: facts.fixes });
  facts.planned = planned.map(({ repo, number, url }) => ({ repo, number, url }));
  for (const fix of planned) {
    const place = placeOf(mega, fix.repo, ranges);
    facts.linked.push(...linksOf(fix, place.ranges, { repo: fix.repo, prefix: place.prefix }));
  }
  return facts;
}

/** The merge commit's jobs, counted. */
function checkFacts(checks: MergeChecks): Facts['checks'] {
  const { jobs } = checks;
  return {
    commit: checks.commit.slice(0, SHORT),
    read: !checks.status,
    status: checks.status ?? null,
    total: jobs.length,
    green: jobs.filter((job) => GREEN.has(job.conclusion)).length,
    red: jobs.filter((job) => RED.has(job.conclusion)).length,
    other: jobs.filter((job) => !GREEN.has(job.conclusion) && !RED.has(job.conclusion)).length,
    jobs,
  };
}

/** The section's first line: the bugs counted, or why none were. */
function bugLines(facts: Facts, bugsUnread: Unread | undefined): string[] {
  if (bugsUnread) return [`- The \`${BUG_LABEL}\` issues were not read (GitHub answered ${bugsUnread.status}).`];
  if (facts.total === 0) return [`- No \`${BUG_LABEL}\` issue naming #${facts.prd} was opened within ${facts.days} days of the merge.`];
  const issues = facts.total === 1 ? `1 \`${BUG_LABEL}\` issue naming #${facts.prd} was` : `${facts.total} \`${BUG_LABEL}\` issues naming #${facts.prd} were`;
  return [`- ${issues} opened within ${facts.days} days of the merge: ${facts.fixed} fixed within those days, ${facts.linked} linked to churn.`];
}

/** How many of the bugs carry `For PRD #<n>`, when any does. */
function megaLine(facts: Facts): string[] {
  const count = facts.mega?.bugs ?? 0;
  if (count === 0) return [];
  const which = count === 1 ? '1 of them carries' : `${count} of them carry`;
  const plans = count === 1 ? 'its fix plan' : 'their fix plans';
  return [`- ${which} \`For PRD #${facts.prd}\`: the pull requests of ${plans} were read in their own repositories.`];
}

/** One bug's line: when it was opened, its fixes and the churn they touched. */
function bugLine(bug: BugFacts, fixUrl: ReadonlyMap<PrNumber, string>): string {
  const parts = [`opened ${daysText(bug.daysAfterMerge)} after the merge, ${bug.closed ? 'closed' : 'still open'}`];
  const fixed = [...bug.fixes.map((n) => `[#${n}](${fixUrl.get(n)})`), ...(bug.planned ?? []).map((fix) => `[${refOf(fix)}](${fix.url})`)];
  parts.push(fixed.length > 0 ? `fixed by ${and(fixed)}` : 'no fix merged');
  if (bug.linked.length > 0) {
    parts.push(`linked to ${and(bug.linked.map((link) => `\`${link.finding}\` (${refOf({ repo: link.repo, number: link.fix })}${link.byFile ? ', by its file' : ''})`))}`);
  }
  return `- [#${bug.number}](${bug.url}): ${parts.join('; ')}.`;
}

/** The merge commit's jobs, in one line, or why they were not read. */
function checkLines(checks: Facts['checks']): string[] {
  if (!checks.read) {
    return [`- The jobs on the merge commit \`${checks.commit}\` were not read (GitHub answered ${checks.status}). The app reads them with the \`actions: read\` permission.`];
  }
  if (checks.total === 0) return [`- No GitHub Actions job ran on the merge commit \`${checks.commit}\`.`];
  const red = checks.jobs.filter((job) => RED.has(job.conclusion)).map((job) => `\`${job.name}\``);
  const counts = [`${checks.green} green`, `${checks.red} red${red.length > 0 ? ` (${red.join(', ')})` : ''}`];
  if (checks.other > 0) counts.push(`${checks.other} neither`);
  return [`- ${plural(checks.total, 'GitHub Actions job')} ran on the merge commit \`${checks.commit}\`: ${counts.join(', ')}.`];
}

/** What happened to one bug, every number from its facts or the rules. */
function happened(bug: BugFacts, facts: Facts): string {
  const opened = `was opened ${daysText(bug.daysAfterMerge)} after the merge.`;
  const sentences = [
    bug.planned
      ? `Issue #${bug.number} carries \`For PRD #${facts.prd}\` and ${opened}`
      : `Issue #${bug.number}, labelled \`${BUG_LABEL}\`, names #${facts.prd} and ${opened}`,
  ];
  const state = bug.closed ? `It was closed within ${facts.days} days of the merge` : `It was still open ${facts.days} days after the merge`;
  const fixed = [...bug.fixes.map((n) => `#${n}`), ...(bug.planned ?? []).map(refOf)];
  sentences.push(fixed.length > 0 ? `${state}, fixed by ${and(fixed)}.` : `${state}; no pull request closing it was merged by then.`);
  if (bug.linked.length > 0) {
    const links = bug.linked.map((link) => {
      const fix = refOf({ repo: link.repo, number: link.fix });
      return link.byFile
        ? `${fix} changed \`${link.path}\`, which holds \`${link.finding}\`, without a patch to place its lines`
        : `${fix} touched \`${link.finding}\``;
    });
    sentences.push(`A fix touched code rewritten again and again before the merge, so the bug is linked to that churn: ${and(links, ', and ')}.`);
  }
  return sentences.join(' ');
}

/**
 * The churn ranges one fix touched: by its change blocks, or by its file when GitHub sent no patch. A
 * fix read in a repository of its own names it (`repo`), and its findings carry that repository's prefix.
 */
function linksOf(
  fix: { number: PrNumber; files: Fix['files'] },
  ranges: readonly ChurnRange[],
  { repo, prefix = '' }: { repo?: string; prefix?: string } = {},
): Link[] {
  const links: Link[] = [];
  for (const range of ranges) {
    const file = (fix.files ?? []).find((candidate) => candidate.path === range.path || candidate.previous === range.path);
    if (!file) continue;
    const byFile = file.blocks === null;
    if (file.blocks !== null && !file.blocks.some((block) => overlaps(block, range))) continue;
    const finding = `${prefix}churn:${range.path}:${range.from}-${range.to}`;
    links.push({ fix: fix.number, ...(repo ? { repo } : {}), path: range.path, from: range.from, to: range.to, finding, byFile });
  }
  return links;
}

/** A change block against a range of old lines: lines it replaced inside the range, or lines inserted between two of them. */
function overlaps([oldStart, oldCount]: Block, { from, to }: ChurnRange): boolean {
  if (oldCount === 0) return from < oldStart && oldStart <= to;
  return oldStart <= to && oldStart + oldCount - 1 >= from;
}


/** Whether a text names `#<prd>`, or `<owner>/<repo>#<prd>`: not `#70` for `#7`, nor an HTML entity. */
function namesPrd(prd: PrdNumber, slug: string): (text: string) => boolean {
  const pattern = new RegExp(`(?:^|[^\\w&/.-]|${escape(slug)})#${prd}(?!\\d)`, 'i');
  return (text: string) => pattern.test(text);
}

/** The issue numbers of this repository a pull request's text closes. */
function closedBy(text: string, slug: string): IssueNumber[] {
  const numbers: IssueNumber[] = [];
  for (const match of text.matchAll(CLOSING)) {
    const [, urlRepo, urlNumber, refRepo, refNumber, number] = match;
    const repo = urlRepo ?? refRepo;
    if (repo && repo.toLowerCase() !== slug.toLowerCase()) continue;
    const closed = IssueNumberSchema.safeParse(Number(urlNumber ?? refNumber ?? number));
    if (closed.success) numbers.push(closed.data);
  }
  return [...new Set(numbers)];
}

/**
 * The closed pull requests into `base`, most recently updated first, until a page ends before `since`:
 * a pull request merged since then was updated since then too.
 */
async function mergedSince(octokit: Octokit, { owner, repo, base, since }: Repo & { base: string; since: string }): Promise<ClosedPull[]> {
  const all: ClosedPull[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const { data: answer } = await octokit.request(PULLS, { owner, repo, base, state: 'closed', sort: 'updated', direction: 'desc', per_page: PER_PAGE, page });
    const data = ClosedPullSchema.array().parse(answer);
    all.push(...data.filter((pull) => pull.merged_at));
    const last = data.at(-1);
    if (data.length < PER_PAGE || Date.parse(last?.updated_at ?? last?.closed_at ?? '') < Date.parse(since)) break;
  }
  return all;
}


/** The latest jobs of every workflow run on the merge commit, or the status GitHub refused them with. */
async function mergeJobs(
  octokit: Octokit,
  { owner, repo, mergeSha, unread }: Repo & { mergeSha: string; unread: Unread[] },
): Promise<MergeChecks> {
  const runs = await readOrRefused((): Promise<WorkflowRun[]> =>
    paginate((page: number) =>
      octokit
        .request(RUNS, { owner, repo, head_sha: mergeSha, per_page: PER_PAGE, page })
        .then(({ data }) => WorkflowRunsPageSchema.parse(data).workflow_runs ?? []),
    ),
  );
  if (runs.status !== null) return { commit: mergeSha, status: runs.status, jobs: [] };
  const jobs: MergeJob[] = [];
  for (const run of runs.value) {
    const read = await readOrRefused((): Promise<Job[]> => runJobs(octokit, { owner, repo, runId: run.id, filter: 'latest' }));
    if (read.status) unread.push({ read: 'jobs', run: run.id, status: read.status });
    for (const job of read.value ?? []) {
      jobs.push({ name: job.name, workflow: run.name ?? null, conclusion: job.conclusion ?? null, url: job.html_url ?? null });
    }
  }
  return { commit: mergeSha, status: null, jobs };
}


function daysText(days: number): string {
  if (days < 1) return 'less than a day';
  return days === 1 ? '1 day' : `${days} days`;
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

/** `a`, `a and b`, `a, b and c`; `last` joins the last two. */
function and(items: readonly string[], last = ' and '): string {
  return items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')}${last}${items.at(-1)}`;
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

