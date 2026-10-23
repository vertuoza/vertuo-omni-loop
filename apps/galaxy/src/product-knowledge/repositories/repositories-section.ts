import type { Level } from 'omni-loop/kit/lib/knowledge-tree/levels.ts';
import { packLevel, treePages, type LevelSource, type TreeFile, type TreePage, type TreeRecord } from 'omni-loop/kit/lib/knowledge-tree/pages.ts';

// The Repositories section of the Knowledge home (PRD 2419 s1), its model: for each repository of the
// product, its playbook pages and decision records read from its newest knowledge pack, through the
// knowledge tree (kit/lib/knowledge-tree/pages.ts, PRD 2416's order): each marked with the level it is
// read from (the repository, its plan repository, the Omni settings, the kit default), the repository
// that level is, and its owner. A repository with no pack says so, with how one is made. Pure.
//
// - The plan repository's newest pack is the plan repository level of every repository but itself.
// - The Omni settings level is handed in (PRD 2417's read of the workspace's settings repository), or
//   none: the pages then read the kit default.

/** A repository's newest knowledge pack, as read: its commit, when that commit was made, its files. */
export interface RepositoryPack {
  sha: string;
  committedAt: string;
  files: TreeFile[];
}

/** The Omni settings level, as read from the workspace's settings repository. */
export interface SettingsLevel {
  repository: string;
  level: LevelSource;
}

/** What the section is drawn from: the product's repositories, its plan repository, each one's pack. */
export interface RepositoriesInput {
  product: string;
  repositories: readonly string[];
  plan: string | null;
  /** Each repository's newest pack, by owner/name; a repository absent or null has none. */
  packs: ReadonlyMap<string, RepositoryPack | null>;
  settings: SettingsLevel | null;
}

/** A page or record as the section shows it: the repository its level is (null for the kit default). */
export type ShownPage = TreePage & { from: string | null };
export type ShownRecord = TreeRecord & { from: string };

/** One repository of the product, with its pack read through the tree, or none. */
export type RepositoryKnowledge =
  | { repository: string; pack: null }
  | { repository: string; pack: { sha: string; committedAt: string }; pages: ShownPage[]; records: ShownRecord[]; problems: string[] };

export interface RepositoriesData {
  product: string;
  repositories: RepositoryKnowledge[];
}

/** Each level as the section names it. */
export const LEVEL_LABELS: Readonly<Record<Level, string>> = {
  repo: 'Repository',
  'plan repo': 'Plan repository',
  'omni settings': 'Omni settings',
  'kit default': 'Kit default',
};

export const LEDE = 'How agents work in each repository of the product: every playbook page and decision record, the level it is read from, and who owns it.';
export const NO_REPOSITORY = 'No repository in this product yet.';

/** What a repository with no pack says: none yet, and how the Omni app makes one. */
export const noPackLine = (repository: string): string =>
  `No knowledge pack of ${repository} yet. The Omni app makes one when a merge into ${repository} touches its knowledge folder or its flow config (.omni-loop/config.yml).`;

const byName = (a: string, b: string) => a.localeCompare(b);

/** The repository each level is, for one repository of the product. */
type Origins = Readonly<Record<Exclude<Level, 'kit default'>, string>>;

/** The plan repository level of `repository`: its plan repository's pack, none for the plan repository itself. */
function planLevelOf(repository: string, { plan, packs }: RepositoriesInput): LevelSource | null {
  const pack = plan === null || plan === repository ? null : packs.get(plan);
  return pack ? packLevel(pack.files).level : null;
}

/** One repository through the tree, its plan repository's pack and the Omni settings above it. */
function knowledgeOf(repository: string, input: RepositoriesInput): RepositoryKnowledge {
  const pack = input.packs.get(repository);
  if (!pack) return { repository, pack: null };
  const own = packLevel(pack.files);
  const settings = input.settings;
  const tree = treePages({ repo: own.level, 'plan repo': planLevelOf(repository, input), 'omni settings': settings?.level ?? null });
  const origins: Origins = { repo: repository, 'plan repo': input.plan ?? '', 'omni settings': settings?.repository ?? '' };
  return {
    repository,
    pack: { sha: pack.sha, committedAt: pack.committedAt },
    pages: tree.pages.map((page) => ({ ...page, from: page.level === 'kit default' ? null : origins[page.level] })),
    records: tree.records.map((record) => ({ ...record, from: origins[record.level] })),
    problems: [...own.problems, ...tree.problems],
  };
}

/** One repository's newest pack as the caller reads it: the pack, none, or a read that failed. */
export type PackRead = (repository: string) => Promise<{ ok: true; pack: RepositoryPack | null } | { ok: false }>;

/** The newest pack of each of `repositories` (each read once), or null when one cannot be read. */
export async function readPacks(repositories: readonly string[], read: PackRead): Promise<Map<string, RepositoryPack | null> | null> {
  const names = [...new Set(repositories)];
  const answers = await Promise.all(names.map(async (name) => [name, await read(name)] as const));
  const packs = new Map<string, RepositoryPack | null>();
  for (const [name, answer] of answers) {
    if (!answer.ok) return null;
    packs.set(name, answer.pack);
  }
  return packs;
}

/** What the section's read asks: the product's repositories (null: unreadable) and each one's pack. */
export interface RepositoriesReads {
  held: () => Promise<{ plan: string | null; repositories: string[] } | null>;
  pack: PackRead;
  settings: SettingsLevel | null;
}

/** The section for `product` from its reads, or why it is not: what could not be read. */
export async function readRepositories(product: string, reads: RepositoriesReads): Promise<{ ok: true; data: RepositoriesData } | { ok: false; unread: string }> {
  const held = await reads.held();
  if (held === null) return { ok: false, unread: `the repositories of ${product}` };
  const packs = await readPacks([...held.repositories, ...(held.plan === null ? [] : [held.plan])], reads.pack);
  if (packs === null) return { ok: false, unread: `a knowledge pack of ${product}` };
  return { ok: true, data: repositoriesSection({ product, repositories: held.repositories, plan: held.plan, packs, settings: reads.settings }) };
}

/** The section: each repository of the product by name, read through the tree. */
export function repositoriesSection(input: RepositoriesInput): RepositoriesData {
  const repositories = [...new Set(input.repositories)].sort(byName);
  return { product: input.product, repositories: repositories.map((repository) => knowledgeOf(repository, input)) };
}

/** A commit as the section names it: its first seven characters. */
export const shortSha = (sha: string): string => sha.slice(0, 7);

/** Owners as a cell shows them: `@a, @b`, or a dash when nobody is named. */
export const ownersLine = (owners: readonly string[]): string => (owners.length === 0 ? '—' : owners.map((login) => `@${login}`).join(', '));
