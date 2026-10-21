// `omni check retro` (PRD 2338): the outcomes of the retros' kept lessons, graded. Every `retro.json`
// of a PRD folder, in the inbox and shipped, is read; each outcome any of its runs records must be
// sound (`outcomeProblem`): a `became` naming a filled playbook slot, a `staysHere` giving a reason. A
// retro from before PRD 2338 records none, and passes.
//
// `retro` names the PRD whose retro a retro PR carries (`--retro`): there, every kept lesson must also
// have an outcome, so the retro PR stays red until each one became a rule or says why it stays here. A
// kept lesson is a finding the judge kept, the key of its retro issue in a run's `issues`; its outcome
// is the one any run records under the same key, so a day-14 run may settle what the merge run kept.
//
// Pure but for reading the repository's files; the CLI half is `kit/bin/commands/check.ts`.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import type { Context } from '../context.ts';
import { IssueNumberSchema, PrdNumberSchema } from '../ids.ts';
import type { IssueNumber, PrdNumber } from '../ids.ts';
import { prdFoldersIn } from '../layout.ts';
import { messageOf } from '../narrow.ts';
import { outcomeProblem } from './outcome.ts';

/** The file a PRD folder keeps its retro in. */
const RETRO_FILE = 'retro.json';

/** As much of a `retro.json` as the check reads: each run's kept lessons (by their issues) and outcomes. */
const RetroFileSchema = z.object({
  prd: PrdNumberSchema,
  runs: z.array(
    z.object({
      issues: z.record(z.string(), z.object({ number: IssueNumberSchema })).optional(),
      outcomes: z.record(z.string(), z.unknown()).optional(),
    }),
  ),
});
type RetroFile = z.infer<typeof RetroFileSchema>;

/** What `gradeRetros` found: every violation, the retros read, the outcomes graded, and the kept lessons of `retro` (`null` without it). */
export type RetroGrade = { violations: string[]; retros: number; outcomes: number; kept: number | null };

type Read = { ok: true; doc: RetroFile } | { ok: false; violation: string };

/** The `retro.json` at `file`, parsed, or the one violation saying why it cannot be read. */
function readRetro(root: string, file: string): Read {
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(join(root, file), 'utf8'));
  } catch (error) {
    return { ok: false, violation: `${file}: not JSON — ${messageOf(error)}` };
  }
  const parsed = RetroFileSchema.safeParse(data);
  if (parsed.success) return { ok: true, doc: parsed.data };
  const [issue] = parsed.error.issues;
  return { ok: false, violation: `${file}: not a retro record — ${issue ? `${issue.path.join('.')}: ${issue.message}` : 'unreadable'}` };
}

/** Every kept lesson's retro issue, by its finding id, across the runs: a later run's issue wins. */
function keptLessons(doc: RetroFile): Map<string, IssueNumber> {
  const kept = new Map<string, IssueNumber>();
  for (const run of doc.runs) for (const [finding, issue] of Object.entries(run.issues ?? {})) kept.set(finding, issue.number);
  return kept;
}

/** How a violation names its lesson: the PRD, the finding id and, when it has one, its retro issue. */
function lessonOf(doc: RetroFile, finding: string, kept: ReadonlyMap<string, IssueNumber>): string {
  const issue = kept.get(finding);
  return `PRD ${String(doc.prd)}, lesson \`${finding}\`${issue === undefined ? '' : ` (#${String(issue)})`}`;
}

/** The `retro.json` of every PRD folder in the inbox, then shipped, each in name order. */
function retroFiles(ctx: Pick<Context, 'root' | 'layout'>): string[] {
  const { inbox, shipped } = ctx.layout.dirs;
  return [inbox, shipped].flatMap((dir) =>
    prdFoldersIn(join(ctx.root, dir))
      .map(({ name }) => `${dir}/${name}/${RETRO_FILE}`)
      .filter((file) => existsSync(join(ctx.root, file))),
  );
}

/** One retro's outcomes graded: the violations, how many outcomes, and the findings that have one. */
function gradeOutcomes(ctx: Pick<Context, 'root' | 'layout'>, file: string, doc: RetroFile): { violations: string[]; outcomes: number; settled: Set<string> } {
  const kept = keptLessons(doc);
  const entries = doc.runs.flatMap((run) => Object.entries(run.outcomes ?? {}));
  const violations = entries.flatMap(([finding, outcome]) => {
    const problem = outcomeProblem(outcome, { ctx });
    return problem === null ? [] : [`${file}: ${lessonOf(doc, finding, kept)}: ${problem}`];
  });
  return { violations, outcomes: entries.length, settled: new Set(entries.map(([finding]) => finding)) };
}

/** Each kept lesson of the retro at `file` that no run gives an outcome, as a violation. */
function unsettled(file: string, doc: RetroFile, settled: ReadonlySet<string>): string[] {
  const kept = keptLessons(doc);
  return [...kept.keys()]
    .filter((finding) => !settled.has(finding))
    .map((finding) => `${file}: ${lessonOf(doc, finding, kept)}: kept, with no outcome — it becomes a rule (became: playbook/<form>#<slot>) or stays here (staysHere: <why>)`);
}

/** Grades every retro's outcomes and, for PRD `retro`, that each kept lesson has one. */
export function gradeRetros({ ctx, retro }: { ctx: Pick<Context, 'root' | 'layout'>; retro: PrdNumber | null }): RetroGrade {
  const files = retroFiles(ctx);
  const own = retro === null ? null : ownRetro(ctx, retro);
  const grade: RetroGrade = { violations: own?.ok === false ? [own.violation] : [], retros: files.length, outcomes: 0, kept: null };
  for (const file of files) {
    const read = readRetro(ctx.root, file);
    if (!read.ok) {
      grade.violations.push(read.violation);
      continue;
    }
    const graded = gradeOutcomes(ctx, file, read.doc);
    grade.violations.push(...graded.violations);
    grade.outcomes += graded.outcomes;
    if (own?.ok !== true || own.file !== file) continue;
    grade.kept = keptLessons(read.doc).size;
    grade.violations.push(...unsettled(file, read.doc, graded.settled));
  }
  return grade;
}

/** Where PRD `prd`'s retro is, or the violation saying it has none to read. */
function ownRetro(ctx: Pick<Context, 'root' | 'layout'>, prd: PrdNumber): { ok: true; file: string } | { ok: false; violation: string } {
  const where = ctx.layout.whereIs(prd);
  if (where === null) {
    const { inbox, shipped } = ctx.layout.dirs;
    return { ok: false, violation: `PRD ${String(prd)}: no folder in ${inbox} or ${shipped} — its retro cannot be read` };
  }
  const file = `${where.dir}/${RETRO_FILE}`;
  if (!existsSync(join(ctx.root, file))) return { ok: false, violation: `${file}: missing — PRD ${String(prd)}'s retro PR holds its retro here` };
  return { ok: true, file };
}
