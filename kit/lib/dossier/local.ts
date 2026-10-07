// The drafts `omni dossier open` recorded on this computer (PRD 216): `.omni-loop/local/dossiers.json`
// in the repository's main checkout, beside ask mode's state and ignored by the same `.gitignore`.
// The main checkout is found through `git rev-parse --git-common-dir`, so a brainstorm running in a
// worktree and a push run from another read and write the same file.
//
// The file is a JSON list of `{ id, url, claudeSessionId, prd, openedAt }`, `prd` null until a push
// numbers the draft. A file that is missing, half-written or not a list reads as empty, and an entry
// of the wrong shape reads as absent: a draft the kit cannot read is one it does not number.
import { execFileSync } from 'node:child_process';
import type { StdioOptions } from 'node:child_process';
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { z } from 'zod';
import { ensureLocalDir, LOCAL_DIR } from '../ask/local-state.ts';
import type { ExecText } from '../context.ts';
import type { DossierEntry } from './draft.ts';
import { PrdNumberSchema } from '../ids.ts';
import type { PrdNumber } from '../ids.ts';

export const DOSSIERS_FILE = join(LOCAL_DIR, 'dossiers.json');

const QUIET: { encoding: 'utf8'; stdio: StdioOptions } = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] };

const text = z.string().min(1);

/** One entry of the file, as `entryOf` keeps it: any other key is dropped. */
const DossierEntrySchema = z.object({
  id: text,
  url: text,
  claudeSessionId: text.nullable(),
  prd: PrdNumberSchema.nullable(),
  openedAt: text,
});

/** The root of the repository's main checkout, from `cwd` in it or in any of its worktrees; null
 * outside a repository. */
export function mainCheckout(cwd: string, exec: ExecText = execFileSync): string | null {
  let common: string;
  try {
    common = exec('git', ['rev-parse', '--git-common-dir'], { cwd, ...QUIET }).trim();
  } catch {
    return null;
  }
  const dir = resolve(cwd, common);
  if (basename(dir) === '.git') return realpathSync(dirname(dir));
  // A bare repository or a separate git folder: the checkout `cwd` is in is the best there is.
  try {
    return realpathSync(exec('git', ['rev-parse', '--show-toplevel'], { cwd, ...QUIET }).trim());
  } catch {
    return null;
  }
}

/** An entry of the file, or null when it is not of the shape. */
function entryOf(value: unknown): DossierEntry | null {
  const parsed = DossierEntrySchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function readDossiers(root: string): DossierEntry[] {
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(join(root, DOSSIERS_FILE), 'utf8'));
  } catch {
    return [];
  }
  return Array.isArray(value) ? value.map(entryOf).filter((entry) => entry !== null) : [];
}

function writeDossiers(root: string, entries: readonly DossierEntry[]): void {
  ensureLocalDir(root);
  writeFileSync(join(root, DOSSIERS_FILE), `${JSON.stringify(entries, null, 2)}\n`);
}

/** Adds a draft `omni dossier open` just opened. */
export function recordDraft(root: string, entry: DossierEntry): void {
  writeDossiers(root, [...readDossiers(root), entry]);
}

/** Records that a push numbered draft `draftId` as PRD `prd`, now the dossier `id` at `url`. */
export function markNumbered(root: string, draftId: string, { prd, id, url }: { prd: PrdNumber; id: string; url: string }): void {
  writeDossiers(root, readDossiers(root).map((entry) => (entry.id === draftId ? { ...entry, id, url, prd } : entry)));
}

/** Forgets a draft the server no longer has. */
export function forgetDraft(root: string, draftId: string): void {
  writeDossiers(root, readDossiers(root).filter((entry) => entry.id !== draftId));
}
