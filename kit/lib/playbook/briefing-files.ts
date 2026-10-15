/**
 * **The briefing's files** (PRD 1793, s1): the paths that hold the rules every agent reads before it
 * changes anything. They are the briefing form at its own path under `paths.playbook`, the file its
 * `points-to` names when it is a pointer form, and the file each of its sections points to with a
 * `See: <path>[#anchor]` line, the whole file, its anchor dropped.
 *
 * The pointers are read from the briefing as `ctx.root` holds it (the head of a range), with the
 * form parser that reads every form. A briefing that is missing or does not parse points nowhere:
 * its own path is still one of its files. The kit's template of the briefing is never one.
 *
 * The coverage rule `briefing-text` fires on a change to any of them, and `omni kb owners` names
 * them in its CODEOWNERS block (s2).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import type { Context } from '../context.ts';
import { parseForm } from './forms.ts';

/** What reading the briefing needs: the root it is read at, and the config naming the playbook. */
export type BriefingContext = Pick<Context, 'root'> & { config: { paths: { playbook: string } } };

/** The briefing form's file, `<paths.playbook>/briefing.md`: the path `ctx.layout.formPath('briefing')` names. */
export function briefingPath({ ctx }: { ctx: BriefingContext }): string {
  return posix.join(ctx.config.paths.playbook, 'briefing.md');
}

/** A path as a pointer may write it (`./rules/x.md`, `/rules/x/`), as a repository path. */
function repositoryPath(path: string): string {
  return posix.normalize(path).replace(/^(?:\.\/|\/)+/, '').replace(/\/+$/, '');
}

/** The briefing's files: its own path first, then each path it points to, once each. */
export function briefingFiles({ ctx }: { ctx: BriefingContext }): string[] {
  const own = briefingPath({ ctx });
  const files = new Set([own]);
  const absolute = join(ctx.root, own);
  if (!existsSync(absolute)) return [...files];
  const parsed = parseForm(readFileSync(absolute, 'utf8'), { file: own });
  if (!parsed.ok) return [...files];
  const { pointsTo, slots } = parsed.form;
  const pointers = [pointsTo, ...slots.map((slot) => (slot.body.kind === 'pointer' ? slot.body.see.path : null))];
  for (const pointer of pointers) {
    if (pointer === null) continue;
    const path = repositoryPath(pointer);
    if (path !== '' && path !== '.') files.add(path);
  }
  return [...files];
}

/** Whether `path` is one of `files`, or sits under one that is a folder (a pointer form may point to one). */
export function isBriefingFile(path: string, files: readonly string[]): boolean {
  return files.some((file) => path === file || path.startsWith(`${file}/`));
}
