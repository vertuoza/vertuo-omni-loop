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
import { THRESHOLDS } from '../rules.mjs';
import { PER_PAGE, paginate, readContent } from '../github.mjs';
import { leftOutAs } from './churn-generated.mjs';
import { changeBlocks, followLines, rewrittenRanges } from './churn-lines.mjs';

const SHORT = 7;

/** @type {import('./index.mjs').Kind} */
export const churn = Object.freeze({
  id: 'churn',
  section: 'Churn',
  runs: Object.freeze(['merge']),

  async gather(octokit, { owner, repo, mergeSha, pr, pulls }) {
    const merged = (pulls ?? []).filter((pull) => pull.mergedAt);
    if (merged.length === 0) return null;

    const gitattributes = await readContent(octokit, { owner, repo, ref: mergeSha, path: '.gitattributes' });
    const final = await unlessMissing([404], async () =>
      (await listPullFiles(octokit, { owner, repo, number: pr.number })).map((file) => ({
        path: file.filename,
        additions: file.additions,
        deletions: file.deletions,
      })),
    );

    const seen = new Set();
    const read = [];
    for (const pull of merged) {
      const listed = await unlessMissing([404], () => listPullCommits(octokit, { owner, repo, number: pull.number }));
      const commits = [];
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
    const leftOut = leftOutAs(records.gitattributes ?? null);
    const sliceOf = sliceReader(config, prd);
    const repoUrl = typeof pr?.url === 'string' ? pr.url.replace(/\/pull\/\d+$/, '') : null;

    const commits = new Map(); // sha → { short, url, label, index }
    const files = new Map(); // path → { added, commits: Set<sha> }
    const lines = new Map(); // path → [line, commits][]
    const left = { generated: new Set(), lockfile: new Set() };
    const noPatch = [];
    const unread = { pulls: [], commits: [] };
    let read = 0;

    const order = [...records.pulls].sort((a, b) => (a.mergedAt ?? '').localeCompare(b.mergedAt ?? '') || a.number - b.number);
    for (const pull of order) {
      if (pull.commits === null) {
        unread.pulls.push(pull.number);
        continue;
      }
      const label = sliceOf(pull.headRef) ?? `#${pull.number}`;
      for (const commit of pull.commits) {
        if (commits.has(commit.sha)) continue;
        const short = commit.sha.slice(0, SHORT);
        const url = commit.url ?? (repoUrl ? `${repoUrl}/commit/${commit.sha}` : null);
        commits.set(commit.sha, { short, url, label, index: commits.size });
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
          else if (file.blocks === null) {
            if (file.additions + file.deletions > 0) {
              noPatch.push({ path: file.path, commit: short, slice: label, additions: file.additions, deletions: file.deletions });
              lines.delete(file.path);
            }
          } else {
            const before = file.status === 'added' ? [] : (lines.get(file.path) ?? []);
            lines.set(file.path, followLines(before, file.blocks, commit.sha));
          }
        }
      }
    }

    const final = records.final ? new Map(records.final.map((file) => [file.path, file])) : null;
    const perFile = final
      ? [...files.entries()]
          .map(([path, stats]) => {
            const finalAdded = final.get(path)?.additions ?? 0;
            const churned = Math.max(0, stats.added - finalAdded);
            return {
              path,
              commits: stats.commits.size,
              added: stats.added,
              finalAdded,
              churn: churned,
              percent: finalAdded > 0 ? Math.round((churned * 100) / finalAdded) : null,
            };
          })
          .filter((file) => file.churn > 0)
          .sort((a, b) => b.churn - a.churn || a.path.localeCompare(b.path))
      : null;

    const byIndex = (a, b) => commits.get(a).index - commits.get(b).index;
    const ranges = [...lines.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .flatMap(([path, followed]) =>
        rewrittenRanges(followed, THRESHOLDS.churnRangeCommits).map((range) => {
          const shas = [...range.commits].sort(byIndex);
          return { path, from: range.from, to: range.to, shas, labels: unique(shas.map((sha) => commits.get(sha).label)) };
        }),
      )
      .sort((a, b) => b.shas.length - a.shas.length || a.path.localeCompare(b.path) || a.from - b.from);

    const sum = (key) => [...files.values()].reduce((total, stats) => total + stats[key], 0);
    const added = sum('added');
    const finalAdded = final ? [...files.keys()].reduce((total, path) => total + (final.get(path)?.additions ?? 0), 0) : null;

    const facts = {
      pulls: order.filter((pull) => pull.commits !== null).length,
      commits: read,
      added,
      finalAdded,
      churn: perFile ? perFile.reduce((total, file) => total + file.churn, 0) : null,
      files: perFile,
      ranges: ranges.map(({ path, from, to, shas, labels }) => ({
        path,
        from,
        to,
        commits: shas.map((sha) => commits.get(sha).short),
        slices: labels,
      })),
      leftOut: { generated: [...left.generated].sort(), lockfile: [...left.lockfile].sort() },
      noPatch,
      unread,
      notCounted: (pulls ?? []).filter((pull) => !pull.mergedAt).map((pull) => pull.number),
    };

    const evidenceOf = (shas) =>
      [...shas].sort(byIndex).map((sha) => {
        const commit = commits.get(sha);
        return { label: `${commit.short} (${commit.label})`, url: commit.url };
      });
    const blob = (path, anchor = '') =>
      repoUrl && pr?.headSha ? [`${repoUrl}/blob/${pr.headSha}/${path.split('/').map(encodeURIComponent).join('/')}${anchor}`] : [];

    const fileFindings = (perFile ?? [])
      .filter((file) => file.churn >= THRESHOLDS.churnFileLines && file.churn * 100 >= THRESHOLDS.churnFilePercent * file.finalAdded)
      .map((file) => ({
        id: `churn:${file.path}`,
        kind: 'churn',
        title: `Much of \`${file.path}\` was written, then rewritten`,
        happened: fileHappened(file, noPatch.filter((entry) => entry.path === file.path)),
        evidence: [
          ...evidenceOf(files.get(file.path).commits),
          ...(file.finalAdded > 0 ? blob(file.path).map((url) => ({ label: `\`${file.path}\`, as merged`, url })) : []),
        ],
      }));

    const rangeFindings = ranges.map(({ path, from, to, shas, labels }) => ({
      id: `churn:${path}:${from}-${to}`,
      kind: 'churn',
      title: `Lines ${from}-${to} of \`${path}\` were rewritten again and again`,
      happened: `Lines ${from}-${to} of \`${path}\`, as merged, were written and rewritten in ${shas.length} commits, in ${and(labels)}; the rules flag a line range rewritten in ${THRESHOLDS.churnRangeCommits} or more commits.`,
      evidence: [
        ...evidenceOf(shas),
        ...blob(path, `#L${from}-L${to}`).map((url) => ({ label: `\`${path}\` lines ${from}-${to}, as merged`, url })),
      ],
    }));

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
    const paths = (list) => list.map((path) => `\`${path}\``).join(', ');
    if (facts.leftOut.generated.length > 0) lines.push(`- Left out as generated, by \`.gitattributes\`: ${paths(facts.leftOut.generated)}.`);
    if (facts.leftOut.lockfile.length > 0) lines.push(`- Left out as lockfiles: ${paths(facts.leftOut.lockfile)}.`);
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

/** What happened to a file whose churn crossed both thresholds, every number from its facts or `rules`. */
function fileHappened(file, noPatch) {
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
function rename(files, lines, from, to) {
  if (files.has(from)) {
    const moved = files.get(from);
    const existing = files.get(to);
    files.set(to, existing ? { added: existing.added + moved.added, commits: new Set([...existing.commits, ...moved.commits]) } : moved);
    files.delete(from);
  }
  if (lines.has(from)) {
    lines.set(to, lines.get(from));
    lines.delete(from);
  }
}

/** The slice id a head branch names through `branches.slice` (its topic filled), or `null`. */
function sliceReader(config, prd) {
  const template = config?.branches?.slice?.replace('{topic}', prd?.topic ?? '') ?? null;
  const [prefix, suffix = ''] = template?.split('{slice}') ?? [];
  return (headRef) => {
    if (!template || typeof headRef !== 'string' || !headRef.startsWith(prefix) || !headRef.endsWith(suffix)) return null;
    const slice = headRef.slice(prefix.length, headRef.length - suffix.length);
    return slice && !slice.includes('/') ? slice : null;
  };
}

async function listPullCommits(octokit, { owner, repo, number }) {
  return paginate((page) =>
    octokit
      .request('GET /repos/{owner}/{repo}/pulls/{pull_number}/commits', { owner, repo, pull_number: number, per_page: PER_PAGE, page })
      .then(({ data }) => data),
  );
}

async function listPullFiles(octokit, { owner, repo, number }) {
  return paginate((page) =>
    octokit
      .request('GET /repos/{owner}/{repo}/pulls/{pull_number}/files', { owner, repo, pull_number: number, per_page: PER_PAGE, page })
      .then(({ data }) => data),
  );
}

/** One commit's files, each patch reduced to its change blocks; `files: null` when GitHub has no diff for it. */
async function readCommit(octokit, { owner, repo, sha }) {
  let url = null;
  const files = await unlessMissing([404, 422], () =>
    paginate((page) =>
      octokit.request('GET /repos/{owner}/{repo}/commits/{ref}', { owner, repo, ref: sha, per_page: PER_PAGE, page }).then(({ data }) => {
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
async function unlessMissing(statuses, read) {
  try {
    return await read();
  } catch (error) {
    if (statuses.includes(error?.status)) return null;
    throw error;
  }
}

function unique(values) {
  return [...new Set(values)];
}

/** `a`, `a and b`, `a, b and c`. */
function and(items) {
  return items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}
