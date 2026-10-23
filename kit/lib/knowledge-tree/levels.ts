/**
 * **The knowledge tree** (PRD 2416, s1). Knowledge sits on levels, each optional: the **Omni
 * settings** (the workspace's settings repository), the **plan repository**, the **repository**,
 * and under them all the kit's own defaults. Every level is a repository's plain files.
 *
 * `LEVELS` names them in the tech side's order, **bottom-up**: the playbook and the decision records
 * are read from the repository first, else its plan repository's copy, else the Omni settings' copy,
 * else the kit default. (The product side reads the same levels top-down: `./product*`.)
 *
 * The two levels above the repository are read from local copies in the checkout's local folder,
 * which git ignores:
 *
 * | level           | its copy                                |
 * |-----------------|-----------------------------------------|
 * | `plan repo`     | `.omni-loop/local/tree/plan-repo/`      |
 * | `omni settings` | `.omni-loop/local/tree/omni-settings/`  |
 *
 * A copy is laid out as a knowledge folder is (`playbook/<form>.md`, `adr/README.md`), and is read
 * through a **level context**: the repository's own context with its knowledge paths moved into the
 * copy, so the forms' own parser reads it unchanged. A level whose copy is absent is skipped, never an
 * error: a repository with no copy reads as it always has. This module writes no copy (PRD 2417
 * writes the Omni settings' one).
 */
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { LOCAL_DIR } from '../ask/local-state.ts';
import type { Context } from '../context.ts';
import { foldersLayout } from '../layout.ts';

/** The levels, bottom-up: the order the tech side reads them in. */
export const LEVELS = Object.freeze(['repo', 'plan repo', 'omni settings', 'kit default'] as const);

/** One level of the tree. */
export type Level = (typeof LEVELS)[number];

/** A level read from a local copy: the two between the repository and the kit default. */
export type CopyLevel = Exclude<Level, 'repo' | 'kit default'>;

/** The copy levels, bottom-up. */
const COPY_LEVELS: readonly CopyLevel[] = ['plan repo', 'omni settings'];

/** The folder, in the checkout, under which every copy lies. */
const TREE_DIR = `${LOCAL_DIR}/tree`;

const COPY_FOLDERS: Readonly<Record<CopyLevel, string>> = Object.freeze({
  'plan repo': `${TREE_DIR}/plan-repo`,
  'omni settings': `${TREE_DIR}/omni-settings`,
});

/** Where the copy of `level` lies, relative to the checkout's root. */
export function levelFolder(level: CopyLevel): string {
  return COPY_FOLDERS[level];
}

/** What reading a level needs of a context. */
type Ctx = Pick<Context, 'root' | 'layout' | 'config'>;

/** One copy on disk: its level, its folder, and its level context. */
export type LevelCopy = { level: CopyLevel; folder: string; ctx: Ctx };

/** `ctx` with its knowledge paths moved into the copy at `folder`. */
function levelContext(ctx: Pick<Ctx, 'root' | 'config'>, folder: string): Ctx {
  const paths = { delivery: ctx.config.paths.delivery, knowledge: folder, playbook: `${folder}/playbook`, adr: `${folder}/adr` };
  return Object.freeze({ root: ctx.root, config: ctx.config, layout: foldersLayout(ctx.root, paths) });
}

/** Every copy present in the checkout at `ctx`, bottom-up; `[]` when there is none. */
export function levelCopies({ ctx }: { ctx: Pick<Ctx, 'root' | 'config'> }): LevelCopy[] {
  return COPY_LEVELS.flatMap((level) => {
    const folder = COPY_FOLDERS[level];
    const absolute = join(ctx.root, folder);
    if (!existsSync(absolute) || !statSync(absolute).isDirectory()) return [];
    return [{ level, folder, ctx: levelContext(ctx, folder) }];
  });
}
