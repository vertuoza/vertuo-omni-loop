// The drafts `omni dossier open` recorded on this computer (PRD 216): `.omni-loop/local/dossiers.json`
// in the repository's main checkout, beside ask mode's state and ignored by the same `.gitignore`.
// The main checkout is found through `git rev-parse --git-common-dir`, so a brainstorm running in a
// worktree and a push run from another read and write the same file.
//
// The file is a JSON list of `{ id, url, claudeSessionId, prd, openedAt }`, `prd` null until a push
// numbers the draft. A file that is missing, half-written or not a list reads as empty, and an entry
// of the wrong shape reads as absent: a draft the kit cannot read is one it does not number.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { LOCAL_DIR } from '../ask/local-state.mjs';

export const DOSSIERS_FILE = join(LOCAL_DIR, 'dossiers.json');

const QUIET = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] };
const isText = (value) => typeof value === 'string' && value.length > 0;

/** The root of the repository's main checkout, from `cwd` in it or in any of its worktrees; null
 * outside a repository. */
export function mainCheckout(cwd, exec = execFileSync) {
  let common;
  try {
    common = String(exec('git', ['rev-parse', '--git-common-dir'], { cwd, ...QUIET })).trim();
  } catch {
    return null;
  }
  const dir = resolve(cwd, common);
  if (basename(dir) === '.git') return realpathSync(dirname(dir));
  // A bare repository or a separate git folder: the checkout `cwd` is in is the best there is.
  try {
    return realpathSync(String(exec('git', ['rev-parse', '--show-toplevel'], { cwd, ...QUIET })).trim());
  } catch {
    return null;
  }
}

/** @returns {import('./draft.mjs').DossierEntry | null} */
function entryOf(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const { id, url, claudeSessionId, prd, openedAt } = value;
  if (!isText(id) || !isText(url) || !isText(openedAt)) return null;
  if (!(claudeSessionId === null || isText(claudeSessionId))) return null;
  if (!(prd === null || (Number.isInteger(prd) && prd > 0))) return null;
  return { id, url, claudeSessionId, prd, openedAt };
}

/** @returns {import('./draft.mjs').DossierEntry[]} */
export function readDossiers(root) {
  let value;
  try {
    value = JSON.parse(readFileSync(join(root, DOSSIERS_FILE), 'utf8'));
  } catch {
    return [];
  }
  return Array.isArray(value) ? value.map(entryOf).filter(Boolean) : [];
}

function writeDossiers(root, entries) {
  const dir = join(root, LOCAL_DIR);
  mkdirSync(dir, { recursive: true });
  const ignore = join(dir, '.gitignore');
  if (!existsSync(ignore)) writeFileSync(ignore, '*\n');
  writeFileSync(join(root, DOSSIERS_FILE), `${JSON.stringify(entries, null, 2)}\n`);
}

/** Adds a draft `omni dossier open` just opened. */
export function recordDraft(root, entry) {
  writeDossiers(root, [...readDossiers(root), entry]);
}

/** Records that a push numbered draft `draftId` as PRD `prd`, now the dossier `id` at `url`. */
export function markNumbered(root, draftId, { prd, id, url }) {
  writeDossiers(root, readDossiers(root).map((entry) => (entry.id === draftId ? { ...entry, id, url, prd } : entry)));
}

/** Forgets a draft the server no longer has. */
export function forgetDraft(root, draftId) {
  writeDossiers(root, readDossiers(root).filter((entry) => entry.id !== draftId));
}
