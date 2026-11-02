import { CONFIG_FILE, parseConfig } from 'omni-loop/kit/lib/config.ts';
import { MEANING_MAX } from './found-domains';

// The folders one knowledge pack holds (PRD 2583 s3). Pure over the pack's files, but it reads the kit's
// config, whose module needs the file system: only the server imports this.
//
// - **What counts:** a folder directly under `<knowledge root>/domains/`, the root read from the pack's own
//   config (`paths.knowledge`), `.omni-loop/knowledge` when it holds none. A plan repository's imported
//   copies, under `repos/<target>/domains/`, are another repository's folders and never count; a file
//   directly under `domains/` is no folder.

/** A pack file, by its repository path. */
export interface PackFile {
  path: string;
  content: string;
}

/** The kit's own knowledge root: what a pack with no config, or none that reads, is read by. */
const DEFAULT_ROOT = parseConfig('kit: 1\n').paths.knowledge.replace(/\/+$/, '');

/** The knowledge root a pack's own config names, or the kit's. */
export function knowledgeRootOf(files: readonly PackFile[]): string {
  const config = files.find((file) => file.path === CONFIG_FILE);
  if (config === undefined) return DEFAULT_ROOT;
  try {
    return parseConfig(config.content, CONFIG_FILE, { ignoreUnknownKeys: true }).paths.knowledge.replace(/\/+$/, '');
  } catch {
    return DEFAULT_ROOT;
  }
}

/** The first paragraph of a README that is no heading, on one line and within a meaning's length; '' when it has none. */
function meaningOf(readme: string): string {
  const paragraph = readme.split(/\n\s*\n/).map((p) => p.trim()).find((p) => p !== '' && !p.startsWith('#'));
  return (paragraph ?? '').replace(/\s+/g, ' ').slice(0, MEANING_MAX);
}

/** The folders of a pack, each with what its README says first (''): directly under `<root>/domains/`, in name order. */
export function foldersOf(files: readonly PackFile[]): Map<string, string> {
  const prefix = `${knowledgeRootOf(files)}/domains/`;
  const found = new Map<string, string>();
  for (const { path, content } of files) {
    if (!path.startsWith(prefix)) continue;
    const [name, ...rest] = path.slice(prefix.length).split('/');
    if (name === undefined || name === '' || rest.length === 0) continue;
    if (rest.length === 1 && rest[0] === 'README.md') found.set(name, meaningOf(content));
    else if (!found.has(name)) found.set(name, '');
  }
  return new Map([...found].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}
