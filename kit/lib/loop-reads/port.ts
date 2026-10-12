// `LoopReads` (PRD 1665): the one port the kit's deciding commands read the loop's state through —
// a repository's changes, one change with its review, a conversation's comments, its issues and one
// issue. Its adapter is the Omni page (`./omni.ts`); tests hand in the shared fake (`./fake.ts`).
// A read that cannot be made throws a `LoopReadError` carrying the one line a command prints.
import type { LoopChange, LoopChangeDetail, LoopComment, LoopIssue, LoopIssueDetail } from './contract.ts';
import type { IssueNumber, PrNumber } from '../ids.ts';

/** Which changes of a repository a list reads: filtered by any of base, head and label; open only unless `all`. */
export type ChangesQuery = { repo: string; base?: string | undefined; head?: string | undefined; label?: string | undefined; state?: 'all' | 'open' | undefined };

/** Which issues of a repository a list reads: filtered by a label; open only unless `all` or `closed`. */
export type IssuesQuery = { repo: string; label?: string | undefined; state?: 'all' | 'open' | 'closed' | undefined };

export type LoopReads = {
  /** A repository's changes, at most 200, newest first. */
  changes(query: ChangesQuery): Promise<LoopChange[]>;
  /** One change, with its last commit's date, its files and its review. */
  change(repo: string, number: PrNumber): Promise<LoopChangeDetail>;
  /** The conversation of an issue or a change, oldest first. */
  comments(repo: string, on: IssueNumber | PrNumber): Promise<LoopComment[]>;
  /** A repository's issues, at most 200, newest first. */
  issues(query: IssuesQuery): Promise<LoopIssue[]>;
  /** One issue, with its comments and the changes that close it. */
  issue(repo: string, number: IssueNumber): Promise<LoopIssueDetail>;
};

/**
 * Why a read could not be made: `line` is what a command prints, alone, on stderr. `scope` says what
 * it holds: `repository` when only that repository cannot be read (refused for it), `everything`
 * when no read can be made at all (no sign-in, no answer, a page without the loop's routes).
 */
export class LoopReadError extends Error {
  readonly line: string;
  readonly scope: 'repository' | 'everything';

  constructor(line: string, scope: 'repository' | 'everything') {
    super(line);
    this.name = 'LoopReadError';
    this.line = line;
    this.scope = scope;
  }
}

/** Whether `error` holds a single repository only: a board then marks that repository's slices unreadable. */
export function holdsOneRepository(error: unknown): error is LoopReadError {
  return error instanceof LoopReadError && error.scope === 'repository';
}

/** What a board reads: a repository's changes, and when a change's head was last committed (the
 * stale-claim rule's date). `boardReads` takes it from any `LoopReads`. */
export type BoardReads = { changes: LoopReads['changes']; lastCommitAt(repo: string, number: PrNumber): Promise<string | null> };

export function boardReads(reads: LoopReads): BoardReads {
  return {
    changes: (query) => reads.changes(query),
    lastCommitAt: async (repo, number) => (await reads.change(repo, number)).lastCommitAt,
  };
}
