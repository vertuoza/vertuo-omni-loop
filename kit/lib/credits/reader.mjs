/**
 * **What `omni credits` reads** (PRD #99), through the `gh` login, on demand: it stores nothing.
 *
 * Over one organisation (`--owner`), or one repository (`--repo`), and — with `since` — only what
 * was created (a commit: committed) from that month on:
 *
 * - `gh search prs --label <l>` for each loop label (`labels.phase0`, `labels.feature`,
 *   `labels.sub`): every one is kept;
 * - `gh search prs --match body -- <name>`: kept only when the body carries the signature marker;
 * - `gh search commits -- <name>` (GitHub searches default branches only): kept only when the
 *   message carries the exact trailer line;
 * - `gh pr view` for each pull request such a commit merged (the `(#<n>)` ending its subject) that
 *   no search above returned.
 *
 * With `signature: null` only the label searches run. A search that returns GitHub's cap of 1,000
 * results is read as it is, with a warning naming it. A `gh` that is missing or logged out, a rate
 * limit, or any other failure of a search throws a one-line {@link GitHubUnreadable}; a pull request
 * a signed commit names that cannot be viewed is a warning instead.
 *
 * Every call goes through `exec` (`execFileSync`'s shape), so the tests stub it and never call GitHub.
 */
import { execFileSync } from 'node:child_process';
import { carriesTrailer, isSignedBody } from '../signature.mjs';
import { mergedPullRequest } from './classify.mjs';

/** The most results GitHub's search API returns for one query. */
export const SEARCH_CAP = 1000;
const PR_FIELDS = 'number,title,state,createdAt,labels,body,repository,author';
const VIEW_FIELDS = 'number,title,state,createdAt,labels,body,author';
const COMMIT_FIELDS = 'sha,commit,repository';
const MAX_BUFFER = 64 * 1024 * 1024;

/** `gh` could not be read: `reason` is `missing`, `logged-out`, `rate-limited` or `failed`; the
 * message is one line. */
export class GitHubUnreadable extends Error {
  constructor(reason, message) {
    super(message);
    this.name = 'GitHubUnreadable';
    this.reason = reason;
  }
}

const firstLine = (text) => String(text ?? '').split('\n').map((line) => line.trim()).find(Boolean) ?? '';

/** What a failed `gh` call means, as a {@link GitHubUnreadable}. */
export function unreadable(error) {
  if (error?.code === 'ENOENT') {
    return new GitHubUnreadable('missing', 'gh is not installed: install the GitHub CLI, then run gh auth login.');
  }
  const said = `${error?.stderr ?? ''}\n${error?.message ?? ''}`;
  if (error?.status === 4 || /gh auth login|not logged in|HTTP 401|bad credentials/i.test(said)) {
    return new GitHubUnreadable('logged-out', 'gh is not logged in: run gh auth login.');
  }
  if (/rate limit|HTTP 429/i.test(said)) {
    return new GitHubUnreadable('rate-limited', "GitHub's rate limit stopped the search: wait a minute and run it again, or narrow it with --since or --repo.");
  }
  return new GitHubUnreadable('failed', `gh failed: ${firstLine(error?.stderr) || firstLine(error?.message)}`);
}

/** An ISO timestamp without milliseconds, or `null` when `value` is not a date. */
function toIso(value) {
  const date = new Date(String(value ?? ''));
  return value && !Number.isNaN(date.getTime()) ? date.toISOString().replace(/\.\d{3}Z$/, 'Z') : null;
}

/** One pull request, the same shape whether `gh search prs` or `gh pr view` printed it. */
function pullRequest(raw, repo) {
  return {
    repo,
    number: raw.number,
    title: raw.title ?? '',
    state: String(raw.state ?? '').toLowerCase(),
    createdAt: toIso(raw.createdAt),
    labels: (raw.labels ?? []).map((label) => label.name),
    body: raw.body ?? '',
    author: raw.author?.login ?? null,
  };
}

const shown = (arg) => (/\s/.test(arg) ? JSON.stringify(arg) : arg);

/**
 * @param {{
 *   owner: string, repo: string | null, since: string | null,
 *   labels: { phase0: string, feature: string, sub: string },
 *   signature: { name: string, email: string } | null,
 *   exec?: typeof execFileSync, env?: object,
 * }} input
 * @returns {{ prs: object[], commits: object[], warnings: string[] }}
 */
export function readCredits({ owner, repo, since, labels, signature, exec = execFileSync, env }) {
  const options = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: MAX_BUFFER, ...(env ? { env } : {}) };
  const gh = (args) => {
    try {
      return String(exec('gh', args, options));
    } catch (error) {
      throw unreadable(error);
    }
  };
  const warnings = [];
  const scope = repo ? ['--repo', repo] : ['--owner', owner];
  const from = since ? `>=${since}-01` : null;

  /** Runs one search — `query` is what names it, `keyword` goes after `--` — and warns at the cap. */
  const search = (query, fields, keyword = null) => {
    const tail = keyword === null ? [] : ['--', keyword];
    const text = gh([...query, '--limit', String(SEARCH_CAP), '--json', fields, ...tail]).trim();
    const rows = text ? JSON.parse(text) : [];
    if (rows.length >= SEARCH_CAP) {
      warnings.push(`gh ${[...query, ...tail].map(shown).join(' ')} hit GitHub's 1,000-result cap: some items may be missing; narrow it with --since or --repo.`);
    }
    return rows;
  };

  const prs = new Map();
  const keep = (pr) => {
    const key = `${pr.repo}#${pr.number}`;
    if (pr.createdAt !== null && !prs.has(key)) prs.set(key, pr);
  };
  const created = from ? ['--created', from] : [];
  const searchPrs = (narrowing, keyword) =>
    search(['search', 'prs', ...scope, ...narrowing, ...created], PR_FIELDS, keyword).map((raw) =>
      pullRequest(raw, raw.repository?.nameWithOwner),
    );

  for (const label of new Set([labels.phase0, labels.feature, labels.sub])) {
    searchPrs(['--label', label]).forEach(keep);
  }
  if (!signature) return { prs: [...prs.values()], commits: [], warnings };

  searchPrs(['--match', 'body'], signature.name).filter((pr) => isSignedBody(pr.body)).forEach(keep);

  const committed = from ? ['--committer-date', from] : [];
  const commits = search(['search', 'commits', ...scope, ...committed], COMMIT_FIELDS, signature.name)
    .map((raw) => ({ repo: raw.repository?.fullName, sha: raw.sha, message: raw.commit?.message ?? '', date: toIso(raw.commit?.committer?.date) }))
    .filter((commit) => carriesTrailer(commit.message, signature));

  for (const commit of commits) {
    const number = mergedPullRequest(commit.message);
    if (number === null || prs.has(`${commit.repo}#${number}`)) continue;
    let raw;
    try {
      raw = JSON.parse(gh(['pr', 'view', String(number), '--repo', commit.repo, '--json', VIEW_FIELDS]));
    } catch (error) {
      if (!(error instanceof GitHubUnreadable) || error.reason !== 'failed') throw error;
      warnings.push(`${commit.repo}#${number}, named by a signed commit, could not be read: ${error.message.replace(/^gh failed: /, '')}`);
      continue;
    }
    keep(pullRequest(raw, commit.repo));
  }
  return { prs: [...prs.values()], commits, warnings };
}
