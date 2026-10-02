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
import type { ExecFileSyncOptionsWithStringEncoding } from 'node:child_process';
import { botLogin, carriesTrailer, isSignedBody } from '../signature.ts';
import type { TrailerSignature } from '../signature.ts';
import { textOf } from '../narrow.ts';
import { mergedPullRequest } from './classify.ts';
import type { CreditCommit, CreditLabels, CreditPullRequest } from './classify.ts';
import { parseGh, SearchedCommitsSchema, SearchedItemsSchema, ViewedPullRequestSchema } from './schema.ts';
import type { ViewedPullRequest } from './schema.ts';

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
export type UnreadableReason = 'missing' | 'logged-out' | 'rate-limited' | 'failed';

export class GitHubUnreadable extends Error {
  reason: UnreadableReason;

  constructor(reason: UnreadableReason, message: string) {
    super(message);
    this.name = 'GitHubUnreadable';
    this.reason = reason;
  }
}

const firstLine = (text: unknown): string => textOf(text).split('\n').map((line) => line.trim()).find(Boolean) ?? '';

/** What a failed `gh` call means, as a {@link GitHubUnreadable}. */
export function unreadable(caught: unknown): GitHubUnreadable {
  const error = failureOf(caught);
  if (error?.code === 'ENOENT') {
    return new GitHubUnreadable('missing', 'gh is not installed: install the GitHub CLI, then run gh auth login.');
  }
  const said = `${textOf(error?.stderr)}\n${textOf(error?.message)}`;
  if (error?.status === 4 || /gh auth login|not logged in|HTTP 401|bad credentials/i.test(said)) {
    return new GitHubUnreadable('logged-out', 'gh is not logged in: run gh auth login.');
  }
  if (/rate limit|HTTP 429/i.test(said)) {
    return new GitHubUnreadable('rate-limited', "GitHub's rate limit stopped the search: wait a minute and run it again, or narrow it with --since or --repo.");
  }
  return new GitHubUnreadable('failed', `gh failed: ${firstLine(error?.stderr) || firstLine(error?.message)}`);
}

/** What a thrown `execFileSync` failure may carry, read field by field. */
type ExecFailure = { code?: unknown; status?: unknown; stderr?: unknown; message?: unknown };

/** `caught` as an object whose fields can be read, or `null` when it is no object. */
function failureOf(caught: unknown): ExecFailure | null {
  return typeof caught === 'object' && caught !== null ? caught : null;
}

/** An ISO timestamp without milliseconds, or `null` when `value` is not a date. */
function toIso(value: unknown): string | null {
  const date = new Date(textOf(value));
  return value && !Number.isNaN(date.getTime()) ? date.toISOString().replace(/\.\d{3}Z$/, 'Z') : null;
}

/** The `gh search` flags that find what `login` opened: `--app <slug>` for an app's bot account. */
function openedBy(login: string): string[] {
  return login.toLowerCase().endsWith(BOT_SUFFIX) ? ['--app', login.slice(0, -BOT_SUFFIX.length)] : ['--author', login];
}

/** A pull request or issue as read, before the reader drops one whose creation date is unreadable. */
type ReadPullRequest = Omit<CreditPullRequest, 'createdAt'> & { createdAt: string | null };

/** One pull request or issue, the same shape whether `gh search` or `gh pr view` printed it. */
function pullRequest(raw: ViewedPullRequest, repo: string): ReadPullRequest {
  return {
    repo,
    number: raw.number,
    title: raw.title ?? '',
    state: (raw.state ?? '').toLowerCase(),
    createdAt: toIso(raw.createdAt),
    labels: (raw.labels ?? []).map((label) => label.name),
    body: raw.body ?? '',
    author: raw.author?.login ?? null,
  };
}

const shown = (arg: string): string => (/\s/.test(arg) ? JSON.stringify(arg) : arg);

/** `execFileSync`'s shape, as the reader calls it: the tests stub it. */
export type CreditsExec = (file: string, args: string[], options: ExecFileSyncOptionsWithStringEncoding) => string | Buffer;

export type ReadCreditsInput = {
  owner: string;
  repo: string | null;
  since: string | null;
  labels: CreditLabels;
  signature: TrailerSignature | null;
  exec?: CreditsExec;
  env?: NodeJS.ProcessEnv;
};

export type CreditsRead = { prs: CreditPullRequest[]; issues: CreditPullRequest[]; commits: CreditCommit[]; warnings: string[] };

export function readCredits({ owner, repo, since, labels, signature, exec = execFileSync, env }: ReadCreditsInput): CreditsRead {
  const options: ExecFileSyncOptionsWithStringEncoding = {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: MAX_BUFFER,
    ...(env ? { env } : {}),
  };
  const gh = (args: string[]): string => {
    try {
      return String(exec('gh', args, options));
    } catch (error) {
      throw unreadable(error);
    }
  };
  const warnings: string[] = [];
  const scope = repo ? ['--repo', repo] : ['--owner', owner];
  const from = since ? `>=${since}-01` : null;

  /** Runs one search — `query` is what names it, `keyword` goes after `--` — and warns at the cap. */
  const search = (query: string[], fields: string, keyword: string | null = null): unknown => {
    const tail = keyword === null ? [] : ['--', keyword];
    const text = gh([...query, '--limit', String(SEARCH_CAP), '--json', fields, ...tail]).trim();
    const rows: unknown = text ? JSON.parse(text) : [];
    if (Array.isArray(rows) && rows.length >= SEARCH_CAP) {
      warnings.push(`gh ${[...query, ...tail].map(shown).join(' ')} hit GitHub's 1,000-result cap: some items may be missing; narrow it with --since or --repo.`);
    }
    return rows;
  };

  const prs = new Map<string, CreditPullRequest>();
  const issues = new Map<string, CreditPullRequest>();
  /** Keeps the first read of each pull request or issue into `into`, by `<repo>#<n>`. */
  const keeper = (into: Map<string, CreditPullRequest>) => (item: ReadPullRequest): void => {
    const key = `${item.repo}#${item.number}`;
    const { createdAt } = item;
    if (createdAt !== null && !into.has(key)) into.set(key, { ...item, createdAt });
  };
  const keep = keeper(prs);
  const keepIssue = keeper(issues);
  const created = from ? ['--created', from] : [];
  /** One `gh search prs` or `gh search issues`, `narrowing` it, each row in the one shape. */
  const searchItems = (type: 'prs' | 'issues', narrowing: string[], keyword: string | null = null): ReadPullRequest[] =>
    parseGh(SearchedItemsSchema, search(['search', type, ...scope, ...narrowing, ...created], PR_FIELDS, keyword), `gh search ${type}`).map(
      (raw) => pullRequest(raw, raw.repository.nameWithOwner),
    );
  const result = (commits: CreditCommit[]): CreditsRead => ({ prs: [...prs.values()], issues: [...issues.values()], commits, warnings });

  for (const label of new Set([labels.phase0, labels.feature, labels.sub])) {
    searchItems('prs', ['--label', label]).forEach(keep);
  }
  searchItems('issues', ['--label', labels.prd]).forEach(keepIssue);
  if (!signature) return result([]);

  searchItems('prs', ['--match', 'body'], signature.name).filter((pr) => isSignedBody(pr.body)).forEach(keep);
  searchItems('issues', ['--match', 'body'], signature.name).filter((issue) => isSignedBody(issue.body)).forEach(keepIssue);

  const committed = from ? ['--committer-date', from] : [];
  const commits = parseGh(SearchedCommitsSchema, search(['search', 'commits', ...scope, ...committed], COMMIT_FIELDS, signature.name), 'gh search commits')
    .map((raw): CreditCommit => ({ repo: raw.repository.fullName, sha: raw.sha, message: raw.commit?.message ?? '', date: toIso(raw.commit?.committer?.date) }))
    .filter((commit) => carriesTrailer(commit.message, signature));

  const login = botLogin(signature.email);
  if (login !== null) {
    searchItems('prs', openedBy(login)).forEach(keep);
    searchItems('issues', openedBy(login)).forEach(keepIssue);
  }

  for (const commit of commits) {
    const number = mergedPullRequest(commit.message);
    if (number === null || prs.has(`${commit.repo}#${number}`)) continue;
    let text: string;
    try {
      text = gh(['pr', 'view', String(number), '--repo', commit.repo, '--json', VIEW_FIELDS]);
    } catch (error) {
      if (!(error instanceof GitHubUnreadable) || error.reason !== 'failed') throw error;
      warnings.push(`${commit.repo}#${number}, named by a signed commit, could not be read: ${error.message.replace(/^gh failed: /, '')}`);
      continue;
    }
    keep(pullRequest(parseGh(ViewedPullRequestSchema, JSON.parse(text), 'gh pr view'), commit.repo));
  }
  return result(commits);
}
