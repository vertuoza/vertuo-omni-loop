// Churn's fixture (PRD 72, slice s4): PRD 7 of `acme/widgets` (`test/retro-scenario.mjs`), its three
// merged sub-PRs given commits whose patches are real unified diffs, as GitHub's REST API returns them.
//
//   #13 (s1)  c1  adds `src/store/colour.js` (20 lines), `pnpm-lock.yaml` and `dist/bundle.js`
//             c2  rewrites lines 5-8 of `colour.js`
//   #14 (s2)  the claim, then
//             c3  inserts 3 lines at the top of `colour.js`, shifting lines 5-8 to 8-11
//             c4  rewrites lines 8-11 of `colour.js`: the range written in c1, c2 and c4, across s1 and s2
//             c5  adds `src/read/at.js` (80), `below-lines.js` (78) and `below-percent.js` (100)
//   #15 (s3)  the claim, then
//             c6  rewrites 40 lines of `at.js`, 39 of `below-lines.js` and 49 of `below-percent.js`
//             c7  adds `src/show/table.js` (120 lines), which GitHub sent without a patch
//             m1  a merge of the feature branch into the slice branch, never read
//             c8  rewrites lines 61-120 of `table.js`
//   #16 (s3)  a first claim of s3, closed without merging, never read
//
// The feature PR's final diff keeps each file's lines as last written: `colour.js` 23, `at.js` 80,
// `below-lines.js` 78, `below-percent.js` 100, `table.js` 120. `.gitattributes` at the merge marks
// `dist/**` generated. So `at.js` churns 40 lines, 50% of 80, exactly at both thresholds;
// `below-lines.js` 39 (50%, a line short); `below-percent.js` 49 (49%); `table.js` 60 (50%), counted by
// its totals; `colour.js` 8.
import { FEATURE, OWNER, REPO, SUB_PULLS } from '../../../../test/retro-scenario.mjs';

export { FEATURE, OWNER, REPO, SUB_PULLS };

export const GITATTRIBUTES = 'dist/** linguist-generated\n';

/** A 40-character SHA from a short tag, so its first seven characters read back as the tag. */
export const sha = (tag) => tag.padEnd(40, '0');
export const short = (tag) => sha(tag).slice(0, 7);

const commitUrl = (tag) => `https://github.com/${OWNER}/${REPO}/commit/${sha(tag)}`;

/** An unmerged first claim of s3. */
export const UNMERGED = {
  number: 16,
  title: 'slice feat/widget--s3',
  state: 'closed',
  draft: false,
  merged: false,
  html_url: `https://github.com/${OWNER}/${REPO}/pull/16`,
  head: { ref: 'feat/widget--s3', sha: 'head16' },
  base: { ref: 'feat/widget', sha: 'base16' },
  labels: [{ name: 'omni:sub' }],
  created_at: '2026-09-20T09:44:00Z',
  closed_at: '2026-09-20T09:45:30Z',
  merged_at: null,
  merge_commit_sha: null,
};

// ---- patches ---------------------------------------------------------------------------------------

const text = (name, n, from = 1) => Array.from({ length: n }, (_, i) => `${name} ${from + i}`);

/** The patch adding a file of `n` lines. */
export function addedPatch(n, name = 'line') {
  return [`@@ -0,0 +1,${n} @@`, ...text(name, n).map((line) => `+${line}`)].join('\n');
}

/**
 * The patch of one hunk on a file of `total` lines: `remove` lines from line `from` replaced by `add`
 * new ones, with up to three lines of context on each side, as git writes it.
 */
export function hunkPatch({ total, from, remove, add, name = 'new' }) {
  const before = Math.max(1, from - 3);
  const after = Math.min(total, from + remove + 2);
  const context = (start, end) => text('line', Math.max(0, end - start + 1), start).map((line) => ` ${line}`);
  const head = context(before, from - 1);
  const tail = context(from + remove, after);
  const oldCount = head.length + remove + tail.length;
  const newCount = head.length + add + tail.length;
  return [
    `@@ -${before},${oldCount} +${before},${newCount} @@`,
    ...head,
    ...text('line', remove, from).map((line) => `-${line}`),
    ...text(name, add, from).map((line) => `+${line}`),
    ...tail,
  ].join('\n');
}

const file = (filename, { status = 'modified', additions, deletions = 0, patch }) => ({
  filename,
  status,
  additions,
  deletions,
  changes: additions + deletions,
  ...(patch === undefined ? {} : { patch }),
});

// ---- commits ---------------------------------------------------------------------------------------

const COLOUR = 'src/store/colour.js';

/** Each commit as `GET /repos/{owner}/{repo}/commits/{ref}` returns it, by tag. */
export const COMMITS = {
  c1: [
    file(COLOUR, { status: 'added', additions: 20, patch: addedPatch(20) }),
    file('pnpm-lock.yaml', { status: 'added', additions: 300, patch: addedPatch(300, 'lock') }),
    file('dist/bundle.js', { status: 'added', additions: 500, patch: addedPatch(500, 'bundle') }),
  ],
  c2: [file(COLOUR, { additions: 4, deletions: 4, patch: hunkPatch({ total: 20, from: 5, remove: 4, add: 4 }) })],
  claim2: [],
  c3: [file(COLOUR, { additions: 3, patch: hunkPatch({ total: 20, from: 1, remove: 0, add: 3, name: 'header' }) })],
  c4: [file(COLOUR, { additions: 4, deletions: 4, patch: hunkPatch({ total: 23, from: 8, remove: 4, add: 4 }) })],
  c5: [
    file('src/read/at.js', { status: 'added', additions: 80, patch: addedPatch(80) }),
    file('src/read/below-lines.js', { status: 'added', additions: 78, patch: addedPatch(78) }),
    file('src/read/below-percent.js', { status: 'added', additions: 100, patch: addedPatch(100) }),
  ],
  claim3: [],
  c6: [
    file('src/read/at.js', { additions: 40, deletions: 40, patch: hunkPatch({ total: 80, from: 1, remove: 40, add: 40 }) }),
    file('src/read/below-lines.js', { additions: 39, deletions: 39, patch: hunkPatch({ total: 78, from: 1, remove: 39, add: 39 }) }),
    file('src/read/below-percent.js', { additions: 49, deletions: 49, patch: hunkPatch({ total: 100, from: 1, remove: 49, add: 49 }) }),
  ],
  c7: [file('src/show/table.js', { status: 'added', additions: 120 })],
  c8: [file('src/show/table.js', { additions: 60, deletions: 60, patch: hunkPatch({ total: 120, from: 61, remove: 60, add: 60 }) })],
};

/** Each merged sub-PR's commits, as `GET /repos/{owner}/{repo}/pulls/{pull_number}/commits` lists them. */
export const PULL_COMMITS = {
  13: ['c1', 'c2'],
  14: ['claim2', 'c3', 'c4', 'c5'],
  15: ['claim3', 'c6', 'c7', 'm1', 'c8'],
};

const listed = (tag, parents = 1) => ({
  sha: sha(tag),
  html_url: commitUrl(tag),
  commit: { message: tag },
  parents: Array.from({ length: parents }, (_, i) => ({ sha: sha(`p${i}${tag}`) })),
});

/** The feature PR's final diff, as `GET /repos/{owner}/{repo}/pulls/{pull_number}/files` lists it. */
export const FINAL_FILES = [
  file('dist/bundle.js', { status: 'added', additions: 500 }),
  file('pnpm-lock.yaml', { status: 'added', additions: 300 }),
  file('src/read/at.js', { status: 'added', additions: 80 }),
  file('src/read/below-lines.js', { status: 'added', additions: 78 }),
  file('src/read/below-percent.js', { status: 'added', additions: 100 }),
  file('src/show/table.js', { status: 'added', additions: 120 }),
  file(COLOUR, { status: 'added', additions: 23 }),
];

const request = (route, params, data, status) => ({
  route,
  params: { owner: OWNER, repo: REPO, ...params },
  ...(status ? { status } : { data }),
});

export const LIST_COMMITS = 'GET /repos/{owner}/{repo}/pulls/{pull_number}/commits';
export const GET_COMMIT = 'GET /repos/{owner}/{repo}/commits/{ref}';
export const LIST_FILES = 'GET /repos/{owner}/{repo}/pulls/{pull_number}/files';

/**
 * The recorded reads churn makes, for `replayGitHub({ recording })`. `missing` names reads GitHub
 * answers with a status instead: `{ pulls: { 14: 404 }, commits: { c4: 404 }, final: 404 }`.
 */
export function churnRecording({ missing = {} } = {}) {
  const entries = [];
  for (const [number, tags] of Object.entries(PULL_COMMITS)) {
    const list = tags.map((tag) => listed(tag, tag === 'm1' ? 2 : 1));
    entries.push(request(LIST_COMMITS, { pull_number: number, per_page: 100, page: 1 }, list, missing.pulls?.[number]));
  }
  for (const [tag, files] of Object.entries(COMMITS)) {
    const data = { sha: sha(tag), html_url: commitUrl(tag), commit: { message: tag }, parents: [{ sha: sha(`p0${tag}`) }], files };
    entries.push(request(GET_COMMIT, { ref: sha(tag), per_page: 100, page: 1 }, data, missing.commits?.[tag]));
  }
  entries.push(request(LIST_FILES, { pull_number: FEATURE.number, per_page: 100, page: 1 }, FINAL_FILES, missing.final));
  return entries;
}
