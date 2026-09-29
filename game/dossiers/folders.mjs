// The fallback's pure parts (PRD 216, spec › The fallback): a repository's dossier switch read from its
// own config, one tree listing read as PRD folders, a spec's title, and the hash git gives a file.
// Reads no file and calls nothing: game/dossiers/github.mjs fetches, game/dossiers/sync.mjs decides.
//
// The game never imports the kit (README: delete game/ and the delivery layer is untouched), so the
// rules the kit already holds are mirrored here, and must stay the same as the kit's:
//   - the switch: `dossier.enabled` is true and `ask.url` is set (kit/lib/config.mjs › dossierSwitch);
//   - a PRD folder: `<delivery>/{inbox,shipped}/<nnnn>-<topic>/`, the inbox before shipped and the
//     first name before the next (kit/lib/layout.mjs);
//   - the title: the spec's front matter `title:`, quotes stripped, else the topic, cut to 200
//     characters (kit/lib/dossier/folder.mjs);
//   - a fix's folder (PRD 627): `<delivery>/visual/<nnnn>-<slug>/` gives its `before-after.html` and each
//     `variations-r<k>.html` (a round each, in numeric order), `<delivery>/bugs/<nnnn>-<slug>/` its
//     `bug.md`; the first name is read; the title is the issue's without `Visual: ` or `Bug: `, else the
//     topic (kit/lib/dossier/folder.mjs › readFixFolder, fixTitle).
import { createHash } from 'node:crypto';
import { parse } from 'yaml';

/** The largest artifact a dossier takes (the migration's `bytes` check). */
export const ARTIFACT_MAX_BYTES = 512 * 1024;
/** The longest title a dossier takes. */
export const TITLE_MAX = 200;
/** Where a repository's config lives, on its default branch. */
export const CONFIG_FILE = '.omni-loop/config.yml';

const DEFAULT_DELIVERY = '.omni-loop/delivery';
const STAGES = ['inbox', 'shipped']; // the order the kit looks in
const FILES = new Map([['spec.md', 'spec'], ['plan.md', 'plan'], ['before-after.html', 'before-after']]);
const KIND_ORDER = ['spec', 'plan', 'before-after'];
const FOLDER = /^(\d{4,})-([a-z0-9]+(?:-[a-z0-9]+)*)$/;
const NOT_A_FOLDER = 'the folder name does not read as <nnnn>-<topic>';

/**
 * Whether a repository's config switches dossiers on, and where its delivery folder is.
 * @param {string} text the repository's `.omni-loop/config.yml`
 * @returns {{ on: true, delivery: string } | { on: false, reason: string }}
 */
export function dossierSwitch(text) {
  let config;
  try {
    config = parse(text);
  } catch (err) {
    return { on: false, reason: `${CONFIG_FILE} does not read: ${String(err.message).split('\n')[0]}` };
  }
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return { on: false, reason: `${CONFIG_FILE} does not read: it is not a mapping` };
  }
  const enabled = config.dossier?.enabled;
  if (enabled !== undefined && enabled !== null && typeof enabled !== 'boolean') {
    return { on: false, reason: 'dossier.enabled is not true or false' };
  }
  if (enabled !== true) return { on: false, reason: 'dossier.enabled is false' };
  if (!config.ask?.url) return { on: false, reason: 'ask.url is not set' };
  const named = typeof config.paths?.delivery === 'string' ? config.paths.delivery.trim().replace(/^\.\/+/, '').replace(/\/+$/, '') : '';
  return { on: true, delivery: named || DEFAULT_DELIVERY };
}

/**
 * @typedef {{ kind: 'spec' | 'plan' | 'before-after', path: string, sha: string, size: number }} TreeFile
 * @typedef {{ prd: number, topic: string, dir: string, files: TreeFile[] }} PrdFolder
 * @param {Array<{ path: string, type: string, sha: string, size?: number }>} entries a recursive tree listing
 * @param {string} delivery the delivery folder, from the repository's root
 * @returns {{ folders: PrdFolder[], skipped: Array<{ path: string, reason: string }> }} folders by PRD
 *   number; a folder whose name does not parse, a file over 512 KiB and a PRD's second folder skipped
 */
export function deliveryFolders(entries, delivery) {
  const prefix = `${delivery}/`;
  const byDir = new Map(); // dir → { stage, name, files }
  for (const entry of entries) {
    if (entry.type !== 'blob' || !entry.path.startsWith(prefix)) continue;
    const parts = entry.path.slice(prefix.length).split('/');
    if (parts.length !== 3 || !STAGES.includes(parts[0]) || !FILES.has(parts[2])) continue;
    const [stage, name, file] = parts;
    const dir = `${prefix}${stage}/${name}`;
    if (!byDir.has(dir)) byDir.set(dir, { stage, name, dir, files: [] });
    byDir.get(dir).files.push({ kind: FILES.get(file), path: entry.path, sha: entry.sha, size: entry.size ?? 0 });
  }

  const skipped = [];
  const candidates = new Map(); // prd → folders, in the order the kit looks
  for (const folder of byDir.values()) {
    const match = FOLDER.exec(folder.name);
    const prd = match ? Number(match[1]) : 0;
    if (!prd) {
      skipped.push({ path: folder.dir, reason: NOT_A_FOLDER });
      continue;
    }
    if (!candidates.has(prd)) candidates.set(prd, []);
    candidates.get(prd).push({ ...folder, prd, topic: match[2] });
  }

  const folders = [];
  for (const [prd, found] of [...candidates].sort(([a], [b]) => a - b)) {
    found.sort((a, b) => STAGES.indexOf(a.stage) - STAGES.indexOf(b.stage) || (a.name < b.name ? -1 : 1));
    const [read, ...others] = found;
    for (const other of others) skipped.push({ path: other.dir, reason: `PRD ${prd} is read from ${read.dir}` });
    const files = [];
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
const FIX_ROOTS = [['visual', 'visual'], ['bugs', 'bug']];
const FIX_NAMES = { visual: 'visual fix', bug: 'bug fix' };
const ROUND = /^variations-r([1-9]\d*)\.html$/;

/** A fix's file as its dossier takes it, or null: `{ kind, round? }`. */
function fixFile(kind, name) {
  if (kind === 'bug') return name === 'bug.md' ? { kind: 'bug-record' } : null;
  if (name === 'before-after.html') return { kind: 'before-after' };
  const round = ROUND.exec(name);
  return round ? { kind: 'variations', round: Number(round[1]) } : null;
}

/**
 * @typedef {{ kind: 'before-after' | 'variations' | 'bug-record', round?: number, path: string, sha: string, size: number }} FixFile
 * @typedef {{ kind: 'visual' | 'bug', prd: number, topic: string, dir: string, files: FixFile[] }} FixFolder
 * @param {Array<{ path: string, type: string, sha: string, size?: number }>} entries a recursive tree listing
 * @param {string} delivery the delivery folder, from the repository's root
 * @returns {{ folders: FixFolder[], skipped: Array<{ path: string, reason: string }> }} the visual fixes by
 *   number, then the bug fixes; a folder whose name does not parse, a file over 512 KiB and a number's
 *   second folder of the same kind skipped. `prd` holds the fix's issue number, as the dossier does.
 */
export function fixFolders(entries, delivery) {
  const prefix = `${delivery}/`;
  const roots = new Map(FIX_ROOTS);
  const byDir = new Map(); // dir → { kind, name, dir, files }
  for (const entry of entries) {
    if (entry.type !== 'blob' || !entry.path.startsWith(prefix)) continue;
    const parts = entry.path.slice(prefix.length).split('/');
    if (parts.length !== 3 || !roots.has(parts[0])) continue;
    const [root, name, file] = parts;
    const kind = roots.get(root);
    const read = fixFile(kind, file);
    if (!read) continue;
    const dir = `${prefix}${root}/${name}`;
    if (!byDir.has(dir)) byDir.set(dir, { kind, name, dir, files: [] });
    byDir.get(dir).files.push({ kind: read.kind, ...(read.round ? { round: read.round } : {}), path: entry.path, sha: entry.sha, size: entry.size ?? 0 });
  }

  const skipped = [];
  const candidates = new Map(); // `${kind} ${n}` → folders
  for (const folder of byDir.values()) {
    const match = FOLDER.exec(folder.name);
    const prd = match ? Number(match[1]) : 0;
    if (!prd) {
      skipped.push({ path: folder.dir, reason: NOT_A_FOLDER });
      continue;
    }
    const key = `${folder.kind} ${prd}`;
    if (!candidates.has(key)) candidates.set(key, []);
    candidates.get(key).push({ ...folder, prd, topic: match[2] });
  }

  const order = (f) => FIX_ROOTS.findIndex(([, kind]) => kind === f.kind);
  const firsts = [...candidates.values()].map((found) => {
    found.sort((a, b) => (a.name < b.name ? -1 : 1));
    const [read, ...others] = found;
    for (const other of others) skipped.push({ path: other.dir, reason: `${FIX_NAMES[read.kind]} ${read.prd} is read from ${read.dir}` });
    return read;
  }).sort((a, b) => order(a) - order(b) || a.prd - b.prd);

  const folders = firsts.map((read) => {
    const files = [];
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
export function fixTitle(issueTitle, topic) {
  const title = typeof issueTitle === 'string' ? issueTitle.trim().replace(FIX_PREFIX, '').trim() : '';
  return (title || topic).slice(0, TITLE_MAX);
}

const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
const FRONT_MATTER_LINE = /^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/;

function stripQuotes(value) {
  const trimmed = value.trim();
  const [first, last] = [trimmed[0], trimmed[trimmed.length - 1]];
  return trimmed.length >= 2 && first === last && (first === '"' || first === "'") ? trimmed.slice(1, -1) : trimmed;
}

/** A dossier's title: the spec's front matter `title:`, else the folder's topic, cut to 200 characters. */
export function titleOf(spec, topic) {
  let title = null;
  const block = spec ? FRONT_MATTER.exec(spec) : null;
  for (const line of block ? block[1].split('\n') : []) {
    const match = FRONT_MATTER_LINE.exec(line.trim());
    if (match && match[1] === 'title') title = stripQuotes(match[2]).trim() || null;
  }
  return (title ?? topic).slice(0, TITLE_MAX);
}

/** The hash git gives a file's content (`git hash-object`): what a tree listing names each blob by. */
export function gitBlobSha(content) {
  const bytes = Buffer.from(content, 'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}
