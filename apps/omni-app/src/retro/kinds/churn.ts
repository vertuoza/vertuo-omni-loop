// Code rewritten again and again (PRD 72, "The facts, and what makes a finding"): every commit's
// patches, churn per file and per line range followed through the hunks, generated files and
// lockfiles left out, a file without a patch counted by its totals. Its findings are `churn:<path>`
// and `churn:<path>:<from>-<to>`; its thresholds are in `rules`.
//
// `gather` reads, for each pull request merged into the feature branch, its commits (a merge commit
// left out: its diff repeats work already merged), each commit's files with its patch reduced to change
// blocks (`churn-lines.mjs`), the feature PR's final diff, and `.gitattributes` at the merge. Pull
// requests closed without merging are not read: their lines never reached the feature branch.
//
// `detect` is pure. It walks the commits in the order they reached the feature branch (pull requests
// by merge, commits as listed) and counts, per file, the lines added across every commit minus the
// lines added in the final diff; and, per line, the commits that wrote it (`followLines`). A file is a
// finding when its churn reaches both `THRESHOLDS.churnFilePercent` of its final added lines and
// `THRESHOLDS.churnFileLines`; a run of lines each written in `THRESHOLDS.churnRangeCommits` commits or
// more is one. A file GitHub sent without a patch counts by its totals and is named; its lines are no
// longer followed. What GitHub did not return is named, never guessed.
import { THRESHOLDS } from '../rules.ts';
import { PER_PAGE, paginate, readContent } from '../github.ts';
import { leftOutAs } from './churn-generated.ts';
import { changeBlocks, followLines, rewrittenRanges } from './churn-lines.ts';
import type { Block, Line } from './churn-lines.ts';
import type { LeftOut } from './churn-generated.ts';
import type { Evidence, GatherScope, Kind, Octokit, RetroPr, RetroPrd } from './index.ts';
import { ChangedFileSchema, CommitPageSchema, PullCommitSchema } from './schema.ts';
import type { ChangedFile, PullCommit } from './schema.ts';
import type { Config } from 'vertuo-omni-plan/kit/lib/types.ts';
import { defined } from 'vertuo-omni-plan/kit/lib/narrow.ts';

type FinalFile = { path: string; additions: number | null | undefined; deletions: number | null | undefined };
type CommitFile = {
  path: string;
  previous: string | null;
  status: string | null | undefined;
  additions: number;
  deletions: number;
  blocks: Block[] | null;
};
type CommitRecord = { sha: string; url: string | null; files: CommitFile[] | null };
type PullRecord = { number: number; url: string | null; headRef: string; mergedAt: string | null; commits: CommitRecord[] | null };
type Records = { gitattributes: string | null; final: FinalFile[] | null; pulls: PullRecord[] };
type Repo = { owner: string; repo: string };

type Walked = ReturnType<typeof walk>;
type CommitSeen = { short: string; url: string | null; slice: string; index: number };
type FileStats = { added: number; commits: Set<string> };
type NoPatch = { path: string; commit: string; slice: string; additions: number; deletions: number };
type FileChurn = { path: string; commits: number; added: number; finalAdded: number; churn: number; percent: number | null };
type Rewritten = { path: string; from: number; to: number; shas: string[]; slices: string[] };

type Facts = {
  pulls: number;
  commits: number;
  added: number;
  finalAdded: number | null;
  churn: number | null;
  files: FileChurn[] | null;
  ranges: { path: string; from: number; to: number; commits: string[]; slices: string[] }[];
  leftOut: Record<LeftOut, string[]>;
  noPatch: NoPatch[];
  unread: { pulls: number[]; commits: string[] };
  notCounted: number[];
};

const SHORT = 7;

export const churn: Kind<Records | null, Facts> = Object.freeze({
  id: 'churn',
  section: 'Churn',
  runs: Object.freeze(['merge'] as const),

  async gather(octokit, { owner, repo, mergeSha, pr, pulls }: GatherScope) {
    const merged = (pulls ?? []).filter((pull) => pull.mergedAt);
    if (merged.length === 0) return null;

    const gitattributes: string | null = await readContent(octokit, { owner, repo, ref: mergeSha, path: '.gitattributes' });
    const final = await unlessMissing([404], async () =>
      (await listPullFiles(octokit, { owner, repo, number: pr.number })).map((file): FinalFile => ({
        path: file.filename,
        additions: file.additions,
        deletions: file.deletions,
      })),
    );

    const seen = new Set<string>();
    const read: PullRecord[] = [];
    for (const pull of merged) {
      const listed = await unlessMissing([404], () => listPullCommits(octokit, { owner, repo, number: pull.number }));
      const commits: CommitRecord[] = [];
      for (const item of listed ?? []) {
        if ((item.parents?.length ?? 0) > 1 || seen.has(item.sha)) continue;
        seen.add(item.sha);
        commits.push(await readCommit(octokit, { owner, repo, sha: item.sha }));
      }
      read.push({ number: pull.number, url: pull.url, headRef: pull.headRef, mergedAt: pull.mergedAt, commits: listed ? commits : null });
    }
    return { gitattributes, final, pulls: read };
  },

  detect(records, { pr, prd, config, pulls }) {
    if (!records) return { facts: null, findings: [] };
    const walked = walk(records, { sliceOf: sliceReader(config, prd), leftOut: leftOutAs(records.gitattributes ?? null, { delivery: config.paths.delivery }) });
    const final = records.final ? new Map(records.final.map((file) => [file.path, file.additions])) : null;
    const perFile = final ? churnPerFile(walked.files, final) : null;
    const ranges = rewritten(walked);

    const facts: Facts = {
      pulls: walked.pulls,
      commits: walked.read,
      added: [...walked.files.values()].reduce((total, stats) => total + stats.added, 0),
      finalAdded: final ? [...walked.files.keys()].reduce((total, path) => total + (final.get(path) ?? 0), 0) : null,
      churn: perFile ? perFile.reduce((total, file) => total + file.churn, 0) : null,
      files: perFile,
      ranges: ranges.map(({ path, from, to, shas, slices }) => ({
        path,
        from,
        to,
        commits: shas.map((sha) => defined(walked.commits.get(sha), `the walked commit ${sha}`).short),
        slices,
      })),
      leftOut: {
        generated: [...walked.left.generated].sort(),
        lockfile: [...walked.left.lockfile].sort(),
        delivery: [...walked.left.delivery].sort(),
      },
      noPatch: walked.noPatch,
      unread: walked.unread,
      notCounted: pulls.filter((pull) => !pull.mergedAt).map((pull) => pull.number),
    };

    const links = linker(pr, walked.commits);
    const fileFindings = (perFile ?? [])
      .filter((file) => file.churn >= THRESHOLDS.churnFileLines && file.churn * 100 >= THRESHOLDS.churnFilePercent * file.finalAdded)
      .map((file) => {
        const blob = file.finalAdded > 0 ? links.blob(file.path) : null;
        return {
          id: `churn:${file.path}`,
          kind: 'churn',
          title: `Much of \`${file.path}\` was written, then rewritten`,
          happened: fileHappened(file, walked.noPatch.filter((entry) => entry.path === file.path)),
          evidence: [
            ...links.commits(defined(walked.files.get(file.path), `the walked file ${file.path}`).commits),
            ...(blob ? [{ label: `\`${file.path}\`, as merged`, url: blob }] : []),
          ],
        };
      });
    const rangeFindings = ranges.map(({ path, from, to, shas, slices }) => {
      const blob = links.blob(path, `#L${from}-L${to}`);
      return {
        id: `churn:${path}:${from}-${to}`,
        kind: 'churn',
        title: `Lines ${from}-${to} of \`${path}\` were rewritten again and again`,
        happened: `Lines ${from}-${to} of \`${path}\`, as merged, were written and rewritten in ${shas.length} commits, in ${and(slices)}; the rules flag a line range rewritten in ${THRESHOLDS.churnRangeCommits} or more commits.`,
        evidence: [...links.commits(shas), ...(blob ? [{ label: `\`${path}\` lines ${from}-${to}, as merged`, url: blob }] : [])],
      };
    });

    return { facts, findings: [...fileFindings, ...rangeFindings] };
  },

  describe(facts) {
    if (!facts || facts.commits === 0) return null;
    const pulls = `${facts.pulls} merged pull request${facts.pulls === 1 ? '' : 's'}`;
    const commits = `${facts.commits} commit${facts.commits === 1 ? '' : 's'}`;
    const lines = [
      facts.files === null
        ? `- ${commits} read across ${pulls}: ${facts.added} lines added; the final diff could not be read, so no file’s churn is counted.`
        : `- ${commits} read across ${pulls}: ${facts.added} lines added, ${facts.finalAdded} in the final diff, ${facts.churn} lines of churn.`,
    ];
    const paths = (list: readonly string[]) => list.map((path) => `\`${path}\``).join(', ');
    if (facts.leftOut.generated.length > 0) lines.push(`- Left out as generated, by \`.gitattributes\`: ${paths(facts.leftOut.generated)}.`);
    if (facts.leftOut.lockfile.length > 0) lines.push(`- Left out as lockfiles: ${paths(facts.leftOut.lockfile)}.`);
    // Read back from an earlier run's retro.json too, which may predate the delivery record being left out.
    const kept: { delivery?: readonly string[] } = facts.leftOut;
    const delivery = kept.delivery ?? [];
    if (delivery.length > 0) lines.push(`- Left out as the loop's own delivery record: ${paths(delivery)}.`);
    for (const file of facts.noPatch) {
      lines.push(
        `- GitHub sent no patch for \`${file.path}\` in ${file.commit} (${file.slice}): counted by its totals, ${file.additions} added and ${file.deletions} removed, its lines not followed.`,
      );
    }
    if (facts.unread.pulls.length > 0) {
      lines.push(`- Not read: the commits of ${and(facts.unread.pulls.map((n) => `#${n}`))}, which GitHub did not return.`);
    }
    for (const commit of facts.unread.commits) lines.push(`- Not read: commit ${commit}, whose diff GitHub did not return.`);
    if (facts.notCounted.length > 0) lines.push(`- Not counted: ${and(facts.notCounted.map((n) => `#${n}`))}, never merged.`);
    return lines;
  },
});

/**
 * Every commit read, in the order it reached the feature branch: pull requests by merge, commits as
 * listed. Counts each file's lines added and the commits that changed it, following renames, and
 * follows each line to the commits that wrote it.
 */
function walk(
  records: Records,
  { sliceOf, leftOut }: { sliceOf: (headRef: unknown) => string | null; leftOut: (path: string) => LeftOut | null },
) {
  const commits = new Map<string, CommitSeen>();
  const files = new Map<string, FileStats>();
  const lines = new Map<string, Line[]>();
  const left: Record<LeftOut, Set<string>> = { generated: new Set(), lockfile: new Set(), delivery: new Set() };
  const noPatch: NoPatch[] = [];
  const unread: { pulls: number[]; commits: string[] } = { pulls: [], commits: [] };
  let pulls = 0;
  let read = 0;

  const order = [...records.pulls].sort((a, b) => (a.mergedAt ?? '').localeCompare(b.mergedAt ?? '') || a.number - b.number);
  for (const pull of order) {
    if (pull.commits === null) {
      unread.pulls.push(pull.number);
      continue;
    }
    pulls += 1;
    const slice = sliceOf(pull.headRef) ?? `#${pull.number}`;
    for (const commit of pull.commits) {
      if (commits.has(commit.sha)) continue;
      const short = commit.sha.slice(0, SHORT);
      commits.set(commit.sha, { short, url: commit.url, slice, index: commits.size });
      if (commit.files === null) {
        unread.commits.push(short);
        continue;
      }
      read += 1;
      for (const file of commit.files) {
        const why = leftOut(file.path);
        if (why) {
          left[why].add(file.path);
          continue;
        }
        if (file.previous && file.previous !== file.path) rename(files, lines, file.previous, file.path);
        const stats = files.get(file.path) ?? { added: 0, commits: new Set() };
        stats.added += file.additions;
        stats.commits.add(commit.sha);
        files.set(file.path, stats);

        if (file.status === 'removed') lines.delete(file.path);
        else if (file.blocks !== null) {
          const before = file.status === 'added' ? [] : (lines.get(file.path) ?? []);
          lines.set(file.path, followLines(before, file.blocks, commit.sha));
        } else if (file.additions + file.deletions > 0) {
          // Without a patch the file's lines can no longer be placed, so they are no longer followed.
          noPatch.push({ path: file.path, commit: short, slice, additions: file.additions, deletions: file.deletions });
          lines.delete(file.path);
        }
      }
    }
  }
  return { commits, files, lines, left, noPatch, unread, pulls, read };
}

/** Each file's churn against the final diff (`path → lines added`), most first; a file with none is left out. */
function churnPerFile(files: Map<string, FileStats>, final: Map<string, number | null | undefined>): FileChurn[] {
  return [...files.entries()]
    .map(([path, stats]) => {
      const finalAdded = final.get(path) ?? 0;
      const churn = Math.max(0, stats.added - finalAdded);
      return {
        path,
        commits: stats.commits.size,
        added: stats.added,
        finalAdded,
        churn,
        percent: finalAdded > 0 ? Math.round((churn * 100) / finalAdded) : null,
      };
    })
    .filter((file) => file.churn > 0)
    .sort((a, b) => b.churn - a.churn || a.path.localeCompare(b.path));
}

/** The line ranges written in enough commits, most commits first: each with its commits, oldest first, and their slices. */
function rewritten({ lines, commits }: Pick<Walked, 'lines' | 'commits'>): Rewritten[] {
  const commitOf = (sha: string) => defined(commits.get(sha), `the walked commit ${sha}`);
  const indexOf = (sha: string) => commitOf(sha).index;
  const byIndex = (a: string, b: string) => indexOf(a) - indexOf(b);
  return [...lines.entries()]
    .flatMap(([path, followed]) =>
      rewrittenRanges(followed, THRESHOLDS.churnRangeCommits).map((range) => {
        const shas = [...range.commits].sort(byIndex);
        return { path, from: range.from, to: range.to, shas, slices: unique(shas.map((sha) => commitOf(sha).slice)) };
      }),
    )
    .sort((a, b) => b.shas.length - a.shas.length || a.path.localeCompare(b.path) || a.from - b.from);
}

/** The evidence links: commits, oldest first, and a file at the feature PR's head. */
function linker(pr: RetroPr | undefined, commits: Map<string, CommitSeen>) {
  const repoUrl = typeof pr?.url === 'string' ? pr.url.replace(/\/pull\/\d+$/, '') : null;
  return {
    commits: (shas: Iterable<string>): Evidence[] =>
      [...shas]
        .map((sha) => ({ sha, ...(commits.get(sha) as CommitSeen) })) // ts-allow: every sha linked is a commit walked
        .sort((a, b) => a.index - b.index)
        .map((commit) => ({
          label: `${commit.short} (${commit.slice})`,
          url: commit.url ?? (repoUrl ? `${repoUrl}/commit/${commit.sha}` : null),
        })),
    blob: (path: string, anchor = ''): string | null =>
      repoUrl && pr?.headSha ? `${repoUrl}/blob/${pr.headSha}/${path.split('/').map(encodeURIComponent).join('/')}${anchor}` : null,
  };
}

/** What happened to a file whose churn crossed both thresholds, every number from its facts or `rules`. */
function fileHappened(file: FileChurn, noPatch: readonly NoPatch[]): string {
  const kept = file.finalAdded > 0 ? `${file.finalAdded} of them in the final diff` : 'none of them in the final diff';
  const share = file.percent === null ? '' : `, ${file.percent}% of its final added lines`;
  const sentences = [
    `\`${file.path}\` had ${file.added} lines added across ${file.commits} commits, ${kept}: ${file.churn} lines of churn${share}.`,
    `The rules flag a file whose churn is at least ${THRESHOLDS.churnFilePercent}% of its final added lines and at least ${THRESHOLDS.churnFileLines} lines.`,
  ];
  for (const entry of noPatch) sentences.push(`GitHub sent no patch for it in ${entry.commit}, so that commit is counted by its totals.`);
  return sentences.join(' ');
}

/** Moves what was counted under a file's old name to its new one. */
function rename(files: Map<string, FileStats>, lines: Map<string, Line[]>, from: string, to: string): void {
  const moved = files.get(from);
  if (moved !== undefined) {
    const existing = files.get(to);
    files.set(to, existing ? { added: existing.added + moved.added, commits: new Set([...existing.commits, ...moved.commits]) } : moved);
    files.delete(from);
  }
  const followed = lines.get(from);
  if (followed !== undefined) {
    lines.set(to, followed);
    lines.delete(from);
  }
}

/** The slice id a head branch names through `branches.slice` (its topic filled), or `null`. */
function sliceReader(config: Config | undefined, prd: RetroPrd | undefined): (headRef: unknown) => string | null {
  const template = config?.branches.slice.replace('{topic}', prd?.topic ?? '') ?? null;
  const [prefix, suffix = ''] = template?.split('{slice}') ?? [];
  return (headRef) => {
    if (!template || typeof headRef !== 'string' || !headRef.startsWith(prefix ?? '') || !headRef.endsWith(suffix)) return null;
    const slice = headRef.slice((prefix ?? '').length, headRef.length - suffix.length);
    return slice && !slice.includes('/') ? slice : null;
  };
}

async function listPullCommits(octokit: Octokit, { owner, repo, number }: Repo & { number: number }): Promise<PullCommit[]> {
  return paginate((page: number) =>
    octokit
      .request('GET /repos/{owner}/{repo}/pulls/{pull_number}/commits', { owner, repo, pull_number: number, per_page: PER_PAGE, page })
      .then(({ data }) => PullCommitSchema.array().parse(data)),
  );
}

async function listPullFiles(octokit: Octokit, { owner, repo, number }: Repo & { number: number }): Promise<ChangedFile[]> {
  return paginate((page: number) =>
    octokit
      .request('GET /repos/{owner}/{repo}/pulls/{pull_number}/files', { owner, repo, pull_number: number, per_page: PER_PAGE, page })
      .then(({ data }) => ChangedFileSchema.array().parse(data)),
  );
}

/** One commit's files, each patch reduced to its change blocks; `files: null` when GitHub has no diff for it. */
async function readCommit(octokit: Octokit, { owner, repo, sha }: Repo & { sha: string }): Promise<CommitRecord> {
  let url: string | null = null;
  const files = await unlessMissing([404, 422], (): Promise<ChangedFile[]> =>
    paginate((page: number) =>
      octokit.request('GET /repos/{owner}/{repo}/commits/{ref}', { owner, repo, ref: sha, per_page: PER_PAGE, page }).then(({ data: answer }) => {
        const data = CommitPageSchema.parse(answer);
        url ??= data.html_url ?? null;
        return data.files ?? [];
      }),
    ),
  );
  if (files === null) return { sha, url: null, files: null };
  return {
    sha,
    url,
    files: files.map((file) => ({
      path: file.filename,
      previous: file.previous_filename ?? null,
      status: file.status,
      additions: file.additions ?? 0,
      deletions: file.deletions ?? 0,
      blocks: typeof file.patch === 'string' ? changeBlocks(file.patch) : null,
    })),
  };
}

/** What `read` returns, or `null` when GitHub answers one of `statuses`: it does not have it. Anything else is thrown, so Inngest retries. */
async function unlessMissing<T>(statuses: readonly unknown[], read: () => Promise<T>): Promise<T | null> {
  try {
    return await read();
  } catch (error) {
    if (statuses.includes(statusOf(error))) return null;
    throw error;
  }
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

/** `a`, `a and b`, `a, b and c`. */
function and(items: readonly string[]): string {
  return items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

/** The HTTP status a failed request carries, when it carries one. */
function statusOf(error: unknown): unknown {
  return typeof error === 'object' && error !== null && 'status' in error ? error.status : undefined;
}
