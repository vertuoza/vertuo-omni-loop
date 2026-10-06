/**
 * **Imported knowledge** (PRD 522, s2) — a plan repository's copy of a target repository's
 * knowledge base, one per `plan.targets` entry whose `knowledge` is `imported`, under
 * `<paths.knowledge>/repos/<name>/`. A copy has a knowledge folder's own layout: `playbook/` with
 * the forms, `adr/README.md` for the decisions form, and `product/`, `domains/` and `cross-domain/`
 * with the registers.
 *
 * A copy is read and graded through a **copy context**: the plan repository's own context with its
 * knowledge paths moved into the copy, so the forms' and registers' own parsers and graders read it
 * unchanged. Two things differ, both because every path a copy names is a path of the target:
 *
 * - `copyOf` is the target's `owner/name`; the graders look up no path such a context names (an
 *   evidence entry, a `See:`, `points-to` or `index` line, a register's `Source:`, `Enforced by:`
 *   or owning library) on the plan repository's disk;
 * - no glossary: the plan repository's is not the target's.
 *
 * The plan repository's own registers never read a copy: `readKnowledge` reads only the three
 * register folders directly under `paths.knowledge`.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { trackedFiles } from '../check-report.ts';
import { createContext, type Context, type ExecText } from '../context.ts';
import { copyFolder } from '../plan-repo/targets.ts';
import { gradePlaybook } from '../playbook/check-playbook.ts';
import { playbookStatus } from '../playbook/status.ts';
import { gradeKnowledge } from './check-knowledge.ts';
import { registerCounts } from './registers.ts';

/** The folder, under `paths.knowledge`, that holds every copy. */
export const COPIES_DIR = 'repos';

/** A plan target, as the config holds it. */
type PlanTarget = NonNullable<Context['config']['plan']>['targets'][number];

/** A copy context: the plan repository's own context, its knowledge paths moved into the copy. */
export type CopyContext = Readonly<Context & { copyOf: string }>;

/** One imported target, read: its copy's folder, whether it exists, and its copy context. */
export type Copy = { repo: string; folder: string; exists: boolean; ctx: CopyContext };

/** The plan's `imported` targets, in config order; `[]` in a repository with no `plan` section. */
export function importedTargets({ ctx }: { ctx: Context }): PlanTarget[] {
  return (ctx.config.plan?.targets ?? []).filter((target) => target.knowledge === 'imported');
}

/** `ctx` moved into the copy at `folder` of `repo`: see the module note. */
export function copyContext(ctx: Context, { repo, folder }: { repo: string; folder: string }): CopyContext {
  const paths = { ...ctx.config.paths, knowledge: folder, playbook: `${folder}/playbook`, adr: `${folder}/adr`, glossary: null };
  return Object.freeze({ ...createContext(ctx.root, { ...ctx.config, paths }), copyOf: repo });
}

/** Every imported target as `{ repo, folder, exists, ctx }`, `ctx` its copy context. */
export function readCopies({ ctx }: { ctx: Context }): Copy[] {
  return importedTargets({ ctx }).map(({ repo }) => {
    const folder = copyFolder(repo, { ctx });
    return { repo, folder, exists: existsSync(join(ctx.root, folder)), ctx: copyContext(ctx, { repo, folder }) };
  });
}

/**
 * The grade of every copy, as `omni check kb` prints it: `{ copies, violations, warnings }`, each
 * line the one the repository's own knowledge would give, prefixed by the copy's folder. A copy's
 * forms are graded as the playbook is, its registers as `omni check knowledge` grades the
 * repository's own; an imported target whose folder is absent is a violation.
 */
export function gradeCopies({ ctx, exec }: { ctx: Context; exec: ExecText }): {
  copies: number;
  violations: string[];
  warnings: string[];
} {
  const copies = readCopies({ ctx });
  const violations: string[] = [];
  const warnings: string[] = [];
  for (const copy of copies) {
    const prefix = (line: string) => `${copy.folder}: ${line}`;
    if (!copy.exists) {
      violations.push(prefix(`missing — plan.targets lists ${copy.repo} as imported, so its copy lives here`));
      continue;
    }
    const forms = gradePlaybook({ ctx: copy.ctx, exec });
    const files = trackedFiles(copy.ctx, copy.folder).filter((file) => file.endsWith('.md'));
    const registers = gradeKnowledge({ ctx: copy.ctx, files });
    violations.push(...forms.violations.map(prefix), ...registers.violations.map(prefix));
    warnings.push(...forms.warnings.map(prefix), ...registers.wishes.map(prefix), ...registers.proposals.map(prefix));
  }
  return { copies: copies.length, violations, warnings };
}

/**
 * Every copy's map, as `omni kb status` lists it under `targets`: `[{ repo, folder, forms,
 * registers }]`, `forms` and `registers` shaped as the repository's own. A copy's evidence is
 * never looked up here, so each form's `stale` is empty: `omni targets` says when a copy is stale.
 */
export function copiesStatus({ ctx, exec }: { ctx: Context; exec: ExecText }) {
  return readCopies({ ctx }).map(({ repo, folder, ctx: copy }) => {
    const { forms } = playbookStatus({ ctx: copy, exec });
    return { repo, folder, forms, registers: registerCounts({ ctx: copy }) };
  });
}
