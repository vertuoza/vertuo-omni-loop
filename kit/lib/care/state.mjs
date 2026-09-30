// PRD 790: a feature PR's care state, parsed from one GraphQL read — its check rollup, its mergeable
// state, its review threads with each one's verdict, and the care line of `/omni:pr`'s status comment.
// Pure: `kit/bin/commands/care.mjs` runs the query (`CARE_QUERY`) and adds whether a wave holds
// claims; the decision (`decide.mjs`) reads what this returns.
import { readCareVerdict } from './marker.mjs';

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

const ROLLUP = { SUCCESS: 'green', FAILURE: 'red', ERROR: 'red', PENDING: 'running', EXPECTED: 'running' };
const FAILED_RUN = new Set(['FAILURE', 'TIMED_OUT', 'CANCELLED', 'ACTION_REQUIRED', 'STARTUP_FAILURE']);
const FAILED_STATUS = new Set(['FAILURE', 'ERROR']);
const CARE_LINE_RE = /PR care: watching since (.+?) · last round (.+?)\s*$/m;

function failedContexts(contexts) {
  const failed = [];
  for (const node of contexts) {
    if (node?.__typename === 'StatusContext') {
      if (FAILED_STATUS.has(node.state)) failed.push({ name: node.context, url: node.targetUrl ?? null });
    } else if (FAILED_RUN.has(node?.conclusion)) {
      failed.push({ name: node.name, url: node.detailsUrl ?? null });
    }
  }
  return failed;
}

function rollupOf(pr) {
  return pr.commits?.nodes?.at(-1)?.commit?.statusCheckRollup ?? null;
}

// Red only on the outbox or inbox gate is the gate doing its job, not a failure to fix (/omni:pr).
function isFixable(state, failed, gateContexts) {
  if (state !== 'red') return false;
  const gates = new Set(gateContexts);
  return failed.length === 0 || failed.some((run) => !gates.has(run.name));
}

function readChecks(pr, labels, { needsFixLabel, gateContexts }) {
  const rollup = rollupOf(pr);
  const state = rollup ? (ROLLUP[rollup.state] ?? 'running') : 'none';
  const failed = state === 'red' ? failedContexts(rollup.contexts?.nodes ?? []) : [];
  const fixable = isFixable(state, failed, gateContexts);
  return { state, failed, stuck: Boolean(needsFixLabel) && labels.includes(needsFixLabel), fixable };
}

function readComment(node) {
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
function reasonOf(body) {
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
function threadBase(node, comments, resolved) {
  return { id: node.id, url: comments[0]?.url ?? null, path: node.path ?? null, line: node.line ?? null, resolved, comments };
}

/** The verdict, reason and need of a thread whose last care reply sits at `last`. */
function repliedThread(comments, last, resolved) {
  const reply = comments[last];
  const reason = reasonOf(reply.body);
  if (reply.verdict === 'asked') return { verdict: 'asked', reason, needs: null };
  const personAfter = comments.slice(last + 1).some((c) => c.verdict === null);
  if (personAfter || !resolved) return { verdict: 'asked', reason, needs: 'mark-asked' };
  return { verdict: reply.verdict, reason, needs: null };
}

function readThread(node) {
  const comments = (node.comments?.nodes ?? []).map(readComment);
  const resolved = Boolean(node.isResolved);
  const last = comments.findLastIndex((c) => c.verdict !== null);
  const base = threadBase(node, comments, resolved);
  if (last === -1) return resolved ? null : { ...base, verdict: null, reason: null, needs: 'judge' };
  return { ...base, ...repliedThread(comments, last, resolved) };
}

function readStatus(nodes, statusMarker) {
  const found = nodes.find((node) => statusMarker && String(node.body ?? '').includes(statusMarker));
  if (!found) return null;
  const line = String(found.body).match(CARE_LINE_RE);
  return { commentId: found.databaseId ?? null, watchingSince: line?.[1] ?? null, lastRound: line?.[2] ?? null };
}

/**
 * The care state of the pull request in `response` (the parsed JSON of `CARE_QUERY`).
 *
 * @param {object} response
 * @param {{ statusMarker: string, needsFixLabel: string, gateContexts: string[] }} options
 */
export function careState(response, { statusMarker, needsFixLabel, gateContexts = [] }) {
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
    threads: (pr.reviewThreads?.nodes ?? []).map(readThread).filter(Boolean),
    status: readStatus(pr.comments?.nodes ?? [], statusMarker),
  };
}
