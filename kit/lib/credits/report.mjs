/**
 * **The text `omni credits` prints** (PRD #99): the heading, the pull request lines, then the count
 * by repository and by month, from a `summarize()` result (`classify.mjs`).
 *
 * ```text
 * OmniMan · acme · all time
 * PRs        56   (merged 53 · open 3)      phase-0 5 · feature 4 · slices 45 · other 2
 *   signed 12 · before signing 44 · missed 0
 * By repo    omni-loop 47 · core 9
 * By month   2026-07 8 · 2026-08 21 · 2026-09 27
 * ```
 *
 * With signing off (`name: null`) the heading names the loop, and the signature line says signing
 * is off. Pure.
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

/**
 * @param {{ name: string | null, scope: string, since: string | null, summary: ReturnType<typeof import('./classify.mjs').summarize> }} input
 * @returns {string[]} the report's lines
 */
export function creditsReport({ name, scope, since, summary }) {
  const { total, states, kinds, signatures, byRepo, byMonth } = summary;
  return [
    `${name ?? 'Omni Loop'} · ${scope} · ${since ? `since ${since}` : 'all time'}`,
    cell('PRs', LABEL) +
      cell(total, COUNT) +
      cell(`(merged ${states.merged} · open ${states.open})`, STATES, 2) +
      `phase-0 ${kinds['phase-0']} · feature ${kinds.feature} · slices ${kinds.slice} · other ${kinds.other}`,
    name === null
      ? '  signing is off in this repository'
      : `  signed ${signatures.signed} · before signing ${signatures['before signing']} · missed ${signatures.missed}`,
    cell('By repo', LABEL) + joined(byRepo.map(({ repo, count }) => `${shortName(repo)} ${count}`)),
    cell('By month', LABEL) + joined(byMonth.map(({ month, count }) => `${month} ${count}`)),
  ];
}
