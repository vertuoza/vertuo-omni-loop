// The loop's reads (PRD 1665, s1 and s2; ADR-0095): what the kit asks of a repository's changes and issues, checked
// against the caller's workspace before the host is asked anything. The service knows no code host:
// it is handed one (`LoopHost`, ./github.ts for GitHub), and where a repository belongs
// (`LoopWorkspaces`, ./loop.repository.ts). It never sees a token.
import {
  MAX_CHANGES, MAX_ISSUES,
  type Change, type ChangeDetail, type ChangesQuery, type Comment, type CommentsQuery, type Issue, type IssueDetail, type IssuesQuery,
} from './loop.contract';
import type { IssueNumber, PrNumber } from 'omni-loop/kit/lib/ids.ts';
import type { LoopWorkspaces } from './loop.repository';

/** The host cannot read the repository: its app is not installed there, or its token is refused. */
export class HostUnreadable extends Error {
  constructor(repo: string, why: string) {
    super(`the host cannot read ${repo}: ${why}`);
    this.name = 'HostUnreadable';
  }
}

/** `host`'s rate budget for the repository is spent until `until` (epoch ms). */
export class HostSpent extends Error {
  readonly until: number;
  readonly host: string;
  constructor(repo: string, until: number, host: string) {
    super(`${host}'s budget for ${repo} is spent until ${new Date(until).toISOString()}`);
    this.name = 'HostSpent';
    this.until = until;
    this.host = host;
  }
}

/** A code host, as the loop reads it. Each method throws HostUnreadable or HostSpent, or any Error
 * when the host failed. */
export type LoopHost = {
  /** The repository's changes the query names, newest first, at most `limit`. */
  changes(query: ChangesQuery, limit: number): Promise<Change[]>;
  /** One change, with its review, or null when the repository has none by that number. */
  change(repo: string, number: PrNumber): Promise<ChangeDetail | null>;
  /** The conversation of an issue or a change, oldest first, or null when the repository has neither by
   * that number. */
  comments(query: CommentsQuery): Promise<Comment[] | null>;
  /** The repository's issues the query names, never a change, newest first, at most `limit`. */
  issues(query: IssuesQuery, limit: number): Promise<Issue[]>;
  /** One issue, or null when the repository has no issue by that number (a change is no issue). */
  issue(repo: string, number: IssueNumber): Promise<IssueDetail | null>;
};

export type LoopRead<T> = { kind: 'ok'; reply: T } | { kind: 'outside'; reason: string } | { kind: 'missing' };

const newestFirst = (a: Change, b: Change) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.number - a.number;
const highestFirst = (a: Issue, b: Issue) => b.number - a.number;

/** A host's answer, or `missing` when it found nothing by that number. */
const found = <T>(reply: T | null): LoopRead<T> => (reply === null ? { kind: 'missing' } : { kind: 'ok', reply });

export function loopService(workspaces: LoopWorkspaces, host: LoopHost) {
  /** The database's refusal, when the repository is not the person's workspace's. */
  async function outside(person: string, repo: string): Promise<string | null> {
    const placed = await workspaces.workspaceOf(person, repo);
    return 'refusal' in placed ? placed.refusal : null;
  }

  return {
    async changes(person: string, query: ChangesQuery): Promise<LoopRead<{ changes: Change[] }>> {
      const reason = await outside(person, query.repo);
      if (reason !== null) return { kind: 'outside', reason };
      const changes = (await host.changes(query, MAX_CHANGES)).sort(newestFirst).slice(0, MAX_CHANGES);
      return { kind: 'ok', reply: { changes } };
    },

    async change(person: string, repo: string, number: PrNumber): Promise<LoopRead<ChangeDetail>> {
      const reason = await outside(person, repo);
      if (reason !== null) return { kind: 'outside', reason };
      return found(await host.change(repo, number));
    },

    async comments(person: string, query: CommentsQuery): Promise<LoopRead<{ comments: Comment[] }>> {
      const reason = await outside(person, query.repo);
      if (reason !== null) return { kind: 'outside', reason };
      const comments = await host.comments(query);
      return found(comments === null ? null : { comments });
    },

    async issues(person: string, query: IssuesQuery): Promise<LoopRead<{ issues: Issue[] }>> {
      const reason = await outside(person, query.repo);
      if (reason !== null) return { kind: 'outside', reason };
      const issues = (await host.issues(query, MAX_ISSUES)).sort(highestFirst).slice(0, MAX_ISSUES);
      return { kind: 'ok', reply: { issues } };
    },

    async issue(person: string, repo: string, number: IssueNumber): Promise<LoopRead<IssueDetail>> {
      const reason = await outside(person, repo);
      if (reason !== null) return { kind: 'outside', reason };
      return found(await host.issue(repo, number));
    },
  };
}

export type LoopService = ReturnType<typeof loopService>;
