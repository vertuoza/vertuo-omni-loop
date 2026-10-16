// No `kit/` reader of `plan.targets[]` outside the code that finishes records born in the repository
// (PRD 2011, s13). A product's repositories come from the product (its links, its packs);
// `plan.targets` is the plan repository's own list, kept beside the product way. Each file is read
// from its syntax tree (a comment or a string that says "plan.targets" is no read), and a read is a
// property access `.targets` on `plan` or `planSection`. Every file that reads it is listed below with
// the reason, and a file that stops reading it must leave the list, so the list never goes stale.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const kitRoot = fileURLToPath(new URL('..', import.meta.url));

/** The files, from the kit's root, that may read `plan.targets`, and why. */
const ALLOWED: Readonly<Record<string, string>> = {
  // The one accessor every other reader goes through (`targetsOf`), and the plan repository's own code.
  'lib/plan-repo/target-list.ts': 'the accessor',
  'lib/plan-repo/copy-flow.ts': 'copy-flow of a plan repository',
  // The code that finishes records born in the repository.
  'lib/roadmap/push.ts': 'roadmap push of a roadmap in the repository',
  'lib/roadmap/index.ts': 'roadmap reading of a roadmap in the repository',
  'lib/bug/fixes.ts': 'omni bug: the Fixes table of a bug record in the repository',
  'lib/knowledge/copies.ts': 'imported knowledge copies of a plan repository',
  // The plan repository's own commands and checks.
  'bin/commands/board.ts': 'the board of a plan repository, and the context with the product targets',
  'bin/commands/flow.ts': 'omni flow --repo of a plan repository',
  'bin/commands/kb.ts': 'omni kb of an imported copy',
  'bin/commands/plan.ts': 'omni plan check of a multi-repository plan',
  'bin/commands/product.ts': 'omni product import sends plan.targets',
  'bin/commands/targets.ts': 'omni targets',
  'lib/inbox/plan-grade.ts': 'the grade of a multi-repository plan',
  'lib/sync/kit.ts': 'omni update of the targets',
  'lib/sync/knowledge.ts': 'omni sync of imported copies',
};

/** Every non-test TypeScript file under `dir`, from the kit's root, `dist` and `node_modules` left out. */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === 'dist' || name === 'node_modules' || name === 'test') return [];
    if (statSync(path).isDirectory()) return sources(path);
    return name.endsWith('.ts') && !name.endsWith('.test.ts') ? [relative(kitRoot, path)] : [];
  });
}

/** Whether `text` reads `.targets` of a `plan` or a `planSection`. */
function readsPlanTargets(text: string): boolean {
  const file = ts.createSourceFile('x.ts', text, ts.ScriptTarget.Latest, true);
  let found = false;
  const visit = (node: ts.Node): void => {
    if (ts.isPropertyAccessExpression(node) && node.name.text === 'targets' && /(^|\.)(plan|planSection)$/.test(node.expression.getText(file))) found = true;
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

describe('plan.targets readers', () => {
  it('sees a read through plan, plan?. and planSection, and no comment, string or other .targets', () => {
    expect(readsPlanTargets('const t = ctx.config.plan.targets;')).toBe(true);
    expect(readsPlanTargets('const t = ctx.config.plan?.targets ?? [];')).toBe(true);
    expect(readsPlanTargets('const t = planSection.targets;')).toBe(true);
    expect(readsPlanTargets('// plan.targets\nconst s = "plan.targets"; const u = facts.across.targets;')).toBe(false);
  });

  it('is read by no file outside the allowed list, and the list holds no file that stopped reading it', () => {
    const readers = sources(kitRoot).filter((path) => readsPlanTargets(readFileSync(join(kitRoot, path), 'utf8'))).sort();
    expect(readers.filter((path) => !(path in ALLOWED))).toEqual([]);
    expect(Object.keys(ALLOWED).filter((path) => !readers.includes(path)).sort()).toEqual([]);
  });

  it('keeps next and care off it: they go through targetsOf', () => {
    for (const path of ['bin/commands/next.ts', 'bin/commands/care.ts']) {
      const text = readFileSync(join(kitRoot, path), 'utf8');
      expect(readsPlanTargets(text)).toBe(false);
      expect(text).toContain('targetsOf(');
    }
  });
});
