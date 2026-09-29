import 'server-only';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { settle, UNREADABLE, type Read } from '../dashboard/part';
import { periodWindow, type Period } from '../dashboard/board/period';
import { memberWorkspace, type Workspace } from '../data/workspace';
import { loginsShown, withFaces, type FacePlayer } from './faces';
import { engineeringOf, type EngineeringValue, type PullRequestRow, type ReviewRow, type SortKey } from './tally';

// /app/engineering's read (PRD 612 s3), as the signed-in person, so row-level security decides what
// each read returns (every member of the workspace reads its repositories, pull requests and
// reviews). First the tracked repositories; with none, the empty state and no other read. Then, in
// parallel, the pull requests that can count in the period (opened or merged since its first instant,
// or open now) and the reviews first given within it, of those repositories only. Any read that fails
// leaves the whole board saying it could not load, its error logged. Last, the faces (PRD 645 s1): the
// workspace's players among the logins the three lists show, for their heroes. That read fails soft:
// its error logged, every face falls back to the GitHub picture and the board still renders. A
// repository's page (PRD 645 s2) runs the same reads narrowed to that one tracked repository. The reads are a port
// (EngineeringReads) so the loader is tested on fakes; supabaseEngineeringReads is the page's.

export interface EngineeringReads {
  /** The workspace's tracked repositories, `owner/name`. */
  tracked(): Promise<string[]>;
  /** Their pull requests opened or merged at or after `from`, and every one open now. */
  pullRequests(from: Date, repos: string[]): Promise<PullRequestRow[]>;
  /** Their reviews first given within [from, to). */
  reviews(from: Date, to: Date, repos: string[]): Promise<ReviewRow[]>;
  /** The workspace's players whose GitHub login is one of these, with their hero and fleet's colour. */
  faces(logins: string[]): Promise<FacePlayer[]>;
}

export interface EngineeringRequest { period: Period; sort: SortKey; now: Date }

export async function loadEngineering(reads: EngineeringReads, request: EngineeringRequest): Promise<Read<EngineeringValue>> {
  const tracked = await settle('the tracked repositories', () => reads.tracked());
  if (tracked === UNREADABLE) return UNREADABLE;
  return boardOf(reads, tracked, request);
}

export type RepositoryRead = { kind: 'not-tracked' } | { kind: 'repository'; repo: string; board: Read<EngineeringValue> };

/** One tracked repository's board (PRD 645 s2): the same board, counted over that repository alone.
 * The repository is matched case-insensitively among the tracked ones and named by its tracked
 * spelling; one the workspace does not track is not tracked, and nothing else is read. */
export async function loadEngineeringRepository(reads: EngineeringReads, repo: string, request: EngineeringRequest): Promise<RepositoryRead> {
  const tracked = await settle('the tracked repositories', () => reads.tracked());
  if (tracked === UNREADABLE) return { kind: 'repository', repo, board: UNREADABLE };
  const found = tracked.find((r) => r.toLowerCase() === repo.toLowerCase());
  if (!found) return { kind: 'not-tracked' };
  return { kind: 'repository', repo: found, board: await boardOf(reads, [found], request) };
}

async function boardOf(reads: EngineeringReads, tracked: string[], { period, sort, now }: EngineeringRequest): Promise<Read<EngineeringValue>> {
  const window = periodWindow(period, now);
  if (tracked.length === 0) return engineeringOf({ tracked, pullRequests: [], reviews: [] }, window, sort);
  const [pullRequests, reviews] = await Promise.all([
    settle('the pull requests', () => reads.pullRequests(window.from, tracked)),
    settle('the reviews', () => reads.reviews(window.from, window.to, tracked)),
  ]);
  if (pullRequests === UNREADABLE || reviews === UNREADABLE) return UNREADABLE;
  const board = engineeringOf({ tracked, pullRequests, reviews }, window, sort);
  return withFaces(board, await facesOf(reads, loginsShown(board)));
}

/** The players among these logins; none, its error logged, when they cannot be read. */
async function facesOf(reads: EngineeringReads, logins: string[]): Promise<FacePlayer[]> {
  if (logins.length === 0) return [];
  try {
    return await reads.faces(logins);
  } catch (error) {
    console.error(`engineering: the faces could not be read, GitHub pictures instead (${(error as Error).message})`);
    return [];
  }
}

/** The board: the workspace's, or on a repository's page (PRD 645 s2) that repository's, `repo` its tracked spelling. */
export type EngineeringBoard = { kind: 'no-workspace' } | { kind: 'board'; name: string; board: Read<EngineeringValue>; repo?: string };

/** The workspace the person joined first, as /app/workspace reads its own; 'unreadable' when it cannot be read. */
async function workspaceOf(db: SupabaseClient, user: Pick<User, 'id'>): Promise<Workspace | null | 'unreadable'> {
  try {
    return await memberWorkspace(db, user.id);
  } catch (error) {
    console.error(`engineering: your workspace could not be read (${(error as Error).message})`);
    return 'unreadable';
  }
}

/** The board of the workspace the person joined first. */
export async function loadEngineeringBoard(db: SupabaseClient, user: Pick<User, 'id'>, request: EngineeringRequest): Promise<EngineeringBoard> {
  const workspace = await workspaceOf(db, user);
  if (workspace === 'unreadable') return { kind: 'board', name: 'Engineering', board: UNREADABLE };
  if (!workspace) return { kind: 'no-workspace' };
  return { kind: 'board', name: workspace.name, board: await loadEngineering(supabaseEngineeringReads(db, workspace.id), request) };
}

/** One repository's board in that workspace (PRD 645 s2); not tracked when the workspace does not track it. */
export async function loadEngineeringRepositoryBoard(
  db: SupabaseClient, user: Pick<User, 'id'>, repo: string, request: EngineeringRequest,
): Promise<EngineeringBoard | { kind: 'not-tracked' }> {
  const workspace = await workspaceOf(db, user);
  if (workspace === 'unreadable') return { kind: 'board', name: 'Engineering', board: UNREADABLE, repo };
  if (!workspace) return { kind: 'no-workspace' };
  const got = await loadEngineeringRepository(supabaseEngineeringReads(db, workspace.id), repo, request);
  if (got.kind === 'not-tracked') return got;
  return { kind: 'board', name: workspace.name, board: got.board, repo: got.repo };
}

// ── The reads, from Supabase ────────────────────────────────────────────

const PAGE = 1000;

type StoredPullRequest = {
  repo: string; number: number; author: string | null; author_is_bot: boolean; opened_at: string; merged_at: string | null;
  closed_at: string | null; merged_by: string | null; commits: number; additions: number; deletions: number; omni_signed: boolean;
};
type StoredReview = { repo: string; number: number; reviewer: string; first_at: string };
type StoredFace = { github_login: string; hero: unknown; teams: { color: string } | null };

type Page<T> = (start: number, end: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>;

/** Every row of a read, a page of a thousand at a time: PostgREST answers no more at once. */
async function allRows<T>(what: string, page: Page<T>): Promise<T[]> {
  const rows: T[] = [];
  for (let start = 0; ; start += PAGE) {
    const { data, error } = await page(start, start + PAGE - 1);
    if (error) throw new Error(`Supabase: could not read the ${what} (${error.message})`);
    const got = (data ?? []) as T[];
    rows.push(...got);
    if (got.length < PAGE) return rows;
  }
}

const PR_COLUMNS = 'repo, number, author, author_is_bot, opened_at, merged_at, closed_at, merged_by, commits, additions, deletions, omni_signed';

export function supabaseEngineeringReads(db: SupabaseClient, workspace: string): EngineeringReads {
  return {
    async tracked() {
      const { data, error } = await db.from('repositories').select('full_name').eq('workspace_id', workspace).eq('tracked', true);
      if (error) throw new Error(`Supabase: could not read the tracked repositories (${error.message})`);
      return ((data ?? []) as { full_name: string }[]).map((r) => r.full_name);
    },
    async pullRequests(from, repos) {
      const at = `"${from.toISOString()}"`;
      const rows = await allRows<StoredPullRequest>('pull requests', (start, end) => db
        .from('pull_requests')
        .select(PR_COLUMNS)
        .eq('workspace_id', workspace)
        .in('repo', repos)
        .or(`opened_at.gte.${at},merged_at.gte.${at},and(merged_at.is.null,closed_at.is.null)`)
        .order('repo', { ascending: true })
        .order('number', { ascending: true })
        .range(start, end));
      return rows.map((r) => ({
        repo: r.repo, number: r.number, author: r.author, authorIsBot: r.author_is_bot, openedAt: r.opened_at, mergedAt: r.merged_at,
        closedAt: r.closed_at, mergedBy: r.merged_by, commits: r.commits, additions: r.additions, deletions: r.deletions, omniSigned: r.omni_signed,
      }));
    },
    async reviews(from, to, repos) {
      const rows = await allRows<StoredReview>('reviews', (start, end) => db
        .from('pull_request_reviews')
        .select('repo, number, reviewer, first_at')
        .eq('workspace_id', workspace)
        .in('repo', repos)
        .gte('first_at', from.toISOString())
        .lt('first_at', to.toISOString())
        .order('repo', { ascending: true })
        .order('number', { ascending: true })
        .order('reviewer', { ascending: true })
        .range(start, end));
      return rows.map((r) => ({ repo: r.repo, number: r.number, reviewer: r.reviewer, firstAt: r.first_at }));
    },
    async faces(logins) {
      // A stored login keeps GitHub's spelling; ask for it and for its lower case, and faceOf matches either.
      const spellings = [...new Set([...logins, ...logins.map((l) => l.toLowerCase())])];
      const { data, error } = await db.from('players').select('github_login, hero, teams(color)').eq('workspace_id', workspace).in('github_login', spellings);
      if (error) throw new Error(`Supabase: could not read the players (${error.message})`);
      return ((data ?? []) as unknown as StoredFace[]).map((r) => ({ login: r.github_login, hero: r.hero, color: r.teams?.color ?? null }));
    },
  };
}
