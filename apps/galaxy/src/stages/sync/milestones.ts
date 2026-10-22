// The milestones a repository shows (PRD 2370, s1): the same snapshot the stages are read from (./core.ts),
// turned into each PRD's milestones for its one lane, the repository itself. Pure: the reader
// (./github.ts) fills the snapshot, the route (./sync.ts) records what comes out.
//
// - approved: the PRD's first approval when it was born on the server (◆), else its phase-0 PR's merge.
// - the lane's feature PR (the merged one, else the earliest still open): opened at its creation, ready
//   when it was first marked ready for review (at its creation when opened ready), merged at its merge.
// - first-slice and last-slice: the first and the latest pull request merged into its head branch, the
//   latest before the feature PR merged.
//
// Every time is GitHub's or the approval's own: a milestone nothing dates is left out, never dated at the
// sync's time. A PRD's folder names its topic, so its feature branch; a ◆ PRD's folder stays on its
// feature branch until it ships, so its feature PR is the one whose body carries the config's feature link
// (`Closes #<n>`) on a branch of the feature shape. idea and plan come from the dossier (dossierMilestones, below), not from the snapshot.
//
// PRD 2370 (s4): a repository is also a target of other repositories' PRDs, a plan repository's: each of its
// feature PRs into the default branch whose body starts `Part of <owner/repo>#<n>` is a lane of that PRD,
// named after this repository, its sub-PRs the ones merged into the PR's head branch (targetMilestones,
// below). Whether the plan repository holds that PRD is the route's to check, across the workspace.
import { PRD_MILESTONES, type MilestoneId, type MilestoneRecord } from '../../timeline/store';
import { anyTopic, branchPattern, foldersOf, linkPattern, planPrdOf, type RepoSnapshot, type ServerBorn, type SnapshotPull } from './core';
import type { DossierTimes } from './dossier-times.repository';
import type { PrdNumber, PrNumber } from 'omni-loop/kit/lib/ids.ts';

/** A milestone seen, without its workspace: the route adds it. */
export type SeenMilestone = Omit<MilestoneRecord, 'workspace_id'>;

type Merged = SnapshotPull & { merged_at: string };
type Dated = [milestone: MilestoneId, pr: PrNumber | null, at: string | null];

const time = (at: string) => Date.parse(at);
const isMerged = (pull: SnapshotPull): pull is Merged => pull.merged_at !== null;
const byMerge = (a: Merged, b: Merged) => time(a.merged_at) - time(b.merged_at);
const byOpening = (a: SnapshotPull, b: SnapshotPull) => time(a.created_at) - time(b.created_at);
const counted = (pull: SnapshotPull) => pull.state === 'open' || isMerged(pull);

/** The lane's feature PR among `candidates`: the first merged, else the earliest opened still open. */
function leadOf(candidates: readonly SnapshotPull[]): SnapshotPull | null {
  const live = candidates.filter(counted);
  return live.filter(isMerged).sort(byMerge)[0] ?? [...live].sort(byOpening)[0] ?? null;
}

/** When the feature PR was first ready: its first ready event, its creation when opened ready, or null when its events were not read. */
function readyOf(pull: SnapshotPull): string | null {
  if (pull.first_ready_at === undefined) return null;
  return pull.first_ready_at ?? pull.created_at;
}

/** The lane milestones of the feature branch `feature`, `lead` its feature PR when one is found. */
function laneOf(pulls: readonly SnapshotPull[], feature: string, lead: SnapshotPull | null): Dated[] {
  const bound = lead?.merged_at ?? null;
  const slices = pulls.filter(isMerged).filter((p) => p.base === feature && (bound === null || time(p.merged_at) <= time(bound))).sort(byMerge);
  const first = slices[0];
  const last = slices.at(-1);
  return [
    ...(lead ? [['opened', lead.number, lead.created_at], ['ready', lead.number, readyOf(lead)], ['merged', lead.number, lead.merged_at]] satisfies Dated[] : []),
    ...(first ? [['first-slice', first.number, first.merged_at]] satisfies Dated[] : []),
    ...(last ? [['last-slice', last.number, last.merged_at]] satisfies Dated[] : []),
  ];
}

/** Every milestone the repository shows for its PRDs, `serverBorn` naming its ◆ PRDs; nothing without a config. */
export function milestonesOfRepo(snapshot: RepoSnapshot, serverBorn: readonly ServerBorn[] = []): SeenMilestone[] {
  const { config, pulls, featureLink } = snapshot;
  if (!config) return [];
  const repository = snapshot.repository.toLowerCase();
  const seen: SeenMilestone[] = [];
  const add = (prd: PrdNumber, dated: readonly Dated[]) => {
    for (const [milestone, pr, at] of dated) {
      if (at === null) continue;
      seen.push({ repository, prd, lane: repository, milestone, pr: PRD_MILESTONES.includes(milestone) ? null : pr, reached_at: at });
    }
  };

  const approvals = new Map(serverBorn.map(({ prd, approved_at }) => [prd, approved_at]));
  for (const { prd, topic } of foldersOf(snapshot)) {
    const phase0 = branchPattern(config.branches.phase0, topic);
    const merged0 = pulls.filter(isMerged).filter((p) => phase0.test(p.head)).sort(byMerge)[0]?.merged_at ?? null;
    const approval = approvals.get(prd);
    const feature = config.branches.feature.replace('{topic}', topic);
    add(prd, [['approved', null, approval === undefined ? merged0 : approval], ...laneOf(pulls, feature, leadOf(pulls.filter((p) => p.head === feature)))]);
    approvals.delete(prd);
  }

  // A ◆ PRD whose folder is on its feature branch only: its feature PR names it.
  const featureShape = anyTopic(config.branches.feature);
  for (const [prd, approved] of approvals) {
    const link = featureLink === undefined ? null : linkPattern(featureLink, prd);
    const lead = link ? leadOf(pulls.filter((p) => featureShape.test(p.head) && link.test(p.body ?? ''))) : null;
    add(prd, [['approved', null, approved], ...(lead ? laneOf(pulls, lead.head, lead) : [])]);
  }
  return seen;
}

/** The lanes the repository is for other repositories' PRDs (PRD 2370, s4): one per plan PRD its feature
 * PRs into the default branch name (`Part of <owner/repo>#<n>`), the merged one, else the earliest still
 * open; nothing without a config. */
export function targetMilestones(snapshot: RepoSnapshot): SeenMilestone[] {
  const { config, pulls } = snapshot;
  if (!config) return [];
  const lane = snapshot.repository.toLowerCase();
  const claims = new Map<string, { repository: string; prd: PrdNumber; pulls: SnapshotPull[] }>();
  for (const pull of pulls) {
    const named = pull.base === config.defaultBranch ? planPrdOf(pull.body, lane) : null;
    if (named === null) continue;
    const key = `${named.repository}#${String(named.prd)}`;
    const claim = claims.get(key) ?? { ...named, pulls: [] };
    claim.pulls.push(pull);
    claims.set(key, claim);
  }
  return [...claims.values()].flatMap(({ repository, prd, pulls: candidates }) => {
    const lead = leadOf(candidates);
    if (lead === null) return [];
    return laneOf(pulls, lead.head, lead).flatMap(([milestone, pr, at]) =>
      at === null ? [] : [{ repository, prd, lane, milestone, pr, reached_at: at }]);
  });
}

/** The `idea` and `plan` milestones of the repository's PRDs, from their dossiers' times (PRD 2370, s3): the PRD's own lane, no pull request, nothing for a plan not yet written. */
export function dossierMilestones(repository: string, dossiers: readonly DossierTimes[]): SeenMilestone[] {
  const repo = repository.toLowerCase();
  return dossiers.flatMap(({ prd, opened_at, plan_at }): SeenMilestone[] => [
    { repository: repo, prd, lane: repo, milestone: 'idea', pr: null, reached_at: opened_at },
    ...(plan_at === null ? [] : [{ repository: repo, prd, lane: repo, milestone: 'plan' as const, pr: null, reached_at: plan_at }]),
  ]);
}
