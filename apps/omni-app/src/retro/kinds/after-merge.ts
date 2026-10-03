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
import { THRESHOLDS } from '../rules.ts';
import { PER_PAGE, MAX_PAGES, paginate } from '../github.ts';
import { changeBlocks } from './churn-lines.ts';
import type { Block } from './churn-lines.ts';
import type { Evidence, Kind, KindContext, KindScope, Octokit } from './index.ts';
import { ChangedFileSchema, ClosedPullSchema, IssueSchema, JobsPageSchema, WorkflowRunsPageSchema } from './schema.ts';
import type { ChangedFile, ClosedPull, Issue, Job, WorkflowRun } from './schema.ts';
import { AfterMergeRecordsSchema, ChurnAtMergeSchema } from './records.ts';
import type { z } from 'zod';
import { parseOrThrow } from 'vertuo-omni-plan/kit/lib/schema/parse-or-throw.ts';

type Records = z.infer<typeof AfterMergeRecordsSchema>;
type Bug = Records['bugs'][number];
type Fix = Records['fixes'][number];
type FixFile = NonNullable<Fix['files']>[number];
type MergeJob = Records['checks']['jobs'][number];
type MergeChecks = Records['checks'];
type ChurnRange = Records['ranges'][number];
type Unread = Records['unread'][number];
type Window = Records['window'];
type Repo = { owner: string | undefined; repo: string | undefined };

type Link = { fix: number; path: string; from: number; to: number; finding: string; byFile: boolean };
type BugFacts = { number: number; url: string; daysAfterMerge: number; closed: boolean; fixes: number[]; linked: Link[] };
type Facts = {
  prd: number | null;
  days: number;
  from: string;
  to: string;
  total: number;
  fixed: number;
  linked: number;
  bugs: BugFacts[];
  fixes: { number: number; url: string; mergedAt: string }[];
  checks: { commit: string; read: boolean; status: number | null; total: number; green: number; red: number; other: number; jobs: MergeJob[] };
  unread: Unread[];
};

/** What `readOrRefused` gives: the value read, or the status GitHub refused it with. */
type Read<T> = { value: T; status: null } | { value: null; status: number };

/** The label a bug report carries, as GitHub names it in every new repository. */
export const BUG_LABEL = 'bug';

const ISSUES = 'GET /repos/{owner}/{repo}/issues';
const PULLS = 'GET /repos/{owner}/{repo}/pulls';
const FILES = 'GET /repos/{owner}/{repo}/pulls/{pull_number}/files';
const RUNS = 'GET /repos/{owner}/{repo}/actions/runs';
const JOBS = 'GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs';

const DAY_MS = 24 * 60 * 60 * 1000;
const SHORT = 7;
/** What GitHub answers for what it will not let the app read, or no longer has. */
const UNREADABLE: ReadonlySet<unknown> = new Set([403, 404, 410]);
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
  records: AfterMergeRecordsSchema.nullable(),
  section: 'After merge',
  runs: Object.freeze(['day-14'] as const),

  async gather(octokit: Octokit, { owner, repo, mergeSha, mergedAt, pr, prd, config, atMerge }: Partial<KindScope> = {}) {
    if (!mergedAt || !mergeSha || !prd?.number || !config) return null;
    const window = { from: new Date(mergedAt).toISOString(), to: followUpAt(mergedAt) };
    const unread: Unread[] = [];
    const names = namesPrd(prd.number, `${owner}/${repo}`);

    const listed = await readOrRefused((): Promise<Issue[]> =>
      paginate((page: number) =>
        octokit
          .request(ISSUES, { owner, repo, labels: BUG_LABEL, state: 'all', since: window.from, per_page: PER_PAGE, page })
          .then(({ data }) => IssueSchema.array().parse(data)),
      ),
    );
    if (listed.status) unread.push({ read: 'bugs', status: listed.status });
    const bugs: Bug[] = (listed.value ?? [])
      .filter((issue) => !issue.pull_request && within(window, issue.created_at) && names(`${issue.title ?? ''}\n${issue.body ?? ''}`))
      .map((issue) => ({ number: issue.number, url: issue.html_url, createdAt: issue.created_at, closedAt: issue.closed_at ?? null }))
      .sort((a, b) => a.number - b.number);

    const fixes: Fix[] = [];
    if (bugs.length > 0) {
      const wanted = new Set(bugs.map((bug) => bug.number));
      const merged = await readOrRefused(() => mergedSince(octokit, { owner, repo, base: config.repo.defaultBranch, since: window.from }));
      if (merged.status) unread.push({ read: 'fixes', status: merged.status });
      const found = (merged.value ?? [])
        .filter((pull): pull is ClosedPull & { merged_at: string } => pull.number !== pr?.number && within(window, pull.merged_at))
        .map((pull) => ({ pull, closes: closedBy(`${pull.title ?? ''}\n${pull.body ?? ''}`, `${owner}/${repo}`).filter((n) => wanted.has(n)) }))
        .filter(({ closes }) => closes.length > 0)
        .sort((a, b) => a.pull.merged_at.localeCompare(b.pull.merged_at) || a.pull.number - b.pull.number);
      for (const { pull, closes } of found) {
        const files = await readOrRefused(() => listFiles(octokit, { owner, repo, number: pull.number }));
        if (files.status) unread.push({ read: 'files', pr: pull.number, status: files.status });
        fixes.push({ number: pull.number, url: pull.html_url, mergedAt: pull.merged_at, closes, files: files.value });
      }
    }

    const checks = await mergeJobs(octokit, { owner, repo, mergeSha, unread });
    const churnAtMerge = parseOrThrow(ChurnAtMergeSchema, atMerge?.kinds.churn, "The merge run's churn facts are of an unexpected shape");
    const ranges = (churnAtMerge?.ranges ?? []).map(({ path, from, to }) => ({ path, from, to }));
    return { window, bugs, fixes, checks, ranges, unread };
  },

  detect(records, { prd }: Partial<KindContext> = {}) {
    if (!records) return { facts: null, findings: [] };
    const { window } = records;
    const fixes = records.fixes.filter((fix) => within(window, fix.mergedAt));
    const { ranges } = records;

    const bugs = records.bugs
      .filter((bug) => within(window, bug.createdAt))
      .map((bug) => {
        const own = fixes.filter((fix) => fix.closes.includes(bug.number));
        return {
          number: bug.number,
          url: bug.url,
          daysAfterMerge: Math.floor((Date.parse(bug.createdAt) - Date.parse(window.from)) / DAY_MS),
          closed: within(window, bug.closedAt),
          fixes: own.map((fix) => fix.number),
          linked: own.flatMap((fix) => linksOf(fix, ranges)),
        };
      });

    const { jobs } = records.checks;
    const facts: Facts = {
      prd: prd?.number ?? null,
      days: THRESHOLDS.afterMergeDays,
      from: window.from,
      to: window.to,
      total: bugs.length,
      fixed: bugs.filter((bug) => bug.fixes.length > 0).length,
      linked: bugs.filter((bug) => bug.linked.length > 0).length,
      bugs,
      fixes: fixes.filter((fix) => bugs.some((bug) => bug.fixes.includes(fix.number))).map(({ number, url, mergedAt }) => ({ number, url, mergedAt })),
      checks: {
        commit: records.checks.commit.slice(0, SHORT),
        read: !records.checks.status,
        status: records.checks.status ?? null,
        total: jobs.length,
        green: jobs.filter((job) => GREEN.has(job.conclusion)).length,
        red: jobs.filter((job) => RED.has(job.conclusion)).length,
        other: jobs.filter((job) => !GREEN.has(job.conclusion) && !RED.has(job.conclusion)).length,
        jobs,
      },
      unread: records.unread,
    };

    const urlOf = new Map(fixes.map((fix) => [fix.number, fix.url]));
    const findings = bugs.map((bug) => ({
      id: `bug:${bug.number}`,
      kind: 'bug',
      title: `Bug #${bug.number} was reported against the PRD after the merge`,
      happened: happened(bug, facts),
      evidence: [{ label: `Bug #${bug.number}`, url: bug.url }, ...bug.fixes.map((n): Evidence => ({ label: `Fix #${n}`, url: urlOf.get(n) ?? null }))],
    }));
    return { facts, findings };
  },

  describe(facts) {
    if (!facts) return null;
    const refused = (read: Unread['read']) => facts.unread.find((entry) => entry.read === read);
    const lines: string[] = [];
    const bugsUnread = refused('bugs');
    if (bugsUnread) {
      lines.push(`- The \`${BUG_LABEL}\` issues were not read (GitHub answered ${bugsUnread.status}).`);
    } else if (facts.total === 0) {
      lines.push(`- No \`${BUG_LABEL}\` issue naming #${facts.prd} was opened within ${facts.days} days of the merge.`);
    } else {
      const issues = facts.total === 1 ? `1 \`${BUG_LABEL}\` issue naming #${facts.prd} was` : `${facts.total} \`${BUG_LABEL}\` issues naming #${facts.prd} were`;
      lines.push(`- ${issues} opened within ${facts.days} days of the merge: ${facts.fixed} fixed within those days, ${facts.linked} linked to churn.`);
    }

    const fixUrl = new Map(facts.fixes.map((fix) => [fix.number, fix.url]));
    for (const bug of facts.bugs) {
      const parts = [`opened ${daysText(bug.daysAfterMerge)} after the merge, ${bug.closed ? 'closed' : 'still open'}`];
      parts.push(bug.fixes.length > 0 ? `fixed by ${and(bug.fixes.map((n) => `[#${n}](${fixUrl.get(n)})`))}` : 'no fix merged');
      if (bug.linked.length > 0) {
        parts.push(`linked to ${and(bug.linked.map((link) => `\`${link.finding}\` (#${link.fix}${link.byFile ? ', by its file' : ''})`))}`);
      }
      lines.push(`- [#${bug.number}](${bug.url}): ${parts.join('; ')}.`);
    }

    const fixesUnread = refused('fixes');
    if (fixesUnread) lines.push(`- The pull requests merged after the merge were not read (GitHub answered ${fixesUnread.status}), so no fix is counted.`);

    const { checks } = facts;
    if (!checks.read) {
      lines.push(
        `- The jobs on the merge commit \`${checks.commit}\` were not read (GitHub answered ${checks.status}). The app reads them with the \`actions: read\` permission.`,
      );
    } else if (checks.total === 0) {
      lines.push(`- No GitHub Actions job ran on the merge commit \`${checks.commit}\`.`);
    } else {
      const red = checks.jobs.filter((job) => RED.has(job.conclusion)).map((job) => `\`${job.name}\``);
      const counts = [`${checks.green} green`, `${checks.red} red${red.length > 0 ? ` (${red.join(', ')})` : ''}`];
      if (checks.other > 0) counts.push(`${checks.other} neither`);
      lines.push(`- ${plural(checks.total, 'GitHub Actions job')} ran on the merge commit \`${checks.commit}\`: ${counts.join(', ')}.`);
    }
    for (const entry of facts.unread.filter((item) => item.read === 'jobs')) {
      lines.push(`- The jobs of workflow run ${entry.run} were not read (GitHub answered ${entry.status}).`);
    }
    for (const entry of facts.unread.filter((item) => item.read === 'files')) {
      lines.push(`- The files of #${entry.pr} were not read (GitHub answered ${entry.status}), so it is not placed against the churn ranges.`);
    }
    return lines;
  },
});

/** What happened to one bug, every number from its facts or the rules. */
function happened(bug: BugFacts, facts: Facts): string {
  const sentences = [
    `Issue #${bug.number}, labelled \`${BUG_LABEL}\`, names #${facts.prd} and was opened ${daysText(bug.daysAfterMerge)} after the merge.`,
  ];
  const state = bug.closed ? `It was closed within ${facts.days} days of the merge` : `It was still open ${facts.days} days after the merge`;
  sentences.push(
    bug.fixes.length > 0
      ? `${state}, fixed by ${and(bug.fixes.map((n) => `#${n}`))}.`
      : `${state}; no pull request closing it was merged by then.`,
  );
  if (bug.linked.length > 0) {
    const links = bug.linked.map((link) =>
      link.byFile
        ? `#${link.fix} changed \`${link.path}\`, which holds \`${link.finding}\`, without a patch to place its lines`
        : `#${link.fix} touched \`${link.finding}\``,
    );
    sentences.push(`A fix touched code rewritten again and again before the merge, so the bug is linked to that churn: ${and(links, ', and ')}.`);
  }
  return sentences.join(' ');
}

/** The churn ranges one fix touched: by its change blocks, or by its file when GitHub sent no patch. */
function linksOf(fix: Fix, ranges: readonly ChurnRange[]): Link[] {
  const links: Link[] = [];
  for (const range of ranges) {
    const file = (fix.files ?? []).find((candidate) => candidate.path === range.path || candidate.previous === range.path);
    if (!file) continue;
    const byFile = file.blocks === null;
    if (file.blocks !== null && !file.blocks.some((block) => overlaps(block, range))) continue;
    links.push({ fix: fix.number, path: range.path, from: range.from, to: range.to, finding: `churn:${range.path}:${range.from}-${range.to}`, byFile });
  }
  return links;
}

/** A change block against a range of old lines: lines it replaced inside the range, or lines inserted between two of them. */
function overlaps([oldStart, oldCount]: Block, { from, to }: ChurnRange): boolean {
  if (oldCount === 0) return from < oldStart && oldStart <= to;
  return oldStart <= to && oldStart + oldCount - 1 >= from;
}

/** Whether `at` falls within the window, its ends included. */
function within(window: Window, at: string | null | undefined): at is string {
  if (!at) return false;
  const time = Date.parse(at);
  return time >= Date.parse(window.from) && time <= Date.parse(window.to);
}

/** Whether a text names `#<prd>`, or `<owner>/<repo>#<prd>`: not `#70` for `#7`, nor an HTML entity. */
function namesPrd(prd: number, slug: string): (text: string) => boolean {
  const pattern = new RegExp(`(?:^|[^\\w&/.-]|${escape(slug)})#${prd}(?!\\d)`, 'i');
  return (text: string) => pattern.test(text);
}

/** The issue numbers of this repository a pull request's text closes. */
function closedBy(text: string, slug: string): number[] {
  const numbers: number[] = [];
  for (const match of text.matchAll(CLOSING)) {
    const [, urlRepo, urlNumber, refRepo, refNumber, number] = match;
    const repo = urlRepo ?? refRepo;
    if (repo && repo.toLowerCase() !== slug.toLowerCase()) continue;
    numbers.push(Number(urlNumber ?? refNumber ?? number));
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

/** A pull request's files, each patch reduced to its change blocks (`null` when GitHub sent none). */
async function listFiles(octokit: Octokit, { owner, repo, number }: Repo & { number: number }): Promise<FixFile[]> {
  const files: ChangedFile[] = await paginate((page: number) =>
    octokit.request(FILES, { owner, repo, pull_number: number, per_page: PER_PAGE, page }).then(({ data }) => ChangedFileSchema.array().parse(data)),
  );
  return files.map((file) => ({
    path: file.filename,
    previous: file.previous_filename ?? null,
    blocks: typeof file.patch === 'string' ? changeBlocks(file.patch) : null,
  }));
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
    const read = await readOrRefused((): Promise<Job[]> =>
      paginate((page: number) =>
        octokit
          .request(JOBS, { owner, repo, run_id: run.id, filter: 'latest', per_page: PER_PAGE, page })
          .then(({ data }) => JobsPageSchema.parse(data).jobs ?? []),
      ),
    );
    if (read.status) unread.push({ read: 'jobs', run: run.id, status: read.status });
    for (const job of read.value ?? []) {
      jobs.push({ name: job.name, workflow: run.name ?? null, conclusion: job.conclusion ?? null, url: job.html_url ?? null });
    }
  }
  return { commit: mergeSha, status: null, jobs };
}

/** What `read` returns, or the status when GitHub will not let the app read it. Anything else is thrown, so Inngest retries. */
async function readOrRefused<T>(read: () => Promise<T>): Promise<Read<T>> {
  try {
    return { value: await read(), status: null };
  } catch (error) {
    const status = statusOf(error);
    if (typeof status === 'number' && UNREADABLE.has(status)) return { value: null, status };
    throw error;
  }
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

/** The HTTP status a failed request carries, when it carries one. */
function statusOf(error: unknown): unknown {
  return typeof error === 'object' && error !== null && 'status' in error ? error.status : undefined;
}
