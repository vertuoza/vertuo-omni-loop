/**
 * **Where roadmaps live** (PRD 1162, slice s4): one folder `<nnnn>-<topic>` per roadmap under the
 * inbox's `roadmaps/`, numbered by the roadmap's issue, holding `roadmap.md`. `roadmaps` is no
 * `<prd>-<topic>` name, so no reader of PRD folders ever takes it for a PRD.
 *
 * This module reads them from disk and grades each through `parse.ts` and `grade.ts`, reading each
 * row's spec for its `blocked-by` and, in a plan repository, the config's targets. Every violation
 * it returns names the roadmap's file first.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { readRepoFile } from '../check-report.ts';
import type { Context } from '../context.ts';
import type { IssueNumber, PrdNumber } from '../ids.ts';
import { parseIssue } from '../ids.ts';
import { parseSpec } from '../inbox/inbox.ts';
import { prdFoldersIn } from '../layout.ts';
import { gradeRoadmap } from './grade.ts';
import type { PrdFacts } from './grade.ts';
import { parseRoadmap } from './parse.ts';
import type { Roadmap } from './parse.ts';

/** What reading a roadmap needs of a context. */
type Ctx = Pick<Context, 'root' | 'layout' | 'config'>;

/** One roadmap folder: its number, its folder and its file. */
export type RoadmapFile = { number: IssueNumber; dir: string; file: string };

/** A roadmap read and graded: the record when it parses, and every violation, each naming the file. */
export type GradedRoadmap = RoadmapFile & { roadmap: Roadmap | null; violations: string[] };

/** The folder that holds the roadmaps, under the inbox. */
function roadmapsDir(ctx: Pick<Context, 'layout'>): string {
  return `${ctx.layout.dirs.inbox}/roadmaps`;
}

/** Every roadmap folder of the inbox, in number order. */
export function roadmapFiles(ctx: Pick<Context, 'root' | 'layout'>): RoadmapFile[] {
  const dir = roadmapsDir(ctx);
  return prdFoldersIn(join(ctx.root, dir)).map(({ name, prd }) => ({
    number: parseIssue(prd),
    dir: `${dir}/${name}`,
    file: `${dir}/${name}/roadmap.md`,
  }));
}

/** What PRD n's folder says of it, for the grade. */
function prdFacts(ctx: Ctx, prd: PrdNumber): PrdFacts {
  const specFile = ctx.layout.specPath(prd);
  if (specFile === null) return 'no-folder';
  if (!existsSync(join(ctx.root, specFile))) return 'unreadable';
  const parsed = parseSpec(readRepoFile(ctx, specFile), { file: specFile });
  return parsed.ok ? { blockedBy: parsed.record.blockedBy } : 'unreadable';
}

/** One roadmap, read, parsed and graded. */
function gradeRoadmapFile(ctx: Ctx, entry: RoadmapFile): GradedRoadmap {
  const at = (message: string) => `${entry.file}: ${message}`;
  if (!existsSync(join(ctx.root, entry.file))) return { ...entry, roadmap: null, violations: [at('roadmap.md is missing.')] };
  const parsed = parseRoadmap(readRepoFile(ctx, entry.file));
  if (!parsed.ok) return { ...entry, roadmap: null, violations: parsed.errors.map(at) };
  const { roadmap } = parsed;
  const violations: string[] = [];
  if (roadmap.roadmap !== entry.number) {
    violations.push(`roadmap ${roadmap.roadmap} does not agree with its folder's number, ${entry.number}.`);
  }
  const targets = ctx.config.plan?.targets ?? null;
  violations.push(...gradeRoadmap(roadmap, { prdFacts: (prd) => prdFacts(ctx, prd), targets }));
  return { ...entry, roadmap, violations: violations.map(at) };
}

/** Every roadmap of the inbox, graded. */
export function gradeRoadmaps(ctx: Ctx): GradedRoadmap[] {
  return roadmapFiles(ctx).map((entry) => gradeRoadmapFile(ctx, entry));
}

/** Every violation of every roadmap of the inbox: what `omni check inbox` adds to its own. */
export function findRoadmapViolations(ctx: Ctx): string[] {
  return gradeRoadmaps(ctx).flatMap((graded) => graded.violations);
}
