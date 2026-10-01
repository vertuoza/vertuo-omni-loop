// What a checkout says has shipped (PRD 262), for the sync: each PRD folder under the shipped folder,
// with its release note's title and description (or its spec's title and no description, while it has
// no note), whether the note is pinned to the initial release, and when the folder first reached main.
// Everything is read through the kit, the one reader of this repository's delivery folder: its config
// and layout say where the shipped folders are, and its parsers read the note and the spec.
//
// Nothing is guessed. A note that breaks the rules `omni check releases` enforces, a folder with no
// spec, or a spec the kit cannot read is refused, each naming its file and rule, and the sync writes
// nothing until a pull request fixes it: a PRD left out now would be numbered after PRDs that reached
// main later. A folder main does not hold yet (a checkout ahead of main) is only waiting.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig } from 'vertuo-omni-plan/kit/lib/config.ts';
import { createContext } from 'vertuo-omni-plan/kit/lib/context.ts';
import { parseSpec } from 'vertuo-omni-plan/kit/lib/inbox/inbox.ts';
import { parseFolderName } from 'vertuo-omni-plan/kit/lib/layout.ts';
import { releaseNotePath } from 'vertuo-omni-plan/kit/lib/releases/check-releases.ts';
import { gradeReleaseNote, INITIAL_VERSION, parseReleaseNote } from 'vertuo-omni-plan/kit/lib/releases/note.ts';
import { firstAdded, type Git } from './git.ts';
import type { ShippedPrd } from './sync.ts';

export type ShippedReading = {
  /** Every shipped PRD main holds, by PRD number. */
  shipped: ShippedPrd[];
  /** A line for each shipped folder main does not hold yet. */
  waiting: string[];
  /** `<file>: <rule>` for each thing that stops the sync before it writes. */
  refused: string[];
};

type Folder = { prd: number; dir: string; spec: string; note: string };

/** The PRD folders under the checkout's shipped folder, by PRD number. */
function shippedFolders(root: string): Folder[] {
  const ctx = createContext(root, loadConfig(root));
  const shipped: string = ctx.layout.dirs.shipped;
  if (!existsSync(join(root, shipped))) return [];
  return readdirSync(join(root, shipped), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && parseFolderName(entry.name))
    .map((entry) => {
      const dir = `${shipped}/${entry.name}`;
      return { prd: parseFolderName(entry.name)!.prd, dir, spec: `${dir}/spec.md`, note: releaseNotePath(dir) };
    })
    .sort((a, b) => a.prd - b.prd);
}

/** The folder's words for the release: its note's, else its spec's title; or the rules it breaks. */
function readWords(root: string, folder: Folder): { words: Pick<ShippedPrd, 'title' | 'description' | 'pinned'> } | { refused: string[] } {
  const read = (file: string) => readFileSync(join(root, file), 'utf8');
  if (existsSync(join(root, folder.note))) {
    const text = read(folder.note);
    const broken = gradeReleaseNote(text, { prd: folder.prd }) as string[];
    if (broken.length) return { refused: broken.map((rule) => `${folder.note}: ${rule}`) };
    const { note } = parseReleaseNote(text) as { note: { title: string; description: string; version: string | null } };
    return { words: { title: note.title, description: note.description, pinned: note.version === INITIAL_VERSION } };
  }
  const spec = parseSpec(read(folder.spec), { file: folder.spec }) as { ok: true; record: { title: string } } | { ok: false; errors: string[] };
  if (!spec.ok) return { refused: spec.errors };
  return { words: { title: spec.record.title, description: '', pinned: false } };
}

export function readShipped(root: string, { git }: { git?: Git } = {}): ShippedReading {
  const folders = shippedFolders(root);
  const refused: string[] = [];
  const waiting: string[] = [];
  const shipped: ShippedPrd[] = [];

  const hasSpec = (folder: Folder) => existsSync(join(root, folder.spec));
  const onMain = firstAdded(root, folders.filter(hasSpec).map((folder) => folder.spec), git);

  for (const folder of folders) {
    if (!hasSpec(folder)) { refused.push(`${folder.dir}: no spec.md`); continue; }
    const read = readWords(root, folder);
    if ('refused' in read) { refused.push(...read.refused); continue; }
    const added = onMain.get(folder.spec);
    if (!added) { waiting.push(`${folder.dir}: not on main yet — its spec.md is in no commit of this checkout`); continue; }
    shipped.push({ prd: folder.prd, releasedAt: added.committedAt, ...read.words });
  }
  return { shipped, waiting, refused };
}
