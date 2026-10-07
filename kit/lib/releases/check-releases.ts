/**
 * **`omni check releases`** (PRD 262, slice s1) — grades every release note a PRD folder holds, in
 * the inbox and in the shipped folders, by the rules of `note.mjs`. Each failure is one line naming
 * the file, then the rule. A repository with no note anywhere passes: a note is only graded once it
 * is there, whatever `releaseNotes.enabled` says. Whether a PRD must have one is the ship guard's
 * question (`kit/lib/delivery/ship.ts`), not this check's.
 *
 * The notes are read from the working tree, not from git, so a note just written is graded before
 * it is committed.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { prdFoldersIn } from '../layout.ts';
import { gradeReleaseNote, RELEASE_NOTE_FILE } from './note.ts';
import type { Context } from '../context.ts';
import type { PrdNumber } from '../ids.ts';

/** A release note's file, from the root, and the PRD whose folder holds it. */
export type ReleaseNoteFile = { file: string; prd: PrdNumber };

/** The release note's path in a PRD's folder, `dir` as the layout names it. */
export function releaseNotePath(dir: string): string {
  return `${dir}/${RELEASE_NOTE_FILE}`;
}


/** Every release note in the inbox, then in the shipped folders: `[{ file, prd }]`. */
export function releaseNoteFiles({ ctx }: { ctx: Context }): ReleaseNoteFile[] {
  const { inbox, shipped } = ctx.layout.dirs;
  return [inbox, shipped].flatMap((dir) =>
    prdFoldersIn(join(ctx.root, dir))
      .map(({ name, prd }) => ({ file: releaseNotePath(`${dir}/${name}`), prd }))
      .filter(({ file }) => existsSync(join(ctx.root, file))),
  );
}

/** Every rule a release note breaks, as `<file>: <rule>`; `[]` when every note holds. */
export function findReleaseViolations({ ctx }: { ctx: Context }): string[] {
  return releaseNoteFiles({ ctx }).flatMap(({ file, prd }) =>
    gradeReleaseNote(readFileSync(join(ctx.root, file), 'utf8'), { prd }).map((rule) => `${file}: ${rule}`),
  );
}
