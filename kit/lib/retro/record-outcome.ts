// PRD 2338, s3: `omni retro outcome` — one kept lesson's outcome written where the retro keeps it: the
// `retro.json` of its PRD (under the run that kept the lesson, beside its `issues`) and, when the PRD's
// `retro.md` has the lesson's finding, the line `outcomeLine` renders at the end of that finding.
//
// Refuses, writing nothing: a PRD with no retro, a finding no run kept, a lesson that already has an
// outcome (an outcome is never rewritten), and an outcome `outcomeProblem` finds unsound. Pure but for
// reading and writing those two files; the CLI half is `kit/bin/commands/retro.ts`.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import type { Context } from '../context.ts';
import type { PrdNumber } from '../ids.ts';
import { messageOf } from '../narrow.ts';
import { outcomeLine, outcomeProblem } from './outcome.ts';
import type { LessonOutcome } from './outcome.ts';

const Loose = z.record(z.string(), z.unknown());
const RunsSchema = z.array(Loose);
const KeyedSchema = z.record(z.string(), z.unknown()).optional();

export type Recorded = { ok: true; json: string; markdown: string | null } | { ok: false; reason: string };

const refuse = (reason: string): Recorded => ({ ok: false, reason });

/** The index of the last run whose `issues` keep `finding`, or -1. */
function keptBy(runs: readonly Record<string, unknown>[], finding: string): number {
  return runs.findLastIndex((run) => {
    const issues = KeyedSchema.safeParse(run.issues);
    return issues.success && issues.data !== undefined && finding in issues.data;
  });
}

/** Whether any run already gives `finding` an outcome. */
function hasOutcome(runs: readonly Record<string, unknown>[], finding: string): boolean {
  return runs.some((run) => {
    const outcomes = KeyedSchema.safeParse(run.outcomes);
    return outcomes.success && outcomes.data !== undefined && finding in outcomes.data;
  });
}

/** `retro.md`'s lines with `line` added at the end of `finding`'s section; `null` when it has no such finding. */
export function withOutcomeLine(markdown: string, finding: string, line: string): string | null {
  const lines = markdown.split('\n');
  const heading = `\`${finding}\``;
  const start = lines.findIndex((text) => text.startsWith('### ') && (text.endsWith(` — ${heading}`) || text.includes(` — ${heading} · `)));
  if (start === -1) return null;
  let end = lines.findIndex((text, index) => index > start && /^#{1,3} /.test(text));
  if (end === -1) end = lines.length;
  while (lines[end - 1]?.trim() === '') end -= 1; // the heading is never blank: the loop stops at it
  return [...lines.slice(0, end), line, ...lines.slice(end)].join('\n');
}

/** Records `outcome` on `finding`'s lesson in PRD `prd`'s retro, or says why it cannot. */
export function recordOutcome({ ctx, prd, finding, outcome }: { ctx: Pick<Context, 'root' | 'layout'>; prd: PrdNumber; finding: string; outcome: LessonOutcome }): Recorded {
  const where = ctx.layout.whereIs(prd);
  if (where === null) return refuse(`PRD ${String(prd)} has no folder in ${ctx.layout.dirs.inbox} or ${ctx.layout.dirs.shipped}`);
  const json = `${where.dir}/retro.json`;
  if (!existsSync(join(ctx.root, json))) return refuse(`${json} is missing — PRD ${String(prd)} has no retro`);
  let doc: Record<string, unknown>;
  try {
    doc = Loose.parse(JSON.parse(readFileSync(join(ctx.root, json), 'utf8')));
  } catch (error) {
    return refuse(`${json} is not a retro record — ${messageOf(error)}`);
  }
  const parsedRuns = RunsSchema.safeParse(doc.runs);
  if (!parsedRuns.success) return refuse(`${json} is not a retro record — runs: ${parsedRuns.error.message}`);
  const runs = parsedRuns.data;
  const run = keptBy(runs, finding);
  if (run === -1) return refuse(`PRD ${String(prd)} kept no lesson for \`${finding}\``);
  if (hasOutcome(runs, finding)) return refuse(`PRD ${String(prd)}, lesson \`${finding}\` already has an outcome — an outcome is never rewritten`);
  const problem = outcomeProblem(outcome, { ctx });
  if (problem !== null) return refuse(problem);

  const written = runs.map((each, index) => {
    if (index !== run) return each;
    const outcomes = KeyedSchema.parse(each.outcomes) ?? {};
    return { ...each, outcomes: { ...outcomes, [finding]: outcome } };
  });
  const markdownFile = `${where.dir}/retro.md`;
  const markdownPath = join(ctx.root, markdownFile);
  const marked = existsSync(markdownPath) ? withOutcomeLine(readFileSync(markdownPath, 'utf8'), finding, outcomeLine(outcome)) : null;
  writeFileSync(join(ctx.root, json), `${JSON.stringify({ ...doc, runs: written }, null, 2)}\n`);
  if (marked !== null) writeFileSync(markdownPath, marked);
  return { ok: true, json, markdown: marked === null ? null : markdownFile };
}
