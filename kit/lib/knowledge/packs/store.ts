// Knowledge packs on this computer (PRD 2011, s12; ADR-0095). A pack is a repository's knowledge folder,
// `.omni-loop/config.yml` and the flow's hook files at one commit, kept by the Omni page and read with
// `GET /api/knowledge-packs` (its contract is the Omni page's knowledge-packs contract).
//
// - `omni kb pack get <repo>` writes one under `.omni-loop/local/packs/<name>@<sha>/` of the main
//   checkout: each file at its repository path, then `pack.json` (the repository, the commit, its date,
//   the files with their sha256). The folder is read-only (files 0444, folders 0555) and ignored by git
//   through the local folder's own `.gitignore`.
// - A file whose bytes do not hash to the sha256 the server sent, or whose path leaves the folder, makes
//   the whole pack refused before anything is written.
// - The newest pack fetched for a repository is the one with the latest commit date. It is what the
//   readers (`omni flow show --repo`, `omni plan check`) read, and what `pack get` holds on when the
//   server does not answer.
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { z } from 'zod';
import { ensureLocalDir, LOCAL_DIR } from '../../ask/local-state.ts';

/** Where the packs live, in the checkout. */
const PACKS_DIR = join(LOCAL_DIR, 'packs');
/** The file, in each pack folder, that describes the pack. */
const PACK_FILE = 'pack.json';

const FileSchema = z.object({ path: z.string().min(1), sha256: z.string().regex(/^[0-9a-f]{64}$/) });

const MetaSchema = z.object({
  repository: z.string().min(1),
  sha: z.string().regex(/^[0-9a-f]{40}$/),
  committedAt: z.string().min(1),
  madeAt: z.string().min(1),
  files: z.array(FileSchema),
});

/** A pack kept on this computer: its folder (relative to the checkout), and what `pack.json` says. */
export type LocalPack = z.infer<typeof MetaSchema> & { folder: string };

/** What the server sends: the contract's `PackReply`, as the kit needs it. */
export const PackReplySchema = MetaSchema.omit({ files: true }).extend({
  files: z.array(FileSchema.extend({ content: z.string() })),
});
export type PackReply = z.infer<typeof PackReplySchema>;

/** The short name of an `owner/name` slug: the one that names a pack folder. */
export const packName = (repo: string): string => repo.slice(repo.indexOf('/') + 1);

const sha256 = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');

/** Why `reply` cannot be written, or null: a path that leaves the folder, or a hash that does not match its bytes. */
export function refusalOf(reply: PackReply): string | null {
  for (const { path, sha256: expected, content } of reply.files) {
    const clean = posix.normalize(path);
    if (clean.startsWith('/') || clean.startsWith('..') || clean !== path || path === PACK_FILE) {
      return `pack ${reply.sha.slice(0, 7)} refused: ${path} is not a path inside the pack`;
    }
    if (sha256(content) !== expected) return `pack ${reply.sha.slice(0, 7)} refused: ${path} does not hash to the sha256 sent`;
  }
  return null;
}

const readOnly = (folder: string): void => {
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) readOnly(path);
    else chmodSync(path, 0o444);
  }
  chmodSync(folder, 0o555);
};

/** Opens `folder` again for writing and removes it. */
function removeFolder(folder: string): void {
  const open = (path: string): void => {
    chmodSync(path, 0o755);
    for (const entry of readdirSync(path, { withFileTypes: true })) if (entry.isDirectory()) open(join(path, entry.name));
  };
  if (existsSync(folder)) open(folder);
  rmSync(folder, { recursive: true, force: true });
}

/**
 * Writes `reply` under `root`, read-only, and returns it. A pack already there for the commit is
 * left as it is (a commit's pack never changes). Throws the refusal line, writing nothing, on a reply
 * `refusalOf` refuses.
 */
export function writePack(root: string, reply: PackReply): LocalPack {
  const refused = refusalOf(reply);
  if (refused !== null) throw new Error(refused);
  const folder = join(PACKS_DIR, `${packName(reply.repository)}@${reply.sha}`);
  const meta = {
    repository: reply.repository,
    sha: reply.sha,
    committedAt: reply.committedAt,
    madeAt: reply.madeAt,
    files: reply.files.map(({ path, sha256: hash }) => ({ path, sha256: hash })),
  };
  if (existsSync(join(root, folder, PACK_FILE))) return { ...meta, folder };
  ensureLocalDir(root);
  const building = join(root, `${folder}.partial`);
  removeFolder(building);
  for (const { path, content } of reply.files) {
    mkdirSync(dirname(join(building, path)), { recursive: true });
    writeFileSync(join(building, path), content);
  }
  writeFileSync(join(building, PACK_FILE), `${JSON.stringify(meta, null, 2)}\n`);
  readOnly(building);
  removeFolder(join(root, folder));
  renameSync(building, join(root, folder));
  return { ...meta, folder };
}

/** Every pack fetched for `repo` (`owner/name` or its short name) under `root`, newest commit first. */
export function localPacks(root: string, repo: string): LocalPack[] {
  const dir = join(root, PACKS_DIR);
  if (!existsSync(dir)) return [];
  const name = packName(repo);
  const found: LocalPack[] = [];
  for (const entry of readdirSync(dir)) {
    if (!entry.startsWith(`${name}@`) || entry.endsWith('.partial')) continue;
    const folder = join(PACKS_DIR, entry);
    try {
      const meta = MetaSchema.parse(JSON.parse(readFileSync(join(root, folder, PACK_FILE), 'utf8')));
      if (entry === `${name}@${meta.sha}` && (repo === name || meta.repository.toLowerCase() === repo.toLowerCase())) found.push({ ...meta, folder });
    } catch {
      // a half-written or foreign folder is not a pack
    }
  }
  return found.sort((a, b) => Date.parse(b.committedAt) - Date.parse(a.committedAt));
}

/** The newest pack fetched for `repo`, or null. */
export const newestPack = (root: string, repo: string): LocalPack | null => localPacks(root, repo)[0] ?? null;

/** A pack's age at `now`, in the largest whole unit: `3d`, `5h`, `12m`, `0m`. */
export function ageOf(committedAt: string, now: Date): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - Date.parse(committedAt)) / 60_000));
  if (minutes >= 1440) return `${Math.floor(minutes / 1440)}d`;
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h`;
  return `${minutes}m`;
}

/** The text of `path` in `pack`, or null when the pack holds no such file. */
export function packFile(root: string, pack: Pick<LocalPack, 'folder'>, path: string): string | null {
  const file = join(root, pack.folder, path);
  return existsSync(file) && statSync(file).isFile() ? readFileSync(file, 'utf8') : null;
}

/** The refusal line when `packSha` is older than `readAt`: `pack stale: <sha> < read_at <sha>`. */
export const staleLine = (packSha: string, readAt: string): string => `pack stale: ${packSha.slice(0, 7)} < read_at ${readAt.slice(0, 7)}`;
