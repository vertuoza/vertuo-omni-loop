// Reads what `idClashes` compares (PRD 3015): the base as it is now and, only when some id differs,
// the ids at its merge base with HEAD, both through git. Offline: no pull request is read, so the
// check runs wherever `omni check` does. A base that cannot be read compares nothing and says so.
import type { ExecText } from '../context.ts';
import { knowledgeAt } from '../git.ts';
import { messageOf } from '../narrow.ts';
import { clashLine, idClashes, type Stated } from './id-clash.ts';
import { readKnowledge, type KnowledgeCtx } from './registers.ts';

/** The comparison's violations, or the one line saying why ids were not compared. */
export type IdComparison = { violations: string[]; note: string | null };

function entriesAt(ctx: KnowledgeCtx, ref: string, exec: ExecText): Stated[] {
  const source = knowledgeAt({ ctx, ref, exec });
  return source === null ? [] : readKnowledge({ ctx, source }).entries;
}

function mergeBase(ctx: KnowledgeCtx, base: string, exec: ExecText): string | null {
  try {
    return exec('git', ['merge-base', base, 'HEAD'], { cwd: ctx.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null;
  } catch {
    return null;
  }
}

/**
 * The ids of `tree` new on this branch that `base` gave to another entry, as violations. `baseKnown`
 * false (the ref is absent), no merge base, or a base whose knowledge cannot be read: no violation,
 * and a note naming what was missing.
 */
export function compareIdsWithBase({
  ctx,
  tree,
  base,
  baseKnown,
  exec,
}: {
  ctx: KnowledgeCtx;
  tree: readonly Stated[];
  base: string;
  baseKnown: boolean;
  exec: ExecText;
}): IdComparison {
  if (!baseKnown) return { violations: [], note: `ids not compared — no ${base}` };
  const then = mergeBase(ctx, base, exec);
  if (then === null) return { violations: [], note: `ids not compared — no merge base with ${base}` };
  try {
    const clashes = idClashes({ tree, now: entriesAt(ctx, base, exec), then: () => entriesAt(ctx, then, exec).map(({ id }) => id) });
    return { violations: clashes.map((clash) => clashLine(clash, base)), note: null };
  } catch (error) {
    return { violations: [], note: `ids not compared — ${base} could not be read: ${(messageOf(error).split('\n')[0] ?? '').trim()}` };
  }
}
