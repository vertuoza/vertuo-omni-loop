import 'server-only';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { messageOf } from 'omni-loop/kit/lib/narrow.ts';
import { settle, UNREADABLE, type Read } from '../dashboard/part';
import { periodWindow, type Period } from '../dashboard/board/period';
import type { Database } from '../../../../supabase/database.types.ts';
import { allPages } from '../data/all-pages';
import { memberWorkspace, type Workspace } from '../data/workspace';
import { loadPeople, peopleOf, type People } from '../people/load';
import { readTracked } from '../profile/stored';
import { milestoneStore } from '../timeline/store.repository';
import type { WorkspaceMilestone } from '../timeline/store';
import { loginsShown, withPeople } from './faced';
import type { MainWatchRow } from './broke-main';
import { engineeringOf, type EngineeringValue, type PullRequestRow, type ReviewRow, type SortKey } from './tally';

// /app/engineering's read (PRD 612 s3), as the signed-in person, so row-level security decides what
// each read returns (every member of the workspace reads its repositories, pull requests and
// reviews). First the tracked repositories; with none, the empty state and no other read. Then, in
// parallel, the pull requests that can count in the period (opened or merged since its first instant,
// or open now) and the reviews first given within it, of those repositories only. Any read that fails
// leaves the whole board saying it could not load, its error logged. Loop health (PRD 714 s2) reads the
// open ones at the request's `now`, and its period rate (s4) the sub-PRs merged in the window, and Time per step (PRD 2370 s6) the workspace's PRD milestones. Last, the faces (PRD 652 s3):
// the workspace's people directory, read only when the three lists show someone, resolves each login.
// That read fails soft: its error logged, every face falls back to the GitHub photo and the board
// still renders. A
// repository's page (PRD 645 s2) runs the same reads narrowed to that one tracked repository. The reads are a port
// (EngineeringReads) so the loader is tested on fakes; supabaseEngineeringReads is the page's.

export interface EngineeringReads {
  /** The workspace's tracked repositories, `owner/name`. */
  tracked(): Promise<string[]>;
  /** Their pull requests opened or merged at or after `from`, and every one open now. */
  pullRequests(from: Date, repos: string[]): Promise<PullRequestRow[]>;
  /** Their reviews first given within [from, to). */
  reviews(from: Date, to: Date, repos: string[]): Promise<ReviewRow[]>;
  /** The workspace's PRD milestones (PRD 2370 s6), for the Time per step panel. */
  milestones(): Promise<WorkspaceMilestone[]>;
  /** The main watch lanes (PRD 2410 s4) of PRDs merged around `from` or later, of those repositories. */
  mainWatch(from: Date, repos: string[]): Promise<MainWatchRow[]>;
  /** The workspace's people directory (PRD 652), to resolve each login shown to a face. */
  people(): Promise<People>;
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
  if (tracked.length === 0) return engineeringOf({ tracked, pullRequests: [], reviews: [] }, window, sort, now);
  const [pullRequests, reviews, milestones, mainWatch] = await Promise.all([
    settle('the pull requests', () => reads.pullRequests(window.from, tracked)),
    settle('the reviews', () => reads.reviews(window.from, window.to, tracked)),
    settle('the PRD milestones', () => reads.milestones()),
    settle('the main watch', () => reads.mainWatch(window.from, tracked)),
  ]);
  if (pullRequests === UNREADABLE || reviews === UNREADABLE || milestones === UNREADABLE || mainWatch === UNREADABLE) return UNREADABLE;
  const board = engineeringOf({ tracked, pullRequests, reviews, milestones, mainWatch },window, sort, now);
  if (loginsShown(board).length === 0) return board;
  return withPeople(board, await peopleFor(reads));
}

/** The people directory; an empty one, its error logged, when it cannot be read, so every login keeps its GitHub photo. */
async function peopleFor(reads: EngineeringReads): Promise<People> {
  try {
    return await reads.people();
  } catch (error) {
    console.error(`engineering: the faces could not be read, GitHub photos instead (${messageOf(error)})`);
    return peopleOf([], []);
  }
}

/** The board: the workspace's, or on a repository's page (PRD 645 s2) that repository's, `repo` its tracked spelling. */
export type EngineeringBoard = { kind: 'no-workspace' } | { kind: 'board'; name: string; board: Read<EngineeringValue>; repo?: string };

/** The workspace the person joined first, as /app/workspace reads its own; 'unreadable' when it cannot be read. */
async function workspaceOf(db: SupabaseClient<Database>, user: Pick<User, 'id'>): Promise<Workspace | null | 'unreadable'> {
  try {
    return await memberWorkspace(db, user.id);
  } catch (error) {
    console.error(`engineering: your workspace could not be read (${messageOf(error)})`);
    return 'unreadable';
  }
}

/** The board of the workspace the person joined first. */
export async function loadEngineeringBoard(db: SupabaseClient<Database>, user: Pick<User, 'id'>, request: EngineeringRequest): Promise<EngineeringBoard> {
  const workspace = await workspaceOf(db, user);
  if (workspace === 'unreadable') return { kind: 'board', name: 'Engineering', board: UNREADABLE };
  if (!workspace) return { kind: 'no-workspace' };
  return { kind: 'board', name: workspace.name, board: await loadEngineering(supabaseEngineeringReads(db, workspace.id), request) };
}

/** One repository's board in that workspace (PRD 645 s2); not tracked when the workspace does not track it. */
export async function loadEngineeringRepositoryBoard(
  db: SupabaseClient<Database>, user: Pick<User, 'id'>, repo: string, request: EngineeringRequest,
): Promise<EngineeringBoard | { kind: 'not-tracked' }> {
  const workspace = await workspaceOf(db, user);
  if (workspace === 'unreadable') return { kind: 'board', name: 'Engineering', board: UNREADABLE, repo };
  if (!workspace) return { kind: 'no-workspace' };
  const got = await loadEngineeringRepository(supabaseEngineeringReads(db, workspace.id), repo, request);
  if (got.kind === 'not-tracked') return got;
  return { kind: 'board', name: workspace.name, board: got.board, repo: got.repo };
}

// ── The reads, from Supabase ────────────────────────────────────────────

type StoredPullRequest = {
  repo: string; number: number; author: string | null; author_is_bot: boolean; opened_at: string; merged_at: string | null;
  closed_at: string | null; merged_by: string | null; commits: number; additions: number; deletions: number; omni_signed: boolean;
  base: string | null; head: string | null; draft: boolean; labels: string[] | null; head_committed_at: string | null;
  status_state: string | null; needs_fix_at: string | null;
};
type StoredReview = { repo: string; number: number; reviewer: string; first_at: string };

type StoredWatch = { repository: string; prd: number; lane: string; status: string; merged_at: string };
type StoredBreak = { repository: string; prd: number; lane: string; title: string };
type StoredDossier = { id: string; home_repo: string | null; prd: number | null };
const DAY = 86_400_000;
/** The table refuses any other status; an unknown one reads as still watching, never clean. */
const statusOf = (status: string): MainWatchRow['status'] => (status === 'clean' || status === 'broke' ? status : 'watching');

const PR_COLUMNS = 'repo, number, author, author_is_bot, opened_at, merged_at, closed_at, merged_by, commits, additions, deletions, omni_signed, base, head, draft, labels, head_committed_at, status_state, needs_fix_at';

export function supabaseEngineeringReads(db: SupabaseClient<Database>, workspace: string): EngineeringReads {
  return {
    tracked: () => readTracked(db, workspace, 'engineering: repositories'),
    async pullRequests(from, repos) {
      const at = `"${from.toISOString()}"`;
      const rows = await allPages<StoredPullRequest>('the pull requests', (start, end) => db
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
        base: r.base, head: r.head, draft: r.draft, labels: r.labels ?? [], headCommittedAt: r.head_committed_at,
        statusState: r.status_state, needsFixAt: r.needs_fix_at,
      }));
    },
    async reviews(from, to, repos) {
      const rows = await allPages<StoredReview>('the reviews', (start, end) => db
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
    async mainWatch(from, repos) {
      // A PRD's lanes merge close together: read from two weeks before the window so none of its lanes is missed.
      const since = new Date(from.getTime() - 14 * DAY).toISOString();
      const watch = await allPages<StoredWatch>('the main watch', (start, end) => db
        .from('prd_main_watch')
        .select('repository, prd, lane, status, merged_at')
        .eq('workspace_id', workspace)
        .in('repository', repos.map((r) => r.toLowerCase()))
        .gte('merged_at', since)
        .order('repository', { ascending: true })
        .order('prd', { ascending: true })
        .order('lane', { ascending: true })
        .range(start, end));
      if (watch.length === 0) return [];
      const prds = [...new Set(watch.map((w) => w.prd))];
      const breaks = await allPages<StoredBreak>('the main breaks', (start, end) => db
        .from('prd_main_breaks')
        .select('repository, prd, lane, title, at')
        .eq('workspace_id', workspace)
        .in('prd', prds)
        .order('at', { ascending: true })
        .order('source', { ascending: true })
        .range(start, end));
      const dossiers = await allPages<StoredDossier>('the PRD pages', (start, end) => db
        .from('dossiers')
        .select('id, home_repo, prd')
        .eq('workspace_id', workspace)
        .in('prd', prds)
        .order('id', { ascending: true })
        .range(start, end));
      const dossierOf = new Map(dossiers.map((d) => [`${(d.home_repo ?? '').toLowerCase()}#${d.prd}`, d.id]));
      return watch.map((w) => ({
        repository: w.repository, prd: w.prd, status: statusOf(w.status), mergedAt: w.merged_at,
        breaks: breaks.filter((b) => b.repository === w.repository && b.prd === w.prd && b.lane === w.lane).map((b) => b.title),
        dossier: dossierOf.get(`${w.repository}#${w.prd}`) ?? null,
      }));
    },
    milestones() {
      return milestoneStore(db).workspaceMilestones(workspace);
    },
    people() {
      return loadPeople(db, workspace);
    },
  };
}
