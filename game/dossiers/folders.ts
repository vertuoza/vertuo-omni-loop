// The fallback's pure parts (PRD 216, spec › The fallback): a repository's dossier switch read from its
// own config, one tree listing read as PRD folders, a spec's title, and the hash git gives a file.
// Reads no file and calls nothing: game/dossiers/github.ts fetches, game/dossiers/sync.ts decides.
//
// The game never imports the kit (README: delete game/ and the delivery layer is untouched), so the
// rules the kit already holds are mirrored here, and must stay the same as the kit's:
//   - the switch: `dossier.enabled` is true and `ask.url` is set (kit/lib/config.ts › dossierSwitch);
//   - a PRD folder: `<delivery>/{inbox,shipped}/<nnnn>-<topic>/`, the inbox before shipped and the
//     first name before the next (kit/lib/layout.ts);
//   - the title: the spec's front matter `title:`, quotes stripped, else the topic, cut to 200
//     characters (kit/lib/dossier/folder.ts);
//   - a fix's folder (PRD 627): `<delivery>/visual/<nnnn>-<slug>/` gives its `before-after.html` and each
//     `variations-r<k>.html` (a round each, in numeric order), `<delivery>/bugs/<nnnn>-<slug>/` its
//     `bug.md`; the first name is read; the title is the issue's without `Visual: ` or `Bug: `, else the
//     topic (kit/lib/dossier/folder.ts › readFixFolder, fixTitle).
import { createHash } from 'node:crypto';
import { parse } from 'yaml';
import { z } from 'zod';

/** One entry of a recursive tree listing. */
export type TreeEntry = { path: string; type: string; sha: string; size?: number | undefined; mode?: string };
/** A PRD folder's file, as its dossier takes it. */
export type TreeFile = { kind: 'spec' | 'plan' | 'before-after'; path: string; sha: string; size: number };
/** A PRD folder on the default branch. */
export type PrdFolder = { prd: number; topic: string; dir: string; files: TreeFile[] };
/** A fix's file, as its dossier takes it. */
export type FixFile = { kind: 'before-after' | 'variations' | 'bug-record'; round?: number; path: string; sha: string; size: number };
/** A fix's folder on the default branch; `prd` holds the fix's issue number, as the dossier does. */
export type FixFolder = { kind: 'visual' | 'bug'; prd: number; topic: string; dir: string; files: FixFile[] };
/** A folder or a file the listing gave that is not read, and why. */
export type Skipped = { path: string; reason: string };

// The three settings the switch reads. A section that is not a mapping reads as absent, as it always has.
const section = <T extends z.ZodRawShape>(shape: T) => z.looseObject(shape).nullish().catch(null);
const SwitchConfig = z.looseObject({
  dossier: section({ enabled: z.unknown() }),
  ask: section({ url: z.unknown() }),
  paths: section({ delivery: z.unknown() }),
});

/** The largest artifact a dossier takes (the migration's `bytes` check). */
export const ARTIFACT_MAX_BYTES = 512 * 1024;
/** The longest title a dossier takes. */
export const TITLE_MAX = 200;
/** Where a repository's config lives, on its default branch. */
export const CONFIG_FILE = '.omni-loop/config.yml';

const DEFAULT_DELIVERY = '.omni-loop/delivery';
const STAGES: string[] = ['inbox', 'shipped']; // the order the kit looks in
const FILES = new Map<string, TreeFile['kind']>([['spec.md', 'spec'], ['plan.md', 'plan'], ['before-after.html', 'before-after']]);
const KIND_ORDER: string[] = ['spec', 'plan', 'before-after'];
const FOLDER = /^(\d{4,})-([a-z0-9]+(?:-[a-z0-9]+)*)$/;
const NOT_A_FOLDER = 'the folder name does not read as <nnnn>-<topic>';

/** Whether a repository's config (its `.omni-loop/config.yml`) switches dossiers on, and where its delivery folder is. */
export function dossierSwitch(text: string): { on: true; delivery: string } | { on: false; reason: string } {
  let parsed: unknown;
  try {
    parsed = parse(text);
  } catch (err) {
    return { on: false, reason: `${CONFIG_FILE} does not read: ${String(err instanceof Error ? err.message : undefined).split('\n')[0]}` };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { on: false, reason: `${CONFIG_FILE} does not read: it is not a mapping` };
  }
  const config = SwitchConfig.parse(parsed);
  const enabled = config.dossier?.enabled;
  if (enabled !== undefined && enabled !== null && typeof enabled !== 'boolean') {
    return { on: false, reason: 'dossier.enabled is not true or false' };
  }
  if (enabled !== true) return { on: false, reason: 'dossier.enabled is false' };
  if (!config.ask?.url) return { on: false, reason: 'ask.url is not set' };
  const named = typeof config.paths?.delivery === 'string' ? config.paths.delivery.trim().replace(/^\.\/+/, '').replace(/\/+$/, '') : '';
  return { on: true, delivery: named || DEFAULT_DELIVERY };
}

// The value `map` holds under `key`, made and put there first when there is none.
function entryOf<K, V>(map: Map<K, V>, key: K, make: () => V): V {
  const found = map.get(key);
  if (found !== undefined) return found;
  const made = make();
  map.set(key, made);
  return made;
}

// A folder's number and topic, from its name: null when it does not read as `<nnnn>-<topic>`.
function numbered(name: string): { prd: number; topic: string } | null {
  const match = FOLDER.exec(name);
  const prd = match ? Number(match[1]) : 0;
  return match && prd ? { prd, topic: match[2] ?? '' } : null;
}

// The listing's blobs three parts below `prefix`: `<root>/<name>/<file>`.
function* blobsUnder(entries: readonly TreeEntry[], prefix: string): Generator<{ entry: TreeEntry; root: string; name: string; file: string }> {
  for (const entry of entries) {
    if (entry.type !== 'blob' || !entry.path.startsWith(prefix)) continue;
    const parts = entry.path.slice(prefix.length).split('/');
    const [root = '', name = '', file = ''] = parts;
    if (parts.length === 3) yield { entry, root, name, file };
  }
}

// The folders by the key their number gives them; a folder whose name does not read as `<nnnn>-<topic>` skipped.
function byNumber<F extends { name: string; dir: string }, K>(
  folders: Iterable<F>, keyOf: (folder: F, prd: number) => K, skipped: Skipped[],
): Map<K, Array<F & { prd: number; topic: string }>> {
  const candidates = new Map<K, Array<F & { prd: number; topic: string }>>();
  for (const folder of folders) {
    const at = numbered(folder.name);
    if (at) entryOf(candidates, keyOf(folder, at.prd), () => []).push({ ...folder, ...at });
    else skipped.push({ path: folder.dir, reason: NOT_A_FOLDER });
  }
  return candidates;
}

/**
 * A recursive tree listing read as PRD folders under `delivery` (from the repository's root): folders by
 * PRD number; a folder whose name does not parse, a file over 512 KiB and a PRD's second folder skipped.
 */
export function deliveryFolders(entries: readonly TreeEntry[], delivery: string): { folders: PrdFolder[]; skipped: Skipped[] } {
  const prefix = `${delivery}/`;
  type Found = { stage: string; name: string; dir: string; files: TreeFile[] };
  const byDir = new Map<string, Found>(); // dir → { stage, name, files }
  for (const { entry, root: stage, name, file } of blobsUnder(entries, prefix)) {
    const kind = FILES.get(file);
    if (!STAGES.includes(stage) || !kind) continue;
    const dir = `${prefix}${stage}/${name}`;
    entryOf(byDir, dir, () => ({ stage, name, dir, files: [] })).files.push({ kind, path: entry.path, sha: entry.sha, size: entry.size ?? 0 });
  }

  const skipped: Skipped[] = [];
  const candidates = byNumber(byDir.values(), (_folder, prd) => prd, skipped); // prd → folders, in the order the kit looks

  const folders: PrdFolder[] = [];
  for (const [prd, found] of [...candidates].sort(([a], [b]) => a - b)) {
    found.sort((a, b) => STAGES.indexOf(a.stage) - STAGES.indexOf(b.stage) || (a.name < b.name ? -1 : 1));
    const [read, ...others] = found;
    if (!read) continue;
    for (const other of others) skipped.push({ path: other.dir, reason: `PRD ${prd} is read from ${read.dir}` });
    const files: TreeFile[] = [];
    for (const file of read.files.sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind))) {
      if (file.size > ARTIFACT_MAX_BYTES) skipped.push({ path: file.path, reason: `${file.size} bytes, over 512 KiB` });
      else files.push(file);
    }
    folders.push({ prd, topic: read.topic, dir: read.dir, files });
  }
  skipped.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return { folders, skipped };
}

/** The folder under the delivery folder each kind of fix keeps its record in, in the order they are read. */
const FIX_ROOTS: Array<[string, FixFolder['kind']]> = [['visual', 'visual'], ['bugs', 'bug']];
const FIX_NAMES: Record<FixFolder['kind'], string> = { visual: 'visual fix', bug: 'bug fix' };
const ROUND = /^variations-r([1-9]\d*)\.html$/;

/** A fix's file as its dossier takes it, or null: `{ kind, round? }`. */
function fixFile(kind: FixFolder['kind'], name: string): { kind: FixFile['kind']; round?: number } | null {
  if (kind === 'bug') return name === 'bug.md' ? { kind: 'bug-record' } : null;
  if (name === 'before-after.html') return { kind: 'before-after' };
  const round = ROUND.exec(name);
  return round ? { kind: 'variations', round: Number(round[1]) } : null;
}

/**
 * A recursive tree listing read as fixes under `delivery` (from the repository's root): the visual fixes
 * by number, then the bug fixes; a folder whose name does not parse, a file over 512 KiB and a number's
 * second folder of the same kind skipped. `prd` holds the fix's issue number, as the dossier does.
 */
export function fixFolders(entries: readonly TreeEntry[], delivery: string): { folders: FixFolder[]; skipped: Skipped[] } {
  const prefix = `${delivery}/`;
  const roots = new Map(FIX_ROOTS);
  type Found = { kind: FixFolder['kind']; name: string; dir: string; files: FixFile[] };
  const byDir = new Map<string, Found>(); // dir → { kind, name, dir, files }
  for (const { entry, root, name, file } of blobsUnder(entries, prefix)) {
    const kind = roots.get(root);
    if (!kind) continue;
    const read = fixFile(kind, file);
    if (!read) continue;
    const dir = `${prefix}${root}/${name}`;
    entryOf(byDir, dir, () => ({ kind, name, dir, files: [] })).files.push({ kind: read.kind, ...(read.round ? { round: read.round } : {}), path: entry.path, sha: entry.sha, size: entry.size ?? 0 });
  }

  const skipped: Skipped[] = [];
  const candidates = byNumber(byDir.values(), (folder, prd) => `${folder.kind} ${prd}`, skipped); // `${kind} ${n}` → folders

  const order = (f: { kind: FixFolder['kind'] }): number => FIX_ROOTS.findIndex(([, kind]) => kind === f.kind);
  const firsts = [...candidates.values()].flatMap((found) => {
    found.sort((a, b) => (a.name < b.name ? -1 : 1));
    const [read, ...others] = found;
    if (!read) return [];
    for (const other of others) skipped.push({ path: other.dir, reason: `${FIX_NAMES[read.kind]} ${read.prd} is read from ${read.dir}` });
    return [read];
  }).sort((a, b) => order(a) - order(b) || a.prd - b.prd);

  const folders = firsts.map((read): FixFolder => {
    const files: FixFile[] = [];
    const sorted = read.files.sort((a, b) => (a.kind === b.kind ? (a.round ?? 0) - (b.round ?? 0) : a.kind === 'variations' ? 1 : -1));
    for (const file of sorted) {
      if (file.size > ARTIFACT_MAX_BYTES) skipped.push({ path: file.path, reason: `${file.size} bytes, over 512 KiB` });
      else files.push(file);
    }
    return { kind: read.kind, prd: read.prd, topic: read.topic, dir: read.dir, files };
  });
  skipped.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return { folders, skipped };
}

const FIX_PREFIX = /^(?:visual|bug)\s*:\s*/i;

/** A fix's dossier title: its issue's title without its `Visual: ` or `Bug: ` prefix, else `topic`, cut to 200 characters. */
export function fixTitle(issueTitle: unknown, topic: string): string {
  const title = typeof issueTitle === 'string' ? issueTitle.trim().replace(FIX_PREFIX, '').trim() : '';
  return (title || topic).slice(0, TITLE_MAX);
}

const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
const FRONT_MATTER_LINE = /^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/;

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  const [first, last] = [trimmed[0], trimmed[trimmed.length - 1]];
  return trimmed.length >= 2 && first === last && (first === '"' || first === "'") ? trimmed.slice(1, -1) : trimmed;
}

/** A dossier's title: the spec's front matter `title:`, else the folder's topic, cut to 200 characters. */
export function titleOf(spec: string | null | undefined, topic: string): string {
  let title: string | null = null;
  const block = spec ? FRONT_MATTER.exec(spec) : null;
  for (const line of block ? (block[1] ?? '').split('\n') : []) {
    const match = FRONT_MATTER_LINE.exec(line.trim());
    if (match && match[1] === 'title') title = stripQuotes(match[2] ?? '').trim() || null;
  }
  return (title ?? topic).slice(0, TITLE_MAX);
}

/** The hash git gives a file's content (`git hash-object`): what a tree listing names each blob by. */
export function gitBlobSha(content: string): string {
  const bytes = Buffer.from(content, 'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}
