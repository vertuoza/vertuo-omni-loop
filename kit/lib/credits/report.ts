// @ts-nocheck
/**
 * **The text `omni credits` prints** (PRD #99): the heading, the pull request lines, the PRD issues,
 * what the app opened, the co-authored commits, then the pull requests by repository and by month,
 * from a `summarize()` result (`classify.mjs`); and, for `--list`, one line per item.
 *
 * ```text
 * OmniMan · acme · all time
 * PRs        56   (merged 53 · open 3)      phase-0 5 · feature 4 · slices 45 · other 2
 *   signed 12 · before signing 44 · missed 0
 * PRD issues 26   signed 4 · before signing 22 · missed 0
 * Opened by the app: 9 issues
 * Co-authored commits on default branches: 11
 * By repo    omni-loop 47 · core 9
 * By month   2026-07 8 · 2026-08 21 · 2026-09 27
 * ```
 *
 * With signing off (`name: null`) the heading names the loop, the signature line says signing is
 * off, and the PRD issues carry no signature. The app's line is left out when no account was looked
 * for (`byTheApp: null`), the commits' line when no commit was read (`commits: null`). Pure.
 */

const LABEL = 11;
const COUNT = 5;
const STATES = 26;

/** `text` padded to `width`, always followed by at least `gap` spaces. */
function cell(text, width, gap = 1) {
  const value = String(text);
  return value.length + gap > width ? `${value}${' '.repeat(gap)}` : value.padEnd(width);
}

const joined = (parts) => (parts.length ? parts.join(' · ') : 'none');
const shortName = (repo) => repo.slice(repo.indexOf('/') + 1);
const counted = (count, one, many) => `${count} ${count === 1 ? one : many}`;
const signatureLine = (signatures) =>
  `signed ${signatures.signed} · before signing ${signatures['before signing']} · missed ${signatures.missed}`;

/**
 * @param {{ name: string | null, scope: string, since: string | null, summary: ReturnType<typeof import('./classify.ts').summarize> }} input
 * @returns {string[]} the report's lines
 */
export function creditsReport({ name, scope, since, summary }) {
  const { prs, prdIssues, byTheApp, commits, byRepo, byMonth } = summary;
  const { states, kinds } = prs;
  const lines = [
    `${name ?? 'Omni Loop'} · ${scope} · ${since ? `since ${since}` : 'all time'}`,
    cell('PRs', LABEL) +
      cell(prs.total, COUNT) +
      cell(`(merged ${states.merged} · open ${states.open})`, STATES, 2) +
      `phase-0 ${kinds['phase-0']} · feature ${kinds.feature} · slices ${kinds.slice} · other ${kinds.other}`,
    name === null ? '  signing is off in this repository' : `  ${signatureLine(prs.signatures)}`,
    name === null
      ? cell('PRD issues', LABEL) + prdIssues.total
      : cell('PRD issues', LABEL) + cell(prdIssues.total, COUNT) + signatureLine(prdIssues.signatures),
  ];
  if (byTheApp !== null) {
    const opened = [counted(byTheApp.issues, 'issue', 'issues')];
    if (byTheApp.prs > 0) opened.push(counted(byTheApp.prs, 'pull request', 'pull requests'));
    lines.push(`Opened by the app: ${opened.join(' · ')}`);
  }
  if (commits !== null) lines.push(`Co-authored commits on default branches: ${commits}`);
  lines.push(
    cell('By repo', LABEL) + joined(byRepo.map(({ repo, count }) => `${shortName(repo)} ${count}`)),
    cell('By month', LABEL) + joined(byMonth.map(({ month, count }) => `${month} ${count}`)),
  );
  return lines;
}

/**
 * The `--list` lines, one per item in the order given (`creditItems` gives them oldest first):
 * repository, number, kind, state, created date, signature (`-` when none), title, each column but
 * the title padded to its widest value.
 *
 * @param {ReturnType<typeof import('./classify.ts').creditItems>} items
 * @returns {string[]}
 */
export function creditsList(items) {
  const rows = items.map((item) => [
    shortName(item.repo),
    `#${item.number}`,
    item.kind,
    item.state,
    item.createdAt.slice(0, 10),
    item.signature ?? '-',
    item.title,
  ]);
  const widths = rows.reduce((max, row) => max.map((width, index) => Math.max(width, row[index].length)), Array(6).fill(0));
  return rows.map((row) => [...widths.map((width, index) => row[index].padEnd(width)), row[6]].join(' '));
}
