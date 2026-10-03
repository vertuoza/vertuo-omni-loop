/**
 * **Whose work it is** (PRD #99, `omni credits`).
 *
 * Takes the pull requests, issues and default-branch commits the reader (`reader.mjs`) found, and
 * says which are OmniMan's, of which kind, in which state, and whether each was signed.
 *
 * - **A pull request is his** when any one holds: it carries a loop label (`labels.phase0`,
 *   `labels.feature`, `labels.sub`), its body carries the signature marker, a commit carrying his
 *   exact trailer merged it — the `(#<n>)` ending that commit's subject, in the same repository — or
 *   his bot account opened it. **An issue is his** when it carries `labels.prd`, its body carries the
 *   marker, or his bot account opened it. Each holds alone; `reasons` names every one that does
 *   (`label`, `marker`, `commit`, `author`).
 * - **His bot account** is the login in the signature's noreply address (`botLogin`), however `gh`
 *   spells it back: `<login>` or, for an app, `app/<slug>`. An address that is no noreply address
 *   names no account.
 * - **Counted:** a pull request when merged or open (closed without merging, never); an issue open
 *   or closed.
 * - **Kind:** a pull request's from its labels, `phase-0`, `feature`, `slice` (`labels.sub`: slices
 *   and reworks), else `other`; an issue is `prd` when the label or the marker says so, else `issue`.
 * - **Signature:** `by the app` when his bot account opened it. Otherwise, per repository: `signed`
 *   when the marker or a signed merge commit says so; `before signing` when created before that
 *   repository's first signed item (a pull request or an issue), `missed` when created after it. A
 *   repository with no signed item has only `before signing`; what the app opened sets no boundary.
 *
 * With `signature: null` (signing off) only a label says whose an item is, and no signature is
 * given: `signature` is `null` on every item.
 *
 * Pure: no filesystem, no network, no clock.
 */
import { botLogin, carriesTrailer, isSignedBody } from '../signature.ts';
import type { TrailerSignature } from '../signature.ts';
import { plainText } from '../outbox/plain-text.ts';

/** One pull request or issue the reader kept: `state` is `gh`'s, lower-cased. */
export type CreditPullRequest = {
  repo: string;
  number: number;
  title: string;
  state: string;
  createdAt: string;
  labels: string[];
  body: string;
  author: string | null;
};

/** One default-branch commit the reader kept. */
export type CreditCommit = { repo: string; sha: string; message: string; date: string | null };

/** The loop labels whose pull requests and issues are his. */
export type CreditLabels = { prd: string; phase0: string; feature: string; sub: string };

type Kind = (typeof KINDS)[number];
export type Signature = (typeof SIGNATURES)[number] | typeof BY_THE_APP;

/** One of his pull requests or issues, classified. `kind` is a {@link Kind} for a pull request,
 * `prd` or `issue` for an issue. */
export type CreditItem = {
  type: 'pr' | 'issue';
  repo: string;
  number: number;
  title: string;
  kind: string;
  state: string;
  createdAt: string;
  reasons: string[];
  signature: Signature | null;
};

/** A default-branch commit, with the pull request it merged. */
export type CreditedCommit = { repo: string; sha: string; date: string | null; subject: string; pullRequest: number | null };

export const KINDS = Object.freeze(['phase-0', 'feature', 'slice', 'other'] as const);
export const SIGNATURES = Object.freeze(['signed', 'before signing', 'missed'] as const);
export const BY_THE_APP = 'by the app';

/** A squash-merge subject's pull request number: `(#<n>)` closing the first line. */
const MERGED_PR = /\(#(\d+)\)\s*$/;

/** The pull request a default-branch commit merged — the `(#<n>)` ending its subject — or `null`. */
export function mergedPullRequest(message: unknown): number | null {
  const match = MERGED_PR.exec(plainText(message).split('\n')[0] ?? '');
  return match ? Number(match[1]) : null;
}

const keyOf = (repo: string, number: number): string => `${repo}#${number}`;
const time = (iso: string | null): number => Date.parse(String(iso));

/** The kind a pull request's labels give it; the first loop label in this order wins. */
function kindOf(names: string[], labels: CreditLabels): Kind {
  if (names.includes(labels.phase0)) return 'phase-0';
  if (names.includes(labels.feature)) return 'feature';
  if (names.includes(labels.sub)) return 'slice';
  return 'other';
}

/**
 * Whether `author`, as `gh` printed it, is the account `login` names: the login itself, or — for an
 * app's bot account, `<slug>[bot]` — `app/<slug>`, as `gh pr view` prints it. Case does not matter.
 */
export function sameAccount(author: unknown, login: string | null): boolean {
  if (!author || !login) return false;
  const said = plainText(author).toLowerCase();
  const wanted = login.toLowerCase();
  return said === wanted || (wanted.endsWith('[bot]') && said === `app/${wanted.slice(0, -'[bot]'.length)}`);
}

/**
 * Gives each item its `signature` around its repository's first signed item, dropping the internal
 * `signed` and `byApp` flags. With signing off, every signature is `null`.
 */
type Classified = Omit<CreditItem, 'signature'> & { signed: boolean; byApp: boolean };

function withSignatures(items: Classified[], signing: boolean): CreditItem[] {
  const firstSigned = new Map<string, number>();
  for (const item of items) {
    if (!item.signed || item.byApp) continue;
    const seen = firstSigned.get(item.repo);
    if (seen === undefined || time(item.createdAt) < seen) firstSigned.set(item.repo, time(item.createdAt));
  }
  return items.map(({ signed, byApp, ...item }): CreditItem => {
    if (!signing) return { ...item, signature: null };
    if (byApp) return { ...item, signature: BY_THE_APP };
    if (signed) return { ...item, signature: 'signed' };
    const first = firstSigned.get(item.repo);
    return { ...item, signature: first !== undefined && time(item.createdAt) > first ? 'missed' : 'before signing' };
  });
}

export type CreditItemsInput = {
  prs: CreditPullRequest[];
  issues?: CreditPullRequest[];
  commits: Array<Pick<CreditCommit, 'repo' | 'message'>>;
  labels: CreditLabels;
  signature: TrailerSignature | null;
  /** `YYYY-MM`: only what was created from that month on. */
  since: string | null;
};

/** OmniMan's pull requests among `prs` and issues among `issues`, classified, oldest first. */
export function creditItems({ prs, issues = [], commits, labels, signature, since }: CreditItemsInput): CreditItem[] {
  const loopLabels = [labels.phase0, labels.feature, labels.sub];
  const bot = signature ? botLogin(signature.email) : null;
  const mergedBySigned = new Set<string>();
  for (const commit of commits) {
    const number = carriesTrailer(commit.message, signature) ? mergedPullRequest(commit.message) : null;
    if (number !== null) mergedBySigned.add(keyOf(commit.repo, number));
  }
  const from = since ? time(`${since}-01T00:00:00Z`) : null;

  const seen = new Set<string>();
  const items: Classified[] = [];
  type Rule = { labelled: (name: string) => boolean; merged: boolean; counted: string[]; kind: (reasons: string[]) => string };
  /** Adds one pull request or issue, when some reason makes it his and it is counted. */
  const add = (type: CreditItem['type'], raw: CreditPullRequest, { labelled, merged, counted, kind }: Rule): void => {
    const key = `${type}:${keyOf(raw.repo, raw.number)}`;
    if (seen.has(key)) return;
    seen.add(key);
    const reasons: string[] = [];
    if (raw.labels.some(labelled)) reasons.push('label');
    if (signature && isSignedBody(raw.body)) reasons.push('marker');
    if (merged) reasons.push('commit');
    if (sameAccount(raw.author, bot)) reasons.push('author');
    if (reasons.length === 0 || !counted.includes(raw.state)) return;
    if (from !== null && time(raw.createdAt) < from) return;
    items.push({
      type,
      repo: raw.repo,
      number: raw.number,
      title: raw.title,
      kind: kind(reasons),
      state: raw.state,
      createdAt: raw.createdAt,
      reasons,
      signed: reasons.includes('marker') || reasons.includes('commit'),
      byApp: reasons.includes('author'),
    });
  };
  for (const pr of prs) {
    add('pr', pr, {
      labelled: (name) => loopLabels.includes(name),
      merged: mergedBySigned.has(keyOf(pr.repo, pr.number)),
      counted: ['merged', 'open'],
      kind: () => kindOf(pr.labels, labels),
    });
  }
  for (const issue of issues) {
    add('issue', issue, {
      labelled: (name) => name === labels.prd,
      merged: false,
      counted: ['open', 'closed'],
      kind: (reasons) => (reasons.includes('label') || reasons.includes('marker') ? 'prd' : 'issue'),
    });
  }
  items.sort((a, b) => time(a.createdAt) - time(b.createdAt) || a.repo.localeCompare(b.repo) || a.number - b.number);
  return withSignatures(items, signature !== null);
}

/**
 * The co-authored commits the reader found on default branches, each with the pull request it
 * merged (`null` when its subject names none), oldest first.
 */
export function creditCommits(commits: CreditCommit[]): CreditedCommit[] {
  return commits
    .map((commit): CreditedCommit => ({
      repo: commit.repo,
      sha: commit.sha,
      date: commit.date,
      subject: (commit.message.split('\n')[0] ?? '').trim(),
      pullRequest: mergedPullRequest(commit.message),
    }))
    .sort((a, b) => (time(a.date) || 0) - (time(b.date) || 0) || a.repo.localeCompare(b.repo) || a.sha.localeCompare(b.sha));
}

const zeros = (keys: readonly string[]): Record<string, number> => Object.fromEntries(keys.map((key) => [key, 0]));

/** Counts one more `key` in `counts`; every key `summarize` counts is one it started at zero. */
function bump(counts: Record<string, number>, key: string): void {
  counts[key] = (counts[key] ?? 0) + 1;
}

/** How many items share each value of `keyFor(item)`, as `[value, count]` pairs. */
function tally(items: CreditItem[], keyFor: (item: CreditItem) => string): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = keyFor(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts];
}

/** The totals `summarize` gives, which the report prints and `--json` holds. */
export type CreditSummary = {
  prs: { total: number; states: Record<string, number>; kinds: Record<string, number>; signatures: Record<string, number> };
  prdIssues: { total: number; states: Record<string, number>; signatures: Record<string, number> };
  byTheApp: { issues: number; prs: number } | null;
  commits: number | null;
  byRepo: Array<{ repo: string; count: number }>;
  byMonth: Array<{ month: string; count: number }>;
};

/**
 * The totals the report prints, three apart: the pull requests (by state, kind and signature), the
 * PRD issues (by state and signature) — neither counting what the app opened — and what his bot
 * account opened, by type. Then the co-authored commits, and the pull requests by repository (most
 * first) and by the month each was created (oldest first).
 *
 * `byTheApp` is `null` unless `app` says his bot account was looked for; `commits` is `null` unless
 * the commits were read.
 */
export function summarize(items: CreditItem[], { commits = null, app = false }: { commits?: unknown[] | null; app?: boolean } = {}): CreditSummary {
  const prs = { total: 0, states: { merged: 0, open: 0 }, kinds: zeros(KINDS), signatures: zeros(SIGNATURES) };
  const prdIssues = { total: 0, states: { open: 0, closed: 0 }, signatures: zeros(SIGNATURES) };
  const byTheApp = { issues: 0, prs: 0 };
  const counted: CreditItem[] = [];
  for (const item of items) {
    if (item.signature === BY_THE_APP) {
      byTheApp[item.type === 'pr' ? 'prs' : 'issues'] += 1;
      continue;
    }
    const totals = item.type === 'pr' ? prs : prdIssues;
    totals.total += 1;
    bump(totals.states, item.state);
    if (item.signature !== null) bump(totals.signatures, item.signature);
    if (item.type !== 'pr') continue;
    bump(prs.kinds, item.kind);
    counted.push(item);
  }
  return {
    prs,
    prdIssues,
    byTheApp: app ? byTheApp : null,
    commits: commits === null ? null : commits.length,
    byRepo: tally(counted, (item) => item.repo)
      .sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
      .map(([repo, count]) => ({ repo, count })),
    byMonth: tally(counted, (item) => new Date(item.createdAt).toISOString().slice(0, 7))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ month, count })),
  };
}
