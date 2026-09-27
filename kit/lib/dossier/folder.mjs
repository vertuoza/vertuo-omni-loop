// A PRD's folder as a dossier sees it (PRD 216): its three artifacts, each whole with its SHA-256
// hash and its size in bytes, and the title the spec's front matter gives. Reads files, calls nothing:
// `omni dossier push` sends what this returns, and the server computes its own hash of each content.
//
// A missing file is simply not there. A file over 512 KiB is not sent: it is named in `tooLarge`, and
// the others still are. The title is the spec's `title:`, else the folder's topic, cut to the 200
// characters the contract takes.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseFrontMatterLines } from '../inbox/inbox.mjs';
import { parseFolderName } from '../layout.mjs';

/** The largest artifact the contract takes. */
export const ARTIFACT_MAX_BYTES = 512 * 1024;
/** The longest title the contract takes. */
export const TITLE_MAX = 200;

/** The three kinds, in the order they are sent, each with where the layout keeps its file. */
export const ARTIFACT_KINDS = Object.freeze([
  { kind: 'spec', pathOf: (layout, prd) => layout.specPath(prd) },
  { kind: 'plan', pathOf: (layout, prd) => layout.planPath(prd) },
  { kind: 'before-after', pathOf: (layout, prd) => layout.beforeAfterPath(prd) },
]);

const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

/** The `title:` of a markdown file's front matter, or null. */
export function frontMatterTitle(text) {
  const block = FRONT_MATTER.exec(text);
  if (!block) return null;
  const title = parseFrontMatterLines(block[1]).data.title?.trim();
  return title || null;
}

export const sha256 = (content) => createHash('sha256').update(content, 'utf8').digest('hex');

/**
 * @typedef {{ kind: 'spec' | 'plan' | 'before-after', path: string, content: string, sha256: string, bytes: number }} Artifact
 * @returns {{ prd: number, dir: string, title: string, artifacts: Artifact[],
 *   tooLarge: Array<{ kind: string, path: string, bytes: number }> } | null} null when PRD `prd` has no folder
 */
export function readDossierFolder(ctx, prd) {
  const where = ctx.layout.whereIs(prd);
  if (!where) return null;
  const artifacts = [];
  const tooLarge = [];
  let title = null;
  for (const { kind, pathOf } of ARTIFACT_KINDS) {
    const path = pathOf(ctx.layout, prd);
    const file = join(ctx.root, path);
    if (!existsSync(file)) continue;
    const raw = readFileSync(file);
    const content = raw.toString('utf8');
    if (kind === 'spec') title = frontMatterTitle(content);
    if (raw.length > ARTIFACT_MAX_BYTES) {
      tooLarge.push({ kind, path, bytes: raw.length });
      continue;
    }
    artifacts.push({ kind, path, content, sha256: sha256(content), bytes: Buffer.byteLength(content, 'utf8') });
  }
  const topic = parseFolderName(where.name)?.topic ?? where.name;
  return { prd: Number(prd), dir: where.dir, title: (title ?? topic).slice(0, TITLE_MAX), artifacts, tooLarge };
}
