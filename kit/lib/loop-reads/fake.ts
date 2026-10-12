// The shared fake `LoopReads` (PRD 1665): the loop's state held in memory, read the way the Omni page
// answers it — a list filtered by base, head, label and state, at most 200, newest first — with every
// read recorded. Each command's tests build it from their own data, so the decisions are tested on the
// same facts the page would hand them. A repository named in `failing` throws its `LoopReadError` on
// every read of it; `everything` makes every read throw.
import { LoopReadError } from './port.ts';
import type { ChangesQuery, IssuesQuery, LoopReads } from './port.ts';
import type { LoopChange, LoopChangeDetail, LoopComment, LoopIssue, LoopIssueDetail } from './contract.ts';
import type { IssueNumber, PrNumber } from '../ids.ts';

/** One read the fake was asked for: its name and what it was given. */
export type FakeRead =
  | { read: 'changes'; query: ChangesQuery }
  | { read: 'change'; repo: string; number: PrNumber }
  | { read: 'comments'; repo: string; on: IssueNumber | PrNumber }
  | { read: 'issues'; query: IssuesQuery }
  | { read: 'issue'; repo: string; number: IssueNumber };

/** What the fake holds, by repository (`owner/name`); a conversation's comments, and a change's or an
 * issue's details, by `<repo>#<n>`. */
export type FakeLoopState = {
  changes?: Record<string, readonly LoopChange[]>;
  details?: Record<string, Partial<Omit<LoopChangeDetail, keyof LoopChange>>>;
  comments?: Record<string, readonly LoopComment[]>;
  issues?: Record<string, readonly LoopIssue[]>;
  issueDetails?: Record<string, Partial<Omit<LoopIssueDetail, keyof LoopIssue>>>;
  failing?: Record<string, LoopReadError>;
  everything?: LoopReadError;
};

const MAX = 200;

/** A change as the page answers one, every field it does not name filled plainly. */
export function aChange(fields: Partial<LoopChange> & Pick<LoopChange, 'number' | 'head'>): LoopChange {
  return {
    title: `#${fields.number}`,
    base: 'main',
    state: 'open',
    createdAt: '2026-10-12T09:00:00Z',
    updatedAt: '2026-10-12T09:00:00Z',
    mergedAt: null,
    labels: [],
    body: '',
    url: `https://example.test/changes/${fields.number}`,
    author: null,
    ...fields,
  };
}

const newestFirst = <T extends { createdAt?: string }>(items: readonly T[]): T[] =>
  [...items].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

/** Whether `change` is in a list asked for `query`: an `open` list holds open changes and drafts. */
function listed(change: LoopChange, { base, head, label, state = 'open' }: ChangesQuery): boolean {
  if (base !== undefined && change.base !== base) return false;
  if (head !== undefined && change.head !== head) return false;
  if (label !== undefined && !change.labels.includes(label)) return false;
  return state === 'all' || change.state === 'open' || change.state === 'draft';
}

/** The fake, and every read it was asked for, in order. */
export function fakeLoopReads(state: FakeLoopState = {}): LoopReads & { reads: FakeRead[] } {
  const reads: FakeRead[] = [];
  const guard = (repo: string): void => {
    if (state.everything) throw state.everything;
    const failing = state.failing?.[repo];
    if (failing) throw failing;
  };
  const missing = (what: string, n: number, repo: string) => new LoopReadError(`refused (404): No ${what} ${n} in ${repo}`, 'repository');

  return {
    reads,
    changes(query) {
      reads.push({ read: 'changes', query });
      return Promise.resolve().then(() => {
        guard(query.repo);
        return newestFirst((state.changes?.[query.repo] ?? []).filter((change) => listed(change, query))).slice(0, MAX);
      });
    },
    change(repo, number) {
      reads.push({ read: 'change', repo, number });
      return Promise.resolve().then(() => {
        guard(repo);
        const change = (state.changes?.[repo] ?? []).find((candidate) => candidate.number === number);
        if (!change) throw missing('change', number, repo);
        const more = state.details?.[`${repo}#${number}`] ?? {};
        return { lastCommitAt: null, files: [], review: { checks: [], mergeable: null, threads: [] }, ...change, ...more };
      });
    },
    comments(repo, on) {
      reads.push({ read: 'comments', repo, on });
      return Promise.resolve().then(() => {
        guard(repo);
        return [...(state.comments?.[`${repo}#${on}`] ?? [])];
      });
    },
    issues(query) {
      reads.push({ read: 'issues', query });
      return Promise.resolve().then(() => {
        guard(query.repo);
        const { label, state: wanted = 'open' } = query;
        const all = (state.issues?.[query.repo] ?? []).filter(
          (issue) => (label === undefined || issue.labels.includes(label)) && (wanted === 'all' || issue.state === wanted),
        );
        return [...all].sort((a, b) => b.number - a.number).slice(0, MAX);
      });
    },
    issue(repo, number) {
      reads.push({ read: 'issue', repo, number });
      return Promise.resolve().then(() => {
        guard(repo);
        const issue = (state.issues?.[repo] ?? []).find((candidate) => candidate.number === number);
        if (!issue) throw missing('issue', number, repo);
        return { comments: [], closedBy: [], ...issue, ...(state.issueDetails?.[`${repo}#${number}`] ?? {}) };
      });
    },
  };
}
