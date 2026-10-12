// One lookup an agent runs before following any delivery path: where PRD <n> lives today.
//
// PRD 1299, slice s5: a gate reads a PRD's stage through `prdState()` (`../approval/prd-state.ts`). A
// PRD born in the repository (◇) reads exactly as before and never calls the server; one born on the
// server (◆) reads `inbox` only once approved, and the gate prints its birthplace and its approval's
// lines. `gateApproval` is the approval call every gate makes.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { approvalReader } from '../approval/prd-state.ts';
import type { ApprovalCall, PrdState } from '../approval/prd-state.ts';
import { UNREACHABLE_LINE } from '../approval/approval.ts';
import type { Fetch, TokenStore } from '../ask/client.ts';
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

/** What a gate's approval call is made of beyond the context: a test hands in its own. */
export type GateOptions = { tokens?: TokenStore | undefined; home?: string | undefined; fetch?: Fetch | undefined; callMs?: number | undefined };

/** The approval call the gates make for a ◆ PRD (PRD 1299): the approval route of this repository's
 * slug. With no slug it calls nothing and holds the PRD, saying why, as `approvalReader` does with no
 * Omni page or no sign-in. */
export function gateApproval(ctx: Context, options: GateOptions = {}): ApprovalCall {
  const repo = ctx.config.repo.slug;
  if (!repo) {
    return () => Promise.resolve({ state: 'unreachable', lines: [UNREACHABLE_LINE], url: null, approval: null, drift: [], why: 'no repository slug (repo.slug)' });
  }
  return approvalReader(ctx, { repo, ...options });
}

/** Why a held approval reading called nothing, or null when it did. */
export function heldWhy(state: PrdState | null): string | null {
  const why: unknown = state?.approval && 'why' in state.approval ? state.approval.why : null;
  return typeof why === 'string' ? why : null;
}

/** What `omni prd <n>` prints for PRD `where`, its stage read through `prdState()`: a ◇ PRD exactly as
 * before; a ◆ one with its stage, its birthplace and each line its approval said. */
export function prdLines(where: PRD, state: PrdState | null): string[] {
  const server = state?.birthplace === 'server';
  return [
    `PRD ${where.prd} — ${where.name}`,
    `state: ${state?.state ?? where.state}`,
    ...(server ? ['birthplace: server', ...(state.approval?.lines ?? []).map((line) => `approval: ${line}`)] : []),
    `dir: ${where.dir}`,
    'files:',
    ...where.files.map((file) => `  - ${file}`),
    `outbox: ${where.outboxDir ?? 'none'}`,
    `open items: ${where.openItems.length === 0 ? 'none' : ''}`.trimEnd(),
    ...where.openItems.map((file) => `  - ${file}`),
    ...(where.repos.length === 0 ? [] : [`repos: ${where.repos.join(', ')}`]),
  ];
}
