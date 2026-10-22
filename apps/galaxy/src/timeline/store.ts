// A PRD's milestones (PRD 2370, s1): the moments of its timeline, idea to merged, as the stages sync
// records them in public.prd_milestones (supabase/migrations/20261227090000_prd_milestones.sql). This is
// the store's port: the milestones, their rows and the rule a second write follows. The Supabase store is
// ./store.repository.ts, its fake ./store.fake.ts.
//
// A milestone belongs to a PRD (a workspace, a repository and an issue number) and a lane, the repository
// it happened in: the PRD's own for idea, plan and approved, which name no pull request; each lane's
// opened, first-slice, last-slice, ready and merged name the pull request that dates them. Every time is
// GitHub's or the dossier's own: one nobody dated is never written. The first time wins, but last-slice
// only moves later (a rework slice merged after ready).
import type { PrdNumber, PrNumber } from 'omni-loop/kit/lib/ids.ts';

/** Every milestone of a timeline, in the order a PRD reaches them. */
const MILESTONES = ['idea', 'plan', 'approved', 'opened', 'first-slice', 'last-slice', 'ready', 'merged'] as const;
export type MilestoneId = (typeof MILESTONES)[number];

/** The milestones of the PRD itself, whose lane is the PRD's own repository and which name no pull request. */
export const PRD_MILESTONES: readonly MilestoneId[] = ['idea', 'plan', 'approved'];

const KNOWN: ReadonlySet<string> = new Set(MILESTONES);
export const isMilestone = (value: string): value is MilestoneId => KNOWN.has(value);

/** A PRD of a workspace: its repository (`owner/name`) and its issue number. */
export type MilestoneKey = { workspace_id: string; repository: string; prd: PrdNumber };
/** A milestone as a PRD's timeline reads it: its lane, the pull request that dates it, and when. */
export type MilestoneRow = { lane: string; milestone: MilestoneId; pr: PrNumber | null; reached_at: string };
/** A milestone written: its PRD and the row. */
export type MilestoneRecord = MilestoneKey & MilestoneRow;
/** A milestone of a workspace's PRD, as the workspace-wide read gives it. */
export type WorkspaceMilestone = { repository: string; prd: PrdNumber } & MilestoneRow;

export type MilestoneStore = {
  /** Records each milestone seen, as kept() says; each is marked seen at `syncedAt`. */
  recordMilestones(rows: readonly MilestoneRecord[], syncedAt?: string): Promise<void>;
  /** A PRD's milestones, lane by lane, each lane in timeline order. */
  milestonesOf(key: MilestoneKey): Promise<MilestoneRow[]>;
  /** Every milestone of the workspace's PRDs. */
  workspaceMilestones(workspace: string): Promise<WorkspaceMilestone[]>;
  /** When the sync last recorded a milestone of the repository's PRDs; null when it holds none. */
  lastSynced(workspace: string, repository: string): Promise<string | null>;
};

/** Which of a stored milestone and a second write of it is kept: the stored one, but a later last-slice. */
export function kept(stored: MilestoneRow, written: MilestoneRow): MilestoneRow {
  const later = Date.parse(written.reached_at) > Date.parse(stored.reached_at);
  return stored.milestone === 'last-slice' && later ? written : stored;
}

/** Orders a PRD's milestones: by lane, then in timeline order. */
export const byLaneThenTimeline = (a: MilestoneRow, b: MilestoneRow): number =>
  a.lane.localeCompare(b.lane) || MILESTONES.indexOf(a.milestone) - MILESTONES.indexOf(b.milestone);
