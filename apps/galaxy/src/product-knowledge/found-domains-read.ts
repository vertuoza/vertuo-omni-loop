import type { RepositoryFolders } from './found-domains';
import { foldersOf, type PackFile } from './found-domains-pack';

// How Not on the list reads (PRD 2583 s3), over ports it is given: the product's repositories and plan
// repository, then the newest pack of each, once. A repository with no pack is `folders: null` (not read
// yet); a read that fails, or a product that cannot be read, is null for the whole. Pure over its ports.

/** What the product holds of repositories: null when it cannot be read. */
export type HeldRepositories = { plan: string | null; repositories: readonly string[] } | null;

/** A repository's newest pack as the caller reads it: its files, none, or a read that failed. */
export type PackFiles = (repository: string) => Promise<{ ok: true; files: readonly PackFile[] | null } | { ok: false }>;

/** The repositories to read: the product's, then its plan repository, each once. */
export const repositoriesToRead = (held: NonNullable<HeldRepositories>): string[] => [
  ...new Set([...held.repositories, ...(held.plan === null ? [] : [held.plan])]),
];

/** The folders of every repository of the product and of its plan repository; null when anything could not be read. */
export async function readRepositoryFolders(held: () => Promise<HeldRepositories>, pack: PackFiles): Promise<RepositoryFolders[] | null> {
  const holding = await held();
  if (holding === null) return null;
  const read = await Promise.all(repositoriesToRead(holding).map(async (repository) => ({ repository, answer: await pack(repository) })));
  const folders: RepositoryFolders[] = [];
  for (const { repository, answer } of read) {
    if (!answer.ok) return null;
    folders.push({ repository, folders: answer.files === null ? null : foldersOf(answer.files) });
  }
  return folders;
}
