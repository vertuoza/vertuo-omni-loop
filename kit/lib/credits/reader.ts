// @ts-nocheck
/**
 * **What `omni credits` reads** (PRD #99), through the `gh` login, on demand: it stores nothing.
 *
 * Over one organisation (`--owner`), or one repository (`--repo`), and — with `since` — only what
 * was created (a commit: committed) from that month on:
 *
 * - `gh search prs --label <l>` for each loop label (`labels.phase0`, `labels.feature`,
 *   `labels.sub`), and `gh search issues --label <labels.prd>`: every one is kept;
 * - `gh search prs --match body -- <name>` and `gh search issues --match body -- <name>`: kept only
 *   when the body carries the signature marker;
 * - `gh search commits -- <name>` (GitHub searches default branches only): kept only when the
 *   message carries the exact trailer line;
 * - `gh search prs` and `gh search issues` for what the signature's own account opened (the login in
 *   its noreply address): `--app <slug>` for an app's `<slug>[bot]`, else `--author <login>`. Every
 *   one is kept. An address that is no noreply address names no account, and this search is skipped;
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
import { botLogin, carriesTrailer, isSignedBody } from '../signature.ts';
import { mergedPullRequest } from './classify.ts';

/** The most results GitHub's search API returns for one query. */
export const SEARCH_CAP = 1000;
/** What `gh search prs` and `gh search issues` are asked for: both take the same fields. */
const PR_FIELDS = 'number,title,state,createdAt,labels,body,repository,author';
const BOT_SUFFIX = '[bot]';
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

/** The `gh search` flags that find what `login` opened: `--app <slug>` for an app's bot account. */
function openedBy(login) {
  return login.toLowerCase().endsWith(BOT_SUFFIX) ? ['--app', login.slice(0, -BOT_SUFFIX.length)] : ['--author', login];
}

/** One pull request or issue, the same shape whether `gh search` or `gh pr view` printed it. */
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
 *   labels: { prd: string, phase0: string, feature: string, sub: string },
 *   signature: { name: string, email: string } | null,
 *   exec?: typeof execFileSync, env?: object,
 * }} input
 * @returns {{ prs: object[], issues: object[], commits: object[], warnings: string[] }}
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
  const issues = new Map();
  /** Keeps the first read of each pull request or issue into `into`, by `<repo>#<n>`. */
  const keeper = (into) => (item) => {
    const key = `${item.repo}#${item.number}`;
    if (item.createdAt !== null && !into.has(key)) into.set(key, item);
  };
  const keep = keeper(prs);
  const keepIssue = keeper(issues);
  const created = from ? ['--created', from] : [];
  /** One `gh search prs` or `gh search issues`, `narrowing` it, each row in the one shape. */
  const searchItems = (type, narrowing, keyword) =>
    search(['search', type, ...scope, ...narrowing, ...created], PR_FIELDS, keyword).map((raw) =>
      pullRequest(raw, raw.repository?.nameWithOwner),
    );
  const result = (commits) => ({ prs: [...prs.values()], issues: [...issues.values()], commits, warnings });

  for (const label of new Set([labels.phase0, labels.feature, labels.sub])) {
    searchItems('prs', ['--label', label]).forEach(keep);
  }
  searchItems('issues', ['--label', labels.prd]).forEach(keepIssue);
  if (!signature) return result([]);

  searchItems('prs', ['--match', 'body'], signature.name).filter((pr) => isSignedBody(pr.body)).forEach(keep);
  searchItems('issues', ['--match', 'body'], signature.name).filter((issue) => isSignedBody(issue.body)).forEach(keepIssue);

  const committed = from ? ['--committer-date', from] : [];
  const commits = search(['search', 'commits', ...scope, ...committed], COMMIT_FIELDS, signature.name)
    .map((raw) => ({ repo: raw.repository?.fullName, sha: raw.sha, message: raw.commit?.message ?? '', date: toIso(raw.commit?.committer?.date) }))
    .filter((commit) => carriesTrailer(commit.message, signature));

  const login = botLogin(signature.email);
  if (login !== null) {
    searchItems('prs', openedBy(login)).forEach(keep);
    searchItems('issues', openedBy(login)).forEach(keepIssue);
  }

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
  return result(commits);
}
