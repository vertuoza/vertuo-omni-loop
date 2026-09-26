/**
 * **Whose work it is** (PRD #99, `omni credits`).
 *
 * Takes the pull requests and the default-branch commits the reader (`reader.mjs`) found, and says
 * which pull requests are OmniMan's, of which kind, in which state, and whether each was signed.
 *
 * - **His** when any one holds: it carries a loop label (`labels.phase0`, `labels.feature`,
 *   `labels.sub`), its body carries the signature marker, or a commit carrying his exact trailer
 *   merged it — the `(#<n>)` ending that commit's subject, in the same repository. Each holds alone;
 *   `reasons` names every one that does (`label`, `marker`, `commit`).
 * - **Counted** when merged or open; a pull request closed without merging never is.
 * - **Kind** from its labels: `phase-0`, `feature`, `slice` (`labels.sub`: slices and reworks),
 *   else `other`.
 * - **Signature**, per repository: `signed` when the marker or a signed merge commit says so;
 *   otherwise `before signing` when created before that repository's first signed item, `missed`
 *   when created after it. A repository with no signed item has only `before signing`.
 *
 * With `signature: null` (signing off) only the label says whose a pull request is, and no
 * signature is given: `signature` is `null` on every item.
 *
 * Pure: no filesystem, no network, no clock.
 */
import { carriesTrailer, isSignedBody } from '../signature.mjs';

export const KINDS = Object.freeze(['phase-0', 'feature', 'slice', 'other']);
export const SIGNATURES = Object.freeze(['signed', 'before signing', 'missed']);

/** A squash-merge subject's pull request number: `(#<n>)` closing the first line. */
const MERGED_PR = /\(#(\d+)\)\s*$/;

/** The pull request a default-branch commit merged — the `(#<n>)` ending its subject — or `null`. */
export function mergedPullRequest(message) {
  const match = MERGED_PR.exec(String(message ?? '').split('\n')[0]);
  return match ? Number(match[1]) : null;
}

const keyOf = (repo, number) => `${repo}#${number}`;
const time = (iso) => Date.parse(iso);

/** The kind a pull request's labels give it; the first loop label in this order wins. */
function kindOf(names, labels) {
  if (names.includes(labels.phase0)) return 'phase-0';
  if (names.includes(labels.feature)) return 'feature';
  if (names.includes(labels.sub)) return 'slice';
  return 'other';
}

/**
 * Gives each item its `signature` around its repository's first signed item, dropping the internal
 * `signed` flag. With signing off, every signature is `null`.
 */
function withSignatures(items, signing) {
  const firstSigned = new Map();
  for (const item of items) {
    if (!item.signed) continue;
    const seen = firstSigned.get(item.repo);
    if (seen === undefined || time(item.createdAt) < seen) firstSigned.set(item.repo, time(item.createdAt));
  }
  return items.map(({ signed, ...item }) => {
    if (!signing) return { ...item, signature: null };
    if (signed) return { ...item, signature: 'signed' };
    const first = firstSigned.get(item.repo);
    return { ...item, signature: first !== undefined && time(item.createdAt) > first ? 'missed' : 'before signing' };
  });
}

/**
 * OmniMan's pull requests among `prs`, classified, oldest first.
 *
 * @param {{
 *   prs: Array<{ repo: string, number: number, title: string, state: 'merged' | 'open' | 'closed',
 *                createdAt: string, labels: string[], body: string }>,
 *   commits: Array<{ repo: string, message: string }>,
 *   labels: { phase0: string, feature: string, sub: string },
 *   signature: { name: string, email: string } | null,
 *   since: string | null,   // `YYYY-MM`: only what was created from that month on
 * }} input
 * @returns {Array<{ repo: string, number: number, title: string, kind: string, state: string,
 *                   createdAt: string, reasons: string[], signature: string | null }>}
 */
export function creditPullRequests({ prs, commits, labels, signature, since }) {
  const loopLabels = [labels.phase0, labels.feature, labels.sub];
  const mergedBySigned = new Set();
  for (const commit of commits) {
    const number = carriesTrailer(commit.message, signature) ? mergedPullRequest(commit.message) : null;
    if (number !== null) mergedBySigned.add(keyOf(commit.repo, number));
  }
  const from = since ? time(`${since}-01T00:00:00Z`) : null;

  const seen = new Set();
  const items = [];
  for (const pr of prs) {
    const key = keyOf(pr.repo, pr.number);
    if (seen.has(key)) continue;
    seen.add(key);
    const reasons = [];
    if (pr.labels.some((name) => loopLabels.includes(name))) reasons.push('label');
    if (signature && isSignedBody(pr.body)) reasons.push('marker');
    if (mergedBySigned.has(key)) reasons.push('commit');
    if (reasons.length === 0) continue;
    if (pr.state !== 'merged' && pr.state !== 'open') continue;
    if (from !== null && time(pr.createdAt) < from) continue;
    items.push({
      repo: pr.repo,
      number: pr.number,
      title: pr.title,
      kind: kindOf(pr.labels, labels),
      state: pr.state,
      createdAt: pr.createdAt,
      reasons,
      signed: reasons.includes('marker') || reasons.includes('commit'),
    });
  }
  items.sort((a, b) => time(a.createdAt) - time(b.createdAt) || a.repo.localeCompare(b.repo) || a.number - b.number);
  return withSignatures(items, signature !== null);
}

const zeros = (keys) => Object.fromEntries(keys.map((key) => [key, 0]));

/** How many items share each value of `keyFor(item)`, as `[value, count]` pairs. */
function tally(items, keyFor) {
  const counts = new Map();
  for (const item of items) {
    const key = keyFor(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts];
}

/**
 * The totals the report prints: by state, kind and signature, then by repository (most first) and
 * by the month each was created (oldest first).
 */
export function summarize(items) {
  const states = { merged: 0, open: 0 };
  const kinds = zeros(KINDS);
  const signatures = zeros(SIGNATURES);
  for (const item of items) {
    states[item.state] += 1;
    kinds[item.kind] += 1;
    if (item.signature !== null) signatures[item.signature] += 1;
  }
  return {
    total: items.length,
    states,
    kinds,
    signatures,
    byRepo: tally(items, (item) => item.repo)
      .sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
      .map(([repo, count]) => ({ repo, count })),
    byMonth: tally(items, (item) => new Date(item.createdAt).toISOString().slice(0, 7))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ month, count })),
  };
}
