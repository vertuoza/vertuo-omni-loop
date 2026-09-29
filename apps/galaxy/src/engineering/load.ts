import 'server-only';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { settle, UNREADABLE, type Read } from '../dashboard/part';
import { periodWindow, type Period } from '../dashboard/board/period';
import { memberWorkspace, type Workspace } from '../data/workspace';
import { engineeringOf, type EngineeringValue, type PullRequestRow, type ReviewRow, type SortKey } from './tally';

// /app/engineering's read (PRD 612 s3), as the signed-in person, so row-level security decides what
// each read returns (every member of the workspace reads its repositories, pull requests and
// reviews). First the tracked repositories; with none, the empty state and no other read. Then, in
// parallel, the pull requests that can count in the period (opened or merged since its first instant,
// or open now) and the reviews first given within it, of those repositories only. Any read that fails
// leaves the whole board saying it could not load, its error logged. The reads are a port
// (EngineeringReads) so the loader is tested on fakes; supabaseEngineeringReads is the page's.

export interface EngineeringReads {
  /** The workspace's tracked repositories, `owner/name`. */
  tracked(): Promise<string[]>;
  /** Their pull requests opened or merged at or after `from`, and every one open now. */
  pullRequests(from: Date, repos: string[]): Promise<PullRequestRow[]>;
  /** Their reviews first given within [from, to). */
  reviews(from: Date, to: Date, repos: string[]): Promise<ReviewRow[]>;
}

export interface EngineeringRequest { period: Period; sort: SortKey; now: Date }

export async function loadEngineering(reads: EngineeringReads, { period, sort, now }: EngineeringRequest): Promise<Read<EngineeringValue>> {
  const window = periodWindow(period, now);
  const tracked = await settle('the tracked repositories', () => reads.tracked());
  if (tracked === UNREADABLE) return UNREADABLE;
  if (tracked.length === 0) return engineeringOf({ tracked, pullRequests: [], reviews: [] }, window, sort);
  const [pullRequests, reviews] = await Promise.all([
    settle('the pull requests', () => reads.pullRequests(window.from, tracked)),
    settle('the reviews', () => reads.reviews(window.from, window.to, tracked)),
  ]);
  if (pullRequests === UNREADABLE || reviews === UNREADABLE) return UNREADABLE;
  return engineeringOf({ tracked, pullRequests, reviews }, window, sort);
}

export type EngineeringBoard = { kind: 'no-workspace' } | { kind: 'board'; name: string; board: Read<EngineeringValue> };

/** The board of the workspace the person joined first, as /app/workspace reads its own. */
export async function loadEngineeringBoard(db: SupabaseClient, user: Pick<User, 'id'>, request: EngineeringRequest): Promise<EngineeringBoard> {
  let workspace: Workspace | null;
  try {
    workspace = await memberWorkspace(db, user.id);
  } catch (error) {
    console.error(`engineering: your workspace could not be read (${(error as Error).message})`);
    return { kind: 'board', name: 'Engineering', board: UNREADABLE };
  }
  if (!workspace) return { kind: 'no-workspace' };
  return { kind: 'board', name: workspace.name, board: await loadEngineering(supabaseEngineeringReads(db, workspace.id), request) };
}

// ── The reads, from Supabase ────────────────────────────────────────────

const PAGE = 1000;

type StoredPullRequest = {
  repo: string; number: number; author: string | null; author_is_bot: boolean; opened_at: string; merged_at: string | null;
  closed_at: string | null; merged_by: string | null; commits: number; additions: number; deletions: number; omni_signed: boolean;
};
type StoredReview = { repo: string; number: number; reviewer: string; first_at: string };

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
  };
}
