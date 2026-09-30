import { parseFolderName } from 'vertuo-omni-plan/kit/lib/layout.mjs';

// What a draft reads in one repository (PRD 774, spec step 1 and decision 3): its README.md, its
// top-level docs/*.md and, only when it has the kit layout (a `.omni-loop/config.yml` naming the
// delivery folder), the specs of the ten most recently shipped PRDs, the highest numbers first. Twelve
// files per repository at most, taken in that order: the README, the docs by name, then the specs.
// And how each source a draft read or skipped is named on the page. Pure: ./github.ts reads the listing.

/** The most files read in one repository. */
export const MAX_FILES_PER_REPO = 12;
/** The most shipped PRD specs read in one repository. */
export const MAX_SPECS = 10;

/** What a repository holds, as far as a draft needs to know. */
export interface RepoListing {
  /** The names of the files at its root. */
  root: string[];
  /** The names of the files in its top-level `docs/`, none when it has no such folder. */
  docs: string[];
  /** The kit layout's delivery folder, or null when the repository has no kit layout. */
  delivery: string | null;
  /** The folder names in `<delivery>/shipped`. */
  shipped: string[];
}

export type FileKind = 'readme' | 'doc' | 'prd';

/** One file to read, by its path from the repository's root. */
export interface RepoFile {
  path: string;
  kind: FileKind;
}

const byName = (a: string, b: string) => a.localeCompare(b, 'en');

/** The files a draft reads in a repository, in order, twelve at most. */
export function repoFiles(listing: RepoListing): RepoFile[] {
  const files: RepoFile[] = [];
  const readme = listing.root.find((name) => /^readme\.md$/i.test(name));
  if (readme) files.push({ path: readme, kind: 'readme' });
  for (const name of listing.docs.filter((n) => /\.md$/i.test(n)).sort(byName)) files.push({ path: `docs/${name}`, kind: 'doc' });
  if (listing.delivery !== null) {
    const shipped = listing.shipped
      .map((name) => ({ name, parsed: parseFolderName(name) as { prd: number } | null }))
      .filter((f): f is { name: string; parsed: { prd: number } } => f.parsed !== null)
      .sort((a, b) => b.parsed.prd - a.parsed.prd)
      .slice(0, MAX_SPECS);
    for (const { name } of shipped) files.push({ path: `${listing.delivery}/shipped/${name}/spec.md`, kind: 'prd' });
  }
  return files.slice(0, MAX_FILES_PER_REPO);
}

/** A repository file as the page names it: `vertuo-app · README.md`. */
export const fileLabel = (repository: string, path: string) => `${repository.split('/').pop()} · ${path}`;

/** A web page as the page names it: `vertuoza.com/pricing`. */
export const pageLabel = (url: string) => url.replace(/^https:\/\//i, '').replace(/\/$/, '');

/** Where a receipt says a repository file's quote is: `owner/name/path`. */
export const fileWhere = (repository: string, path: string) => `${repository}/${path}`;
