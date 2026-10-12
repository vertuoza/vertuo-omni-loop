// The stages sync's core (PRD 587, s2): what one repository shows, as a snapshot read from GitHub (its
// `.omni-loop` config, the PRD folders in `inbox/` and `shipped/` on its default branch, its `labels.prd`
// issues and its pull requests), turned into the stages each PRD reached and the topic of each folder.
// Pure: the reader (./github.ts) fills the snapshot, the route (./sync.ts) records what comes out.
//
// Every stage is dated by its own event: an issue's creation (PRD), the phase-0 PR's merge (inbox), the
// first slice PR merged into the feature branch (building), the feature PR's ready time (outbox), its
// merge (shipped) and the retro PR's creation (retro). A folder's place is the repository's truth: a
// folder in `inbox/` or `shipped/` whose PR is not found is recorded at the sync's time. No branch name,
// path or label is written here: each comes from the repository's own config.
//
// PRD 1299 (s6): a PRD born on the server (◆) has no phase-0 PR, and its folder stays on its feature
// branch until it ships. Its inbox is dated at its first approval, read from the database beside the
// snapshot, never at a phase-0 merge nor at the sync's time; while it waits for approval it has no
// inbox. Every stage after inbox is read from GitHub as for any PRD.
import { parseConfig } from 'vertuo-omni-plan/kit/lib/config.ts';
import { parseFolderName } from 'vertuo-omni-plan/kit/lib/layout.ts';
import type { StoredStage } from '../stage';
import type { PrdNumber, PrNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import type { Config } from 'vertuo-omni-plan/kit/lib/types.ts';

const CONFIG_PATH = '.omni-loop/config.yml';

/** What the sync needs of a repository's config. */
export type SyncConfig = {
  defaultBranch: string;
  delivery: string;
  prdLabel: string;
  branches: Pick<Config['branches'], 'phase0' | 'slice' | 'feature' | 'retro'>;
};

/** A pull request as the sync reads it. `ready_at` is when it was last marked ready for review; null
 * when it never was (opened ready, or still a draft). */
export type SnapshotPull = {
  number: PrNumber;
  head: string;
  base: string;
  state: 'open' | 'closed';
  draft: boolean;
  merged_at: string | null;
  created_at: string;
  ready_at: string | null;
};

/** A `labels.prd` issue: its number and when it was opened. */
export type SnapshotIssue = { number: PrdNumber; created_at: string };

/** One repository as GitHub shows it; `config` null when it carries no `.omni-loop` config. */
export type RepoSnapshot = {
  repository: string;
  config: SyncConfig | null;
  inbox: string[];
  shipped: string[];
  issues: SnapshotIssue[];
  pulls: SnapshotPull[];
};

/** A stage seen, without its workspace: the route adds it. */
export type SeenStage = { repository: string; prd: PrdNumber; stage: StoredStage; reached_at: string };
export type SeenTopic = { repository: string; prd: PrdNumber; topic: string };

/** A PRD of the repository born on the server (◆), and when it was first approved; null while it waits. */
export type ServerBorn = { prd: PrdNumber; approved_at: string | null };

/** The sync's reading of a repository's config. Throws, naming the repository, when it is not valid. */
export function syncConfig(text: string, repository: string): SyncConfig {
  const config = parseConfig(text, `${repository}:${CONFIG_PATH}`);
  return {
    defaultBranch: config.repo.defaultBranch,
    delivery: config.paths.delivery.replace(/^\.\/+/, '').replace(/\/+$/, ''),
    prdLabel: config.labels.prd,
    branches: { phase0: config.branches.phase0, slice: config.branches.slice, feature: config.branches.feature, retro: config.branches.retro },
  };
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A branch shape as a pattern: `{topic}` is the topic given, any other placeholder one path segment. */
function branchPattern(shape: string, topic: string): RegExp {
  const parts = shape.split(/(\{\w+\})/).map((part) => {
    if (part === '{topic}') return escape(topic);
    return /^\{\w+\}$/.test(part) ? '[^/]+' : escape(part);
  });
  return new RegExp(`^${parts.join('')}$`);
}

const earliest = (dates: readonly (string | null)[]): string | null =>
  dates.filter((d): d is string => d !== null).sort((a, b) => Date.parse(a) - Date.parse(b))[0] ?? null;

const counted = (pull: SnapshotPull) => pull.state === 'open' || pull.merged_at !== null;

type Folder = { prd: PrdNumber; topic: string; place: 'inbox' | 'shipped' };

/** Each PRD's folder, the first one found (inbox before shipped), in PRD order. */
function foldersOf(snapshot: RepoSnapshot): Folder[] {
  const folders = new Map<PrdNumber, Folder>();
  for (const [place, names] of [['inbox', snapshot.inbox], ['shipped', snapshot.shipped]] as const) {
    for (const name of names) {
      const parsed = parseFolderName(name);
      if (!parsed) continue;
      const { prd } = parsed;
      if (!folders.has(prd)) folders.set(prd, { prd, topic: parsed.topic, place });
    }
  }
  return [...folders.values()].sort((a, b) => a.prd - b.prd);
}

/** The stages a folder's pull requests date, in track order; null for a stage not reached. `approval` is
 * given for a ◆ PRD only: its inbox is that date, null while it waits. */
function folderStages(
  config: SyncConfig, pulls: readonly SnapshotPull[], { topic, place }: Folder, syncedAt: string, approval?: string | null,
): [StoredStage, string | null][] {
  const on = (shape: string) => {
    const pattern = branchPattern(shape, topic);
    return pulls.filter((p) => pattern.test(p.head));
  };
  const feature = config.branches.feature.replace('{topic}', topic);
  const phase0 = earliest(on(config.branches.phase0).map((p) => p.merged_at));
  const building = earliest(on(config.branches.slice).filter((p) => p.base === feature).map((p) => p.merged_at));
  const features = on(config.branches.feature);
  const ready = earliest(features.filter((p) => p.state === 'open' && !p.draft).map((p) => p.ready_at ?? p.created_at));
  const mergedFeature = earliest(features.map((p) => p.merged_at));
  const retro = earliest(on(config.branches.retro).filter(counted).map((p) => p.created_at));
  return [
    ['inbox', approval === undefined ? phase0 ?? (place === 'inbox' ? syncedAt : null) : approval],
    ['building', building],
    ['outbox', ready],
    ['shipped', place === 'shipped' ? mergedFeature ?? syncedAt : null],
    ['retro', retro],
  ];
}

/** The PRDs whose GitHub the snapshot saw move (PRD 902, s4): each issue read, and each folder that a pull
 * request read belongs to by its topic (its phase-0, slice, feature or retro branch), in PRD order. Read
 * since the last sync, these are the PRDs that changed; nothing without a config. */
export function changedPrds(snapshot: RepoSnapshot): PrdNumber[] {
  const { config } = snapshot;
  if (!config) return [];
  const changed = new Set<PrdNumber>(snapshot.issues.map((issue) => issue.number));
  const shapes = [config.branches.phase0, config.branches.slice, config.branches.feature, config.branches.retro];
  for (const { prd, topic } of foldersOf(snapshot)) {
    const patterns = shapes.map((shape) => branchPattern(shape, topic));
    if (snapshot.pulls.some((pull) => patterns.some((pattern) => pattern.test(pull.head)))) changed.add(prd);
  }
  return [...changed].sort((a, b) => a - b);
}

/** Every stage and topic the repository shows, `serverBorn` naming its ◆ PRDs; nothing without a config. */
export function stagesOfRepo(
  snapshot: RepoSnapshot, syncedAt: string, serverBorn: readonly ServerBorn[] = [],
): { stages: SeenStage[]; topics: SeenTopic[] } {
  const { config } = snapshot;
  if (!config) return { stages: [], topics: [] };
  const repository = snapshot.repository.toLowerCase();
  const stages: SeenStage[] = [];
  const seen = (prd: PrdNumber, stage: StoredStage, reached_at: string | null) => {
    if (reached_at !== null) stages.push({ repository, prd, stage, reached_at });
  };

  for (const issue of snapshot.issues) seen(issue.number, 'prd', issue.created_at);
  const approvals = new Map(serverBorn.map(({ prd, approved_at }) => [prd, approved_at]));
  const folders = foldersOf(snapshot);
  for (const folder of folders) {
    for (const [stage, at] of folderStages(config, snapshot.pulls, folder, syncedAt, approvals.get(folder.prd))) seen(folder.prd, stage, at);
    approvals.delete(folder.prd);
  }
  // A ◆ PRD whose folder is on its feature branch only: its approval is all the sync sees of it.
  for (const [prd, at] of approvals) seen(prd, 'inbox', at);
  return { stages, topics: folders.map(({ prd, topic }) => ({ repository, prd, topic })) };
}
