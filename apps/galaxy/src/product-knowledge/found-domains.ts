// The folders of a product's repositories that its list of domains does not hold (PRD 2583 s3): which of
// them cannot be a key, and the sub-menu's line. Nothing blocks: this only shows what is there. Pure, and
// read in the browser too, so it imports nothing of the kit: reading a pack is found-domains-pack.ts.
//
// - **Not on the list:** a folder whose name is no key of the list, retired ones apart.

/** What a domain's key is made of, and how long it may be: the database's own rule. */
const KEY = /^[a-z][a-z0-9-]*$/;
const KEY_MAX = 60;
const NAME_MAX = 80;
export const MEANING_MAX = 400;

/** Whether a folder's name can be a domain's key. */
export const canBeKey = (name: string): boolean => name.length <= KEY_MAX && KEY.test(name);

/** One repository's folders: by name, with their meaning; null when it has no pack yet. */
export interface RepositoryFolders {
  repository: string;
  folders: ReadonlyMap<string, string> | null;
}

/** A folder the list does not hold, with the repositories that hold it. */
export interface FolderRow {
  name: string;
  repositories: string[];
  canBeKey: boolean;
  /** What a README says first, '' when none of its repositories has one. */
  meaning: string;
}

/** What the Domains section's Not on the list region shows. */
export interface FoundDomains {
  /** Folders no domain of the list names, in name order. */
  off: FolderRow[];
  /** Folders that name a retired domain: a key is never reused, so none is offered. */
  retired: { key: string; repositories: string[] }[];
  /** Repositories with no pack yet. */
  notRead: string[];
  /** How many folders are off the list: retired and not-read ones are not counted. */
  count: number;
}

const byName = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** The folders of `repos` the `listed` domains do not hold. */
export function foundDomains(listed: readonly { key: string; retiredAt: string | null }[], repos: readonly RepositoryFolders[]): FoundDomains {
  const active = new Set(listed.filter((d) => d.retiredAt === null).map((d) => d.key));
  const retired = new Set(listed.filter((d) => d.retiredAt !== null).map((d) => d.key));
  const held = new Map<string, { repositories: string[]; meaning: string }>();
  const notRead: string[] = [];
  for (const { repository, folders } of repos) {
    if (folders === null) {
      if (!notRead.includes(repository)) notRead.push(repository);
      continue;
    }
    for (const [name, meaning] of folders) {
      const at = held.get(name) ?? { repositories: [], meaning: '' };
      if (!at.repositories.includes(repository)) at.repositories.push(repository);
      if (at.meaning === '') at.meaning = meaning;
      held.set(name, at);
    }
  }
  const names = [...held.keys()].sort(byName);
  const off = names.filter((name) => !active.has(name) && !retired.has(name)).map((name) => {
    const at = held.get(name);
    return { name, repositories: [...(at?.repositories ?? [])].sort(byName), canBeKey: canBeKey(name), meaning: at?.meaning ?? '' };
  });
  return {
    off,
    retired: names.filter((name) => retired.has(name)).map((key) => ({ key, repositories: [...(held.get(key)?.repositories ?? [])].sort(byName) })),
    notRead: notRead.sort(byName),
    count: off.length,
  };
}

/** `stock-levels` as a name: `Stock levels`, within a name's length. */
const nameOf = (folder: string): string => {
  const words = folder.replace(/-+/g, ' ').trim();
  return (words.charAt(0).toUpperCase() + words.slice(1)).slice(0, NAME_MAX);
};

/** The fields adding a folder sends: its key, a name from its words, its README's first paragraph or where it was found. */
export function adoptFields(row: FolderRow): { key: string; name: string; meaning: string } {
  const meaning = row.meaning !== '' ? row.meaning : `Found as the folder domains/${row.name} in ${row.repositories.join(', ')}.`;
  return { key: row.name, name: nameOf(row.name), meaning: meaning.slice(0, MEANING_MAX) };
}

/** The Domains entry of the sub-menu when folders are off the list (`Domains 6 · 2 not on the list`); null otherwise. */
export const notOnListLabel = (active: number, off: number | null): string | null =>
  off === null || off <= 0 ? null : `Domains ${active} · ${off} not on the list`;
