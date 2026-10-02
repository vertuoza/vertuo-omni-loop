// The feature PR's care state (PRD 790, s2): what the PRD page knows of the feature PR's health, read
// in one GraphQL query by ./reader.ts while the feature PR is open. Its check rollup (green, red with
// the failed run's link, or running), its mergeable state against its base, the review threads that are
// open or that `/omni:pr-care` handled (each with its verdict, read from the hidden
// `<!-- omni-care: fixed|pushed-back|asked -->` marker of the care reply) and the status comment's
// `PR care: watching since … · last round …` line. The page reads the verdicts here, never stores them.
//
// A thread's verdict: the last care reply's marker, except that a person writing after it, or a thread
// care resolved and someone reopened, makes it `asked` (the reviewer keeps the last word). A thread with
// no care reply is `open` while unresolved; resolved by a person without one, it is left out.
import { isOneOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import { z } from 'zod';

export type CareCi = 'green' | 'red' | 'running' | 'none';
export type CareVerdict = 'open' | 'fixed' | 'pushed-back' | 'asked';

/** One review thread, as the PR care tab lists it. */
export type CareThread = {
  url: string;
  login: string;
  avatar: string | null;
  /** The first line of the thread's first comment. */
  firstLine: string;
  verdict: CareVerdict;
  /** The care reply's words without the marker; null when care has not replied. */
  reason: string | null;
  resolved: boolean;
};

export type CareState = {
  ci: CareCi;
  /** The failed run's link while CI is red; null otherwise, or when GitHub gives none. */
  failedUrl: string | null;
  /** Whether the feature PR conflicts with its base; null while GitHub is still working it out. */
  conflict: boolean | null;
  base: string;
  threads: CareThread[];
  /** The status comment's care line: when the watch started and its last round (ISO); null when absent. */
  watchingSince: string | null;
  lastRound: string | null;
};

/** The GraphQL query ./reader.ts sends, with `owner`, `name` and `number`. */
export const CARE_QUERY = `query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      mergeable
      baseRefName
      commits(last: 1) { nodes { commit { statusCheckRollup { state contexts(first: 100) { nodes {
        __typename
        ... on CheckRun { conclusion detailsUrl }
        ... on StatusContext { state targetUrl }
      } } } } } }
      reviewThreads(first: 100) { nodes {
        isResolved
        comments(first: 50) { nodes { body url author { login avatarUrl } } }
      } }
      comments(first: 100) { nodes { body } }
    }
  }
}`;

const Author = z.object({ login: z.string(), avatarUrl: z.string().nullable().optional() }).nullable().optional();
const Comment = z.object({ body: z.string().nullable().optional(), url: z.string(), author: Author });
const Context = z.object({
  __typename: z.string().optional(),
  conclusion: z.string().nullable().optional(),
  detailsUrl: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  targetUrl: z.string().nullable().optional(),
});
const Rollup = z.object({ state: z.string(), contexts: z.object({ nodes: z.array(Context.nullable()) }).optional() }).nullable().optional();
const Answer = z.object({
  repository: z.object({
    pullRequest: z.object({
      mergeable: z.string(),
      baseRefName: z.string(),
      commits: z.object({ nodes: z.array(z.object({ commit: z.object({ statusCheckRollup: Rollup }) }).nullable()) }),
      reviewThreads: z.object({ nodes: z.array(z.object({ isResolved: z.boolean(), comments: z.object({ nodes: z.array(Comment.nullable()) }) }).nullable()) }),
      comments: z.object({ nodes: z.array(z.object({ body: z.string().nullable().optional() }).nullable()) }),
    }).nullable(),
  }).nullable(),
});

const MARKER = /<!--\s*omni-care:\s*([a-z-]+)\s*-->/;
const VERDICTS: readonly Exclude<CareVerdict, 'open'>[] = ['fixed', 'pushed-back', 'asked'];

/** A comment's care verdict; null when it carries no marker, or an unknown one (then it is a person's). */
export function careVerdictOf(body: string | null | undefined): Exclude<CareVerdict, 'open'> | null {
  const found = MARKER.exec(body ?? '')?.[1];
  return isOneOf(VERDICTS, found) ? found : null;
}

const FAILED_RUN = new Set(['FAILURE', 'TIMED_OUT', 'CANCELLED', 'ACTION_REQUIRED', 'STARTUP_FAILURE']);
const FAILED_STATUS = new Set(['FAILURE', 'ERROR']);

type RollupContext = NonNullable<NonNullable<NonNullable<z.infer<typeof Rollup>>['contexts']>['nodes'][number]>;

const hasFailed = (c: RollupContext | null): c is RollupContext =>
  c !== null && (FAILED_RUN.has(c.conclusion ?? '') || FAILED_STATUS.has(c.state ?? ''));

/** The link of the first failed check or status of a red rollup. */
function failedUrlOf(rollup: NonNullable<z.infer<typeof Rollup>>): string | null {
  const failed = (rollup.contexts?.nodes ?? []).find(hasFailed);
  return failed?.detailsUrl ?? failed?.targetUrl ?? null;
}

const ROLLUP_CI: Record<string, CareCi> = { SUCCESS: 'green', FAILURE: 'red', ERROR: 'red' };

function ciOf(rollup: z.infer<typeof Rollup>): { ci: CareCi; failedUrl: string | null } {
  if (!rollup) return { ci: 'none', failedUrl: null };
  const ci = ROLLUP_CI[rollup.state ?? ''] ?? 'running';
  return { ci, failedUrl: ci === 'red' ? failedUrlOf(rollup) : null };
}

const reasonOf = (body: string) => body.replace(MARKER, '').trim() || null;

type CareComment = z.infer<typeof Comment>;

/** What a thread shows of its first comment: who opened it and its first line. */
function threadBaseOf(first: CareComment, resolved: boolean) {
  return { url: first.url, login: first.author?.login ?? 'ghost', avatar: first.author?.avatarUrl ?? null,
    firstLine: (first.body ?? '').trim().split('\n')[0]!.trim(), resolved };
}

/** The verdict and reason of the last care reply, at `lastCare`: asked once a person spoke after it
 * or reopened the thread. */
function repliedOf(comments: CareComment[], lastCare: number, resolved: boolean): Pick<CareThread, 'verdict' | 'reason'> {
  const reply = comments[lastCare]!;
  const marked = careVerdictOf(reply.body)!;
  const spokeAfter = lastCare < comments.length - 1;
  const reopened = !resolved && marked !== 'asked';
  return { verdict: spokeAfter || reopened ? 'asked' : marked, reason: reasonOf(reply.body ?? '') };
}

function threadOf(thread: { isResolved: boolean; comments: { nodes: (CareComment | null)[] } }): CareThread | null {
  const comments = thread.comments.nodes.filter((c): c is CareComment => c !== null);
  const [first] = comments;
  if (!first) return null;
  const lastCare = comments.findLastIndex((c) => careVerdictOf(c.body) !== null);
  const base = threadBaseOf(first, thread.isResolved);
  if (lastCare === -1) return thread.isResolved ? null : { ...base, verdict: 'open', reason: null };
  return { ...base, ...repliedOf(comments, lastCare, thread.isResolved) };
}

const CARE_LINE = /PR care: watching since (.+?) · last round (.+?)\s*$/m;
const iso = (text: string) => {
  const at = Date.parse(text.trim());
  return Number.isNaN(at) ? null : new Date(at).toISOString();
};

/** Asked threads first, then open ones, then the handled ones, each group in GitHub's order. */
const ORDER: Record<CareVerdict, number> = { asked: 0, open: 1, fixed: 2, 'pushed-back': 3 };

/** The care state from GitHub's answer to CARE_QUERY; `statusMarker` finds `/omni:pr`'s status comment.
 * Null when the pull request is not there. Throws when the answer is not the shape asked for. */
export function parseCare(data: unknown, statusMarker: string): CareState | null {
  const pull = Answer.parse(data).repository?.pullRequest;
  if (!pull) return null;
  const rollup = pull.commits.nodes.at(-1)?.commit.statusCheckRollup ?? null;
  const threads = pull.reviewThreads.nodes
    .map((t) => (t ? threadOf(t) : null))
    .filter((t): t is CareThread => t !== null)
    .map((t, i) => ({ t, i }))
    .sort((a, b) => ORDER[a.t.verdict] - ORDER[b.t.verdict] || a.i - b.i)
    .map(({ t }) => t);
  const status = pull.comments.nodes.find((c) => c?.body?.includes(statusMarker))?.body ?? null;
  const line = status ? CARE_LINE.exec(status) : null;
  return {
    ...ciOf(rollup),
    conflict: pull.mergeable === 'CONFLICTING' ? true : pull.mergeable === 'MERGEABLE' ? false : null,
    base: pull.baseRefName,
    threads,
    watchingSince: line ? iso(line[1]!) : null,
    lastRound: line ? iso(line[2]!) : null,
  };
}

/** How long after its last round a watch still counts as watching. */
export const WATCH_FRESH_MS = 15 * 60_000;

/** Whether someone is watching: the last round is under 15 minutes old. */
export function isWatching(care: CareState, now: number): boolean {
  if (!care.lastRound) return false;
  return now - Date.parse(care.lastRound) < WATCH_FRESH_MS;
}

/** The threads still waiting on someone: unresolved, whether unhandled or asked. */
export const openThreads = (care: CareState) => care.threads.filter((t) => !t.resolved).length;
