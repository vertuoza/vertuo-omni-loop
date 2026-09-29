// A PRD's folder as a dossier sees it (PRD 216): its three artifacts, each whole with its SHA-256
// hash and its size in bytes, and the title the spec's front matter gives. Reads files, calls nothing:
// `omni dossier push` sends what this returns, and the server computes its own hash of each content.
//
// A missing file is simply not there. A file over 512 KiB is not sent: it is named in `tooLarge`, and
// the others still are. The title is the spec's `title:`, else the folder's topic, cut to the 200
// characters the contract takes.
//
// A fix's folder (PRD 627) is read by `readFixFolder`: a visual fix's
// `<delivery>/visual/<nnnn>-<slug>/` gives its `before-after.html` and each `variations-r<k>.html`, a
// round each in numeric order; a bug fix's `<delivery>/bugs/<nnnn>-<slug>/` gives its `bug.md` as its
// record. Its title is its issue's without the `Visual: ` or `Bug: ` prefix, else the folder's topic.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
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

/** The folder under `<delivery>` each kind of fix keeps its record in. */
const FIX_ROOTS = Object.freeze({ visual: 'visual', bug: 'bugs' });

const ROUND = /^variations-r([1-9]\d*)\.html$/;
const FIX_PREFIX = /^(?:visual|bug)\s*:\s*/i;

/** A fix's dossier title: its issue's title without its `Visual: ` or `Bug: ` prefix, else `topic`, cut
 * to the 200 characters the contract takes. */
export function fixTitle(issueTitle, topic) {
  const title = typeof issueTitle === 'string' ? issueTitle.trim().replace(FIX_PREFIX, '').trim() : '';
  return (title || topic).slice(0, TITLE_MAX);
}

/** The files of a fix's folder that are sent, in the order they are sent: `{ kind, name, round? }`. */
function fixFiles(kind, names) {
  if (kind === 'bug') return names.includes('bug.md') ? [{ kind: 'bug-record', name: 'bug.md' }] : [];
  const page = names.includes('before-after.html') ? [{ kind: 'before-after', name: 'before-after.html' }] : [];
  const rounds = names
    .map((name) => ({ name, match: ROUND.exec(name) }))
    .filter(({ match }) => match)
    .map(({ name, match }) => ({ kind: 'variations', name, round: Number(match[1]) }))
    .sort((a, b) => a.round - b.round);
  return [...page, ...rounds];
}

/**
 * Issue `issue`'s fix of `kind` ('visual' or 'bug'), as its dossier is pushed: the first folder named
 * for the issue, its artifacts whole with their hashes and sizes (a round carries its number), and its
 * title. A file over 512 KiB is named in `tooLarge` and not sent.
 * @param {{ issueTitle?: string | null }} [options] the issue's title, when it could be read
 * @returns {{ issue: number, kind: 'visual' | 'bug', dir: string, title: string,
 *   artifacts: Array<{ kind: 'before-after' | 'variations' | 'bug-record', path: string, content: string, sha256: string, bytes: number, round?: number }>,
 *   tooLarge: Array<{ kind: string, path: string, bytes: number }> } | null} null when the issue has no such folder
 */
export function readFixFolder(ctx, kind, issue, { issueTitle = null } = {}) {
  const root = `${ctx.config.paths.delivery}/${FIX_ROOTS[kind]}`;
  const absolute = join(ctx.root, root);
  if (!existsSync(absolute)) return null;
  const prefix = `${String(issue).padStart(4, '0')}-`;
  const name = readdirSync(absolute, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(prefix) && entry.name.length > prefix.length)
    .map((entry) => entry.name)
    .sort()[0];
  if (!name) return null;
  const dir = `${root}/${name}`;
  const artifacts = [];
  const tooLarge = [];
  for (const file of fixFiles(kind, readdirSync(join(ctx.root, dir)))) {
    const path = `${dir}/${file.name}`;
    const raw = readFileSync(join(ctx.root, path));
    if (raw.length > ARTIFACT_MAX_BYTES) {
      tooLarge.push({ kind: file.kind, path, bytes: raw.length });
      continue;
    }
    const content = raw.toString('utf8');
    artifacts.push({
      kind: file.kind, path, content, sha256: sha256(content), bytes: Buffer.byteLength(content, 'utf8'),
      ...(file.round ? { round: file.round } : {}),
    });
  }
  const topic = name.slice(prefix.length);
  return { issue: Number(issue), kind, dir, title: fixTitle(issueTitle, topic), artifacts, tooLarge };
}
