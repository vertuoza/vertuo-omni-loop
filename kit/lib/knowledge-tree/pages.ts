/**
 * **The knowledge tree's pages, over files handed in** (PRD 2419, s1). The tech side of the tree
 * (`./levels.ts`, PRD 2416) read page by page, for a reader that holds a repository's files in memory
 * rather than on disk: the Omni page, which reads each repository's newest knowledge pack.
 *
 * Each level is handed in as a {@link LevelSource}: its playbook pages (each by its form, with the
 * file it is read from), its decision records, and its repository's law owners. A knowledge pack
 * reads as one through {@link packLevel}. {@link treePages} then resolves, bottom-up:
 *
 * - **each page** (one per form of the kit, in the kit's order) from the lowest level that holds it
 *   filled: the repository (its page `filled`, or a `pointer` to its own file), else its plan
 *   repository (`filled`), else the Omni settings (`filled`), else the `kit default`. A page that does
 *   not parse is skipped and named in `problems`, and the next level is read.
 * - **each decision record** (`NNNN-<slug>.md`, directly in a level's records folder): the
 *   repository's own in number order, then each level's whose number nothing nearer holds, as
 *   `omni kb show decisions` reads them (`../playbook/decisions.ts`).
 * - **each one's owner** (spec Q3): the page's `owner:` line, else the law owners of the repository
 *   its level is read from; a kit default is the repository's to write, so its law owners own it. A
 *   decision record carries no owner line: its level's law owners own it.
 *
 * It imports nothing that reads the disk, so an app bundler takes it; `./levels.ts` (which finds the
 * local copies on disk) is read for its types only.
 */
import { CONFIG_FILE, lawOwnerParts, parseConfig } from '../config.ts';
import { messageOf } from '../narrow.ts';
import { readSettingsPage } from '../omni-settings/page.ts';
import { DECISIONS_FORM, FORM_IDS, parseForm } from '../playbook/forms.ts';
import type { Level } from './levels.ts';

/** One file of a repository, by its repository path. */
export type TreeFile = { path: string; content: string };

/** A level a page or record is read from above the kit's defaults. */
export type SourceLevel = Exclude<Level, 'kit default'>;

/** One level of the tree as handed in: its pages, its records and its repository's law owners. */
export type LevelSource = {
  pages: readonly { form: string; file: string; text: string }[];
  records: readonly { file: string; text: string }[];
  lawOwners: readonly string[];
};

/** The levels handed in: the repository's, and each level above it, `null` when it has none. */
export type TreeLevels = { repo: LevelSource } & Record<Exclude<SourceLevel, 'repo'>, LevelSource | null>;

/** One playbook page, resolved: its level, the file it is read from (`null`: the kit default), its
 * title (its `# ` heading, `null` for the kit default) and who approves a change to it. */
export type TreePage = { form: string; level: Level; file: string | null; title: string | null; owners: string[] };

/** One decision record: its number, its file, its title (`null` with no `# ` heading), its level and its owners. */
export type TreeRecord = { number: string; file: string; title: string | null; level: SourceLevel; owners: string[] };

/** A repository's playbook and decision records, through the tree, and each file skipped with why. */
export type TreePagesRead = { pages: TreePage[]; records: TreeRecord[]; problems: string[] };

/** The levels above the kit's defaults, bottom-up. */
const SOURCE_LEVELS: readonly SourceLevel[] = ['repo', 'plan repo', 'omni settings'];

/** A repository's config, as the kit parses it. */
type Config = ReturnType<typeof parseConfig>;

const RECORD = /^(\d{4})-.+\.md$/;
const TITLE = /^#\s+(.+?)\s*$/m;

/** The kit's own config: the paths a pack with no readable config is read by. */
const KIT_CONFIG = parseConfig(`kit: 1\n`);

/** The folder a path lies in, `''` at the root. */
const folderOf = (path: string): string => path.slice(0, Math.max(0, path.lastIndexOf('/')));

/** A folder path with no trailing slash. */
const trimmed = (path: string): string => path.replace(/\/+$/, '');

/** The law owners' logins a config names, each once. */
const lawOwnersOf = (config: Config): string[] => [...new Set(config.laws.owners.map((entry) => lawOwnerParts(entry).owner))];

/** The pack's config, or the kit's own with the line saying why the pack's was not read. */
function configOf(files: readonly TreeFile[]): { config: Config; problem: string | null } {
  const file = files.find((entry) => entry.path === CONFIG_FILE);
  if (!file) return { config: KIT_CONFIG, problem: `${CONFIG_FILE}: not in the knowledge pack` };
  try {
    return { config: parseConfig(file.content, CONFIG_FILE, { ignoreUnknownKeys: true }), problem: null };
  } catch (error) {
    return { config: KIT_CONFIG, problem: messageOf(error).split('\n')[0] ?? CONFIG_FILE };
  }
}

/**
 * A knowledge pack's files read as one level of the tree: its pages and records where its config
 * puts them (the decisions form beside the records, under the playbook's parent folder, as the
 * layout reads it), and its law owners. A pack with no config, or one that does not parse, is read
 * with the kit's paths and no law owner, and `problems` says so.
 */
export function packLevel(files: readonly TreeFile[]): { level: LevelSource; problems: string[] } {
  const { config, problem } = configOf(files);
  const playbook = trimmed(config.paths.playbook);
  const adr = trimmed(config.paths.adr);
  const where = (form: string) => (form === DECISIONS_FORM ? `${folderOf(playbook)}/adr/README.md` : `${playbook}/${form}.md`);
  const byPath = new Map(files.map((file) => [file.path, file.content]));
  const pages = FORM_IDS.flatMap((form) => {
    const file = where(form);
    const text = byPath.get(file);
    return text === undefined ? [] : [{ form, file, text }];
  });
  const records = files
    .filter((file) => folderOf(file.path) === adr && RECORD.test(file.path.slice(adr.length + 1)))
    .map((file) => ({ file: file.path, text: file.content }));
  return { level: { pages, records, lawOwners: lawOwnersOf(config) }, problems: problem === null ? [] : [problem] };
}

/** Whether a page in `state` answers for `level`: a level above the repository answers only filled. */
const answers = (level: SourceLevel, state: string): boolean => state === 'filled' || (level === 'repo' && state === 'pointer');

/** The page `form` of `source`, read as `level`, or `null` when it holds none that answers. */
function pageAt(form: string, level: SourceLevel, source: LevelSource, problems: string[]): TreePage | null {
  const held = source.pages.find((entry) => entry.form === form);
  if (!held) return null;
  const read = readSettingsPage({ form, text: held.text });
  if (!read.ok) {
    problems.push(`${held.file}: ${read.reason}`);
    return null;
  }
  const parsed = parseForm(read.page.text); // it parses: readSettingsPage read it so
  if (!parsed.ok || !answers(level, parsed.form.state)) return null;
  return { form, level, file: held.file, title: parsed.form.title, owners: read.page.owners ?? [...source.lawOwners] };
}

/** The levels handed in, bottom-up, each with its source. */
const presentLevels = (levels: TreeLevels): { level: SourceLevel; source: LevelSource }[] =>
  SOURCE_LEVELS.flatMap((level) => {
    const source = levels[level];
    return source === null ? [] : [{ level, source }];
  });

/** The records of one level, in number order (a shared number's files by path). */
function recordsAt(level: SourceLevel, source: LevelSource): TreeRecord[] {
  return [...source.records]
    .sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0))
    .map((record) => ({
      number: RECORD.exec(record.file.slice(record.file.lastIndexOf('/') + 1))?.[1] ?? '',
      file: record.file,
      title: TITLE.exec(record.text)?.[1] ?? null,
      level,
      owners: [...source.lawOwners],
    }));
}

/** A repository's playbook pages and decision records, resolved through the levels handed in. */
export function treePages(levels: TreeLevels): TreePagesRead {
  const problems: string[] = [];
  const present = presentLevels(levels);
  const pages = FORM_IDS.map((form): TreePage => {
    for (const { level, source } of present) {
      const found = pageAt(form, level, source, problems);
      if (found) return found;
    }
    return { form, level: 'kit default', file: null, title: null, owners: [...levels.repo.lawOwners] };
  });
  const held = new Set<string>();
  const records = present.flatMap(({ level, source }) => {
    const own = recordsAt(level, source);
    const kept = level === 'repo' ? own : own.filter((record) => !held.has(record.number));
    for (const record of own) held.add(record.number);
    return kept;
  });
  return { pages, records, problems };
}
