// PRD 790: a feature PR's care state, parsed from one GraphQL read — its check rollup, its mergeable
// state, its review threads with each one's verdict, and the care line of `/omni:pr`'s status comment.
// Pure: `kit/bin/commands/care.ts` runs the query (`CARE_QUERY`) and adds whether a wave holds
// claims; the decision (`decide.mjs`) reads what this returns.
import { readCareVerdict } from './marker.ts';
import type { CareVerdict } from './marker.ts';

// The parts of `CARE_QUERY`'s answer this file reads. Every field may be missing or null: GitHub's
// answer is checked where `kit/bin/commands/care.ts` reads it (PRD 725 outbox item s4-03), and this
// parser keeps reading a missing field as it always has.
type Maybe<T> = T | null | undefined;
type Nodes<T> = Maybe<{ nodes?: Maybe<T[]> }>;

type ContextNode = {
  __typename?: Maybe<string>;
  name?: Maybe<string>;
  conclusion?: Maybe<string>;
  detailsUrl?: Maybe<string>;
  context?: Maybe<string>;
  state?: Maybe<string>;
  targetUrl?: Maybe<string>;
};
type Rollup = { state?: Maybe<string>; contexts?: Nodes<Maybe<ContextNode>> };
type CommentNode = { author?: Maybe<{ login?: Maybe<string>; avatarUrl?: Maybe<string> }>; body?: Maybe<string>; createdAt?: Maybe<string>; url?: Maybe<string> };
type ThreadNode = { id: string; isResolved?: Maybe<boolean>; path?: Maybe<string>; line?: Maybe<number>; comments?: Nodes<CommentNode> };
type IssueCommentNode = { databaseId?: Maybe<number>; body?: Maybe<string> };
type PullRequestNode = {
  number: number;
  url: string;
  state: string;
  isDraft?: Maybe<boolean>;
  baseRefName: string;
  headRefName: string;
  mergeable?: Maybe<string>;
  labels?: Nodes<{ name: string }>;
  commits?: Nodes<Maybe<{ commit?: Maybe<{ statusCheckRollup?: Maybe<Rollup> }> }>>;
  reviewThreads?: Nodes<ThreadNode>;
  comments?: Nodes<IssueCommentNode>;
};

/** The parsed JSON of `CARE_QUERY`, as far as `careState` reads it. */
export type CareResponse = Maybe<{ data?: Maybe<{ repository?: Maybe<{ pullRequest?: Maybe<PullRequestNode> }> }> }>;

export type CheckState = 'green' | 'red' | 'running' | 'none';
export type FailedCheck = { name: string | null | undefined; url: string | null };
export type CareChecks = { state: CheckState; failed: FailedCheck[]; stuck: boolean; fixable: boolean };
export type CareComment = {
  author: string | null;
  avatarUrl: string | null;
  body: string;
  createdAt: string | null;
  url: string | null;
  verdict: CareVerdict | null;
};
export type ThreadNeed = 'judge' | 'mark-asked' | null;
export type CareThread = {
  id: string;
  url: string | null;
  path: string | null;
  line: number | null;
  resolved: boolean;
  comments: CareComment[];
  verdict: CareVerdict | null;
  reason: string | null;
  needs: ThreadNeed;
};
export type CareStatus = { commentId: number | null; watchingSince: string | null; lastRound: string | null };
export type CareState = {
  pr: { number: number; url: string; state: string; isDraft: boolean; base: string; head: string; labels: string[] };
  checks: CareChecks;
  mergeable: string;
  threads: CareThread[];
  status: CareStatus | null;
};
export type CareOptions = { statusMarker: string | null | undefined; needsFixLabel: string | null | undefined; gateContexts?: readonly string[] };

/** The one read of a pull request a round makes. Variables: `owner`, `name`, `number`. */
export const CARE_QUERY = `query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      number url state isDraft baseRefName headRefName mergeable
      labels(first: 50) { nodes { name } }
      commits(last: 1) { nodes { commit { statusCheckRollup { state contexts(first: 100) { nodes {
        __typename
        ... on CheckRun { name status conclusion detailsUrl }
        ... on StatusContext { context state targetUrl }
      } } } } } }
      reviewThreads(first: 100) { nodes { id isResolved path line
        comments(first: 50) { nodes { author { login avatarUrl } body createdAt url } } } }
      comments(last: 100) { nodes { databaseId body } }
    }
  }
}`;

const ROLLUP: Record<string, CheckState> = { SUCCESS: 'green', FAILURE: 'red', ERROR: 'red', PENDING: 'running', EXPECTED: 'running' };
const FAILED_RUN = new Set(['FAILURE', 'TIMED_OUT', 'CANCELLED', 'ACTION_REQUIRED', 'STARTUP_FAILURE']);
const FAILED_STATUS = new Set(['FAILURE', 'ERROR']);
const CARE_LINE_RE = /PR care: watching since (.+?) · last round (.+?)\s*$/m;

function failedContexts(contexts: readonly Maybe<ContextNode>[]): FailedCheck[] {
  const failed: FailedCheck[] = [];
  for (const node of contexts) {
    if (node?.__typename === 'StatusContext') {
      if (FAILED_STATUS.has(node.state ?? '')) failed.push({ name: node.context, url: node.targetUrl ?? null });
    } else if (node && FAILED_RUN.has(node.conclusion ?? '')) {
      failed.push({ name: node.name, url: node.detailsUrl ?? null });
    }
  }
  return failed;
}

function rollupOf(pr: PullRequestNode): Rollup | null {
  return pr.commits?.nodes?.at(-1)?.commit?.statusCheckRollup ?? null;
}

// Red only on the outbox or inbox gate is the gate doing its job, not a failure to fix (/omni:pr).
function isFixable(state: CheckState, failed: readonly FailedCheck[], gateContexts: readonly string[]): boolean {
  if (state !== 'red') return false;
  const gates = new Set<string | null | undefined>(gateContexts);
  return failed.length === 0 || failed.some((run) => !gates.has(run.name));
}

function readChecks(pr: PullRequestNode, labels: readonly string[], { needsFixLabel, gateContexts }: { needsFixLabel: CareOptions['needsFixLabel']; gateContexts: readonly string[] }): CareChecks {
  const rollup = rollupOf(pr);
  const state: CheckState = rollup ? (ROLLUP[rollup.state ?? ''] ?? 'running') : 'none';
  const failed = rollup && state === 'red' ? failedContexts(rollup.contexts?.nodes ?? []) : [];
  const fixable = isFixable(state, failed, gateContexts);
  return { state, failed, stuck: needsFixLabel ? labels.includes(needsFixLabel) : false, fixable };
}

function readComment(node: CommentNode): CareComment {
  return {
    author: node.author?.login ?? null,
    avatarUrl: node.author?.avatarUrl ?? null,
    body: node.body ?? '',
    createdAt: node.createdAt ?? null,
    url: node.url ?? null,
    verdict: readCareVerdict(node.body),
  };
}

/** The reply's text, without its marker. */
function reasonOf(body: string): string {
  return body.replace(/\s*<!-- omni-care: [\w-]+ -->\s*$/, '').trim();
}

/**
 * One thread's care view, or `null` for a thread to leave out (resolved by a person, never by care).
 *
 * - no care reply: unhandled (`verdict: null`), to judge;
 * - its last care reply says asked: asked, and waiting for the PM whatever is said after;
 * - its last care reply says fixed or pushed back, and a person wrote after it or the thread was
 *   reopened: asked, and the round marks it so (the reviewer keeps the last word);
 * - otherwise: the verdict of that reply, handled.
 */
function threadBase(node: ThreadNode, comments: CareComment[], resolved: boolean) {
  return { id: node.id, url: comments[0]?.url ?? null, path: node.path ?? null, line: node.line ?? null, resolved, comments };
}

/** The verdict, reason and need of a thread whose last care reply sits at `last`. */
function repliedThread(comments: readonly CareComment[], last: number, resolved: boolean): Pick<CareThread, 'verdict' | 'reason' | 'needs'> {
  const reply = comments[last]!; // `last` is the index `findLastIndex` found
  const reason = reasonOf(reply.body);
  if (reply.verdict === 'asked') return { verdict: 'asked', reason, needs: null };
  const personAfter = comments.slice(last + 1).some((c) => c.verdict === null);
  if (personAfter || !resolved) return { verdict: 'asked', reason, needs: 'mark-asked' };
  return { verdict: reply.verdict, reason, needs: null };
}

function readThread(node: ThreadNode): CareThread | null {
  const comments = (node.comments?.nodes ?? []).map(readComment);
  const resolved = Boolean(node.isResolved);
  const last = comments.findLastIndex((c) => c.verdict !== null);
  const base = threadBase(node, comments, resolved);
  if (last === -1) return resolved ? null : { ...base, verdict: null, reason: null, needs: 'judge' };
  return { ...base, ...repliedThread(comments, last, resolved) };
}

function readStatus(nodes: readonly IssueCommentNode[], statusMarker: CareOptions['statusMarker']): CareStatus | null {
  const found = nodes.find((node) => statusMarker && String(node.body ?? '').includes(statusMarker));
  if (!found) return null;
  const line = String(found.body).match(CARE_LINE_RE);
  return { commentId: found.databaseId ?? null, watchingSince: line?.[1] ?? null, lastRound: line?.[2] ?? null };
}

/** The care state of the pull request in `response` (the parsed JSON of `CARE_QUERY`). */
export function careState(response: CareResponse, { statusMarker, needsFixLabel, gateContexts = [] }: CareOptions): CareState {
  const pr = response?.data?.repository?.pullRequest;
  if (!pr) throw new Error('the response holds no pull request');
  const labels = (pr.labels?.nodes ?? []).map((label) => label.name);
  return {
    pr: {
      number: pr.number,
      url: pr.url,
      state: pr.state,
      isDraft: Boolean(pr.isDraft),
      base: pr.baseRefName,
      head: pr.headRefName,
      labels,
    },
    checks: readChecks(pr, labels, { needsFixLabel, gateContexts }),
    mergeable: pr.mergeable ?? 'UNKNOWN',
    threads: (pr.reviewThreads?.nodes ?? []).map(readThread).filter((thread) => thread !== null),
    status: readStatus(pr.comments?.nodes ?? [], statusMarker),
  };
}
