// PRD 790: a feature PR's care state — its checks, its mergeable state, its review threads with each
// one's verdict, and the care line of `/omni:pr`'s status comment. PRD 1665: read from the loop's facts,
// one change with its review and its conversation's comments, as the Omni page answers them through
// `LoopReads`; no GraphQL query is left. Pure: `kit/bin/commands/care.ts` and `next.ts` make the reads
// and add whether a wave holds claims; the decision (`decide.ts`) reads what this returns.
import { readCareVerdict } from './marker.ts';
import { at } from '../narrow.ts';
import type { CareVerdict } from './marker.ts';
import { parsePr } from '../ids.ts';
import type { CommentId, PrNumber } from '../ids.ts';
import type { LoopChangeDetail, LoopComment } from '../loop-reads/contract.ts';

/** What a care state is read from: one change, with its review, and its conversation's comments. */
export type CareFacts = { change: LoopChangeDetail; comments: readonly Pick<LoopComment, 'id' | 'body'>[] };

/** One check, one thread and one thread comment, as the facts carry them. */
type Check = LoopChangeDetail['review']['checks'][number];
type Thread = LoopChangeDetail['review']['threads'][number];
type ThreadComment = Thread['comments'][number];

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
/** Another repository's pull request a red CI waits on (PRD 1118), as the status comment names it. */
export type WaitsOn = { slug: string; pr: PrNumber };
export type CareStatus = {
  commentId: CommentId | null;
  watchingSince: string | null;
  lastRound: string | null;
  /** Present only when the status comment carries a `waits on <slug>#<pr>` line. */
  waitsOn?: WaitsOn;
};
export type CareState = {
  pr: { number: PrNumber; url: string; state: string; isDraft: boolean; base: string; head: string; labels: string[] };
  checks: CareChecks;
  mergeable: string;
  threads: CareThread[];
  status: CareStatus | null;
};
export type CareOptions = { statusMarker: string | null | undefined; needsFixLabel: string | null | undefined; gateContexts?: readonly string[] };

const CARE_LINE_RE = /PR care: watching since (.+?) · last round (.+?)\s*$/m;
const WAITS_ON_RE = /\bwaits on ([\w.-]+\/[\w.-]+)#(\d+)/;

/** The checks' state as GitHub's rollup draws it: red once one failed, running while one is pending,
 * green otherwise, none without a check. */
function rollupOf(checks: readonly Check[]): CheckState {
  if (checks.length === 0) return 'none';
  if (checks.some((check) => check.state === 'failure')) return 'red';
  return checks.some((check) => check.state === 'pending') ? 'running' : 'green';
}

// Red only on the outbox or inbox gate is the gate doing its job, not a failure to fix (/omni:pr).
function isFixable(state: CheckState, failed: readonly FailedCheck[], gateContexts: readonly string[]): boolean {
  if (state !== 'red') return false;
  const gates = new Set<string | null | undefined>(gateContexts);
  return failed.length === 0 || failed.some((run) => !gates.has(run.name));
}

/** The checks of the change's head, read for a round. The facts carry no link to a check's run. */
function readChecks(
  checks: readonly Check[],
  labels: readonly string[],
  { needsFixLabel, gateContexts }: { needsFixLabel: CareOptions['needsFixLabel']; gateContexts: readonly string[] },
): CareChecks {
  const state = rollupOf(checks);
  const failed = checks.filter((check) => check.state === 'failure').map((check) => ({ name: check.name, url: null }));
  const fixable = isFixable(state, failed, gateContexts);
  return { state, failed, stuck: needsFixLabel ? labels.includes(needsFixLabel) : false, fixable };
}

/** A thread comment, for a round: the facts carry no avatar and no link to it. */
function readComment(comment: ThreadComment): CareComment {
  return { author: comment.author, avatarUrl: null, body: comment.body, createdAt: comment.createdAt, url: null, verdict: readCareVerdict(comment.body) };
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
function threadBase(thread: Thread, comments: CareComment[]) {
  return { id: thread.id, url: null, path: thread.path, line: thread.line, resolved: thread.resolved, comments };
}

/** The verdict, reason and need of a thread whose last care reply sits at `last`. */
function repliedThread(comments: readonly CareComment[], last: number, resolved: boolean): Pick<CareThread, 'verdict' | 'reason' | 'needs'> {
  const reply = at(comments, last, 'the last care reply'); // `last` is the index `findLastIndex` found
  const reason = reasonOf(reply.body);
  if (reply.verdict === 'asked') return { verdict: 'asked', reason, needs: null };
  const personAfter = comments.slice(last + 1).some((c) => c.verdict === null);
  if (personAfter || !resolved) return { verdict: 'asked', reason, needs: 'mark-asked' };
  return { verdict: reply.verdict, reason, needs: null };
}

function readThread(thread: Thread): CareThread | null {
  const comments = thread.comments.map(readComment);
  const last = comments.findLastIndex((c) => c.verdict !== null);
  const base = threadBase(thread, comments);
  if (last === -1) return thread.resolved ? null : { ...base, verdict: null, reason: null, needs: 'judge' };
  return { ...base, ...repliedThread(comments, last, thread.resolved) };
}

/** The `waits on <slug>#<pr>` line of a status comment, as the field it adds; `{}` without one. */
function waitsOnIn(body: string): Pick<CareStatus, 'waitsOn'> {
  const waits = body.match(WAITS_ON_RE);
  return waits?.[1] && waits[2] ? { waitsOn: { slug: waits[1], pr: parsePr(waits[2]) } } : {};
}

function readStatus(comments: CareFacts['comments'], statusMarker: CareOptions['statusMarker']): CareStatus | null {
  const found = comments.find((comment) => statusMarker && comment.body.includes(statusMarker));
  if (!found) return null;
  const line = found.body.match(CARE_LINE_RE);
  return { commentId: found.id, watchingSince: line?.[1] ?? null, lastRound: line?.[2] ?? null, ...waitsOnIn(found.body) };
}

/** A change's state as the care state has always named it: GitHub's, a draft being open. */
const PR_STATES: Record<LoopChangeDetail['state'], string> = { open: 'OPEN', draft: 'OPEN', merged: 'MERGED', closed: 'CLOSED' };

/** Whether the change merges cleanly, in the words the care state has always used. */
function mergeableOf(mergeable: boolean | null): string {
  if (mergeable === null) return 'UNKNOWN';
  return mergeable ? 'MERGEABLE' : 'CONFLICTING';
}

/** The care state of `change`, from its review and its conversation's `comments`. */
export function careState({ change, comments }: CareFacts, { statusMarker, needsFixLabel, gateContexts = [] }: CareOptions): CareState {
  return {
    pr: {
      number: change.number,
      url: change.url,
      state: PR_STATES[change.state],
      isDraft: change.state === 'draft',
      base: change.base,
      head: change.head,
      labels: [...change.labels],
    },
    checks: readChecks(change.review.checks, change.labels, { needsFixLabel, gateContexts }),
    mergeable: mergeableOf(change.review.mergeable),
    threads: change.review.threads.map(readThread).filter((thread) => thread !== null),
    status: readStatus(comments, statusMarker),
  };
}
