// One lookup an agent runs before following any delivery path: where PRD <n> lives today.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parsePlanRepositories, parsePlanSlices } from '../inbox/territory.ts';
import { openItemFiles } from '../outbox/status.ts';
import type { Context } from '../context.ts';
import type { PrdNumber } from '../ids.ts';
import type { PRD } from '../types.ts';

export function whereIs(ctx: Context, prd: PrdNumber): PRD | null {
  const where = ctx.layout.whereIs(prd);
  if (!where) return null;
  const absolute = join(ctx.root, where.dir);
  const files = readdirSync(absolute, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => `${where.dir}/${entry.name}`)
    .sort();
  const outboxDir = ctx.layout.outboxDir(prd);
  return {
    prd,
    name: where.name,
    state: where.state,
    dir: where.dir,
    files,
    outboxDir,
    openItems: openItemFiles(prd, { ctx }),
    repos: planRepos(join(absolute, 'plan.md')),
  };
}

/**
 * The repositories a multi-repository plan (PRD 549) lands in: `[]` for an ordinary plan (no `repo`
 * column), for no plan, and for a plan that does not parse yet — `omni plan check` is where a broken
 * plan is graded, not here. In `## Repositories` order, then any repository a slice names that the
 * table left out, in slice order.
 */
function planRepos(planPath: string): string[] {
  if (!existsSync(planPath)) return [];
  const markdown = readFileSync(planPath, 'utf8');
  let slices: { repo: string | null }[];
  try {
    slices = parsePlanSlices(markdown);
  } catch {
    return [];
  }
  if (slices.every((slice) => slice.repo === null)) return [];
  const names: string[] = parsePlanRepositories(markdown).map((row: { repo: string }) => row.repo);
  for (const slice of slices) {
    if (slice.repo && !names.includes(slice.repo)) names.push(slice.repo);
  }
  return names;
}
