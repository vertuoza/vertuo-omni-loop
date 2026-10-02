// A PRD's folder as a dossier sees it (PRD 216): its artifacts (the spec, the plan, the before/after page
// and, since PRD 822, the personas' `voice.json`), each whole with its SHA-256
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
import { parseFrontMatterLines } from '../front-matter.ts';
import { parseFolderName } from '../layout.ts';
import { defined } from '../narrow.ts';
import type { Layout, PrdNumber } from '../layout.ts';
import { VOICE_FILE } from '../voice/voice.ts';

/** The largest artifact the contract takes. */
export const ARTIFACT_MAX_BYTES = 512 * 1024;
/** The longest title the contract takes. */
export const TITLE_MAX = 200;

/** The kinds, in the order they are sent, each with where the layout keeps its file. */
/** The kinds of artifact a PRD's dossier carries. */
export type ArtifactKind = 'spec' | 'plan' | 'before-after' | 'voice';

/** One artifact of a PRD's folder, whole, with its hash and its size in bytes. */
export type Artifact = { kind: ArtifactKind; path: string; content: string; sha256: string; bytes: number };

/** A file not sent because it is over {@link ARTIFACT_MAX_BYTES}. */
export type TooLarge = { kind: string; path: string; bytes: number };

/** A PRD's folder as its dossier is pushed. */
export type DossierFolder = { prd: number; dir: string; title: string; artifacts: Artifact[]; tooLarge: TooLarge[] };

/** The kinds of fix that keep a folder (PRD 627). */
export type FixKind = 'visual' | 'bug';

/** One artifact of a fix's folder; a round of variations carries its number. */
export type FixArtifact = {
  kind: 'before-after' | 'variations' | 'bug-record';
  path: string;
  content: string;
  sha256: string;
  bytes: number;
  round?: number;
};

/** A fix's folder as its dossier is pushed. */
export type FixFolder = { issue: number; kind: FixKind; dir: string; title: string; artifacts: FixArtifact[]; tooLarge: TooLarge[] };

export const ARTIFACT_KINDS: readonly { kind: ArtifactKind; pathOf: (layout: Layout, prd: PrdNumber) => string | null }[] = Object.freeze([
  { kind: 'spec', pathOf: (layout: Layout, prd: PrdNumber) => layout.specPath(prd) },
  { kind: 'plan', pathOf: (layout: Layout, prd: PrdNumber) => layout.planPath(prd) },
  { kind: 'before-after', pathOf: (layout: Layout, prd: PrdNumber) => layout.beforeAfterPath(prd) },
  // A PRD with no folder throws here, as it always has; `readDossierFolder` asks only once it has one.
  { kind: 'voice', pathOf: (layout: Layout, prd: PrdNumber) => `${defined(layout.whereIs(prd), `the folder of PRD ${Number(prd)}`).dir}/${VOICE_FILE}` },
]);

const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

/** The `title:` of a markdown file's front matter, or null. */
export function frontMatterTitle(text: string): string | null {
  const block = FRONT_MATTER.exec(text);
  if (!block) return null;
  const title = parseFrontMatterLines(block[1] ?? '').data.title?.trim();
  return title || null;
}

export const sha256 = (content: string): string => createHash('sha256').update(content, 'utf8').digest('hex');

/** PRD `prd`'s folder as its dossier is pushed; null when PRD `prd` has no folder. */
export function readDossierFolder(ctx: { root: string; layout: Layout }, prd: PrdNumber): DossierFolder | null {
  const where = ctx.layout.whereIs(prd);
  if (!where) return null;
  const artifacts: Artifact[] = [];
  const tooLarge: TooLarge[] = [];
  let title: string | null = null;
  for (const { kind, pathOf } of ARTIFACT_KINDS) {
    // Never null: every kind's path is in the folder, and the folder is there.
    const path = defined(pathOf(ctx.layout, prd), `the ${kind} of PRD ${Number(prd)}`);
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
const FIX_ROOTS: Readonly<Record<FixKind, string>> = Object.freeze({ visual: 'visual', bug: 'bugs' });

const ROUND = /^variations-r([1-9]\d*)\.html$/;
const FIX_PREFIX = /^(?:visual|bug)\s*:\s*/i;

/** A fix's dossier title: its issue's title without its `Visual: ` or `Bug: ` prefix, else `topic`, cut
 * to the 200 characters the contract takes. */
export function fixTitle(issueTitle: unknown, topic: string): string {
  const title = typeof issueTitle === 'string' ? issueTitle.trim().replace(FIX_PREFIX, '').trim() : '';
  return (title || topic).slice(0, TITLE_MAX);
}

/** The files of a fix's folder that are sent, in the order they are sent: `{ kind, name, round? }`. */
type FixFile = { kind: FixArtifact['kind']; name: string; round?: number };

function fixFiles(kind: FixKind, names: readonly string[]): FixFile[] {
  if (kind === 'bug') return names.includes('bug.md') ? [{ kind: 'bug-record', name: 'bug.md' }] : [];
  const page: FixFile[] = names.includes('before-after.html') ? [{ kind: 'before-after', name: 'before-after.html' }] : [];
  const rounds = names
    .flatMap((name): (FixFile & { round: number })[] => {
      const match = ROUND.exec(name);
      return match ? [{ kind: 'variations', name, round: Number(match[1]) }] : [];
    })
    .sort((a, b) => a.round - b.round);
  return [...page, ...rounds];
}

/**
 * Issue `issue`'s fix of `kind` ('visual' or 'bug'), as its dossier is pushed: the first folder named
 * for the issue, its artifacts whole with their hashes and sizes (a round carries its number), and its
 * title. A file over 512 KiB is named in `tooLarge` and not sent.
 * `issueTitle` is the issue's title, when it could be read. Null when the issue has no such folder.
 */
export function readFixFolder(
  ctx: { root: string; config: { paths: { delivery: string } } },
  kind: FixKind,
  issue: number | string,
  { issueTitle = null }: { issueTitle?: string | null } = {},
): FixFolder | null {
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
  const artifacts: FixArtifact[] = [];
  const tooLarge: TooLarge[] = [];
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
