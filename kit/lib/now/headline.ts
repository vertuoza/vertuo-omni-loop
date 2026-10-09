// What sits above a session's work (PRD 1208's spec, "What a session is on", slice s3): the loop this
// checkout keeps running, or the roadmap it drives, or the roadmap the session's record names.
//
// - **A running loop** is `.omni-loop/local/loop.json` (PRD 1139) in the checkout, live or sleeping by
//   the app's rule (`loopState`); a parked, stopped or silent loop is no headline. It is the roadmap
//   its `roadmap` names when that roadmap has a folder, else the loop, linked to its Loop page
//   (`<ask.url>/app/loop/<loopId>`, PRD 1208's s4) when `ask.url` is set. Its `last` step (absent in a
//   file of PRD 1139's shape) names the work and what it is doing.
// - **A roadmap record** (`omni roadmap check|push <n>`, `omni next --roadmap <n>`), with no running
//   loop, is roadmap n as the headline, with no work under it.
// - **A roadmap** is `<m>/<k> merged`: the PRDs of its rows whose folder is in shipped on the base,
//   over its rows. Its `roadmap.md` is read from the inbox's `roadmaps/` in the checkout, else on the
//   base; one with no folder, or that does not parse, is none.
import { readRepoFile } from '../check-report.ts';
import type { Context, ExecText } from '../context.ts';
import type { IssueNumber } from '../ids.ts';
import { parseFolderName } from '../layout.ts';
import { loopState, readLocalLoop } from '../loop/local.ts';
import { roadmapFiles } from '../roadmap/index.ts';
import { parseRoadmap } from '../roadmap/parse.ts';
import { loopHeadline, roadmapHeadline } from './now.ts';
import type { LastStep, NowHeadline } from './now.ts';
import { attempt, foldersAt, textOnBase } from './tree.ts';

const RUNNING = ['live', 'sleeping'];

/** Roadmap `number`'s `roadmap.md`: in the checkout, else on `base`; `null` with no folder. */
function roadmapText(ctx: Context, number: IssueNumber, base: string | null, exec: ExecText): string | null {
  const local = roadmapFiles(ctx).find((entry) => entry.number === number);
  const text = local ? attempt<string | null>(() => readRepoFile(ctx, local.file), null) : null;
  if (text !== null) return text;
  const dir = `${ctx.layout.dirs.inbox}/roadmaps`;
  const folder = foldersAt(ctx, dir, base, exec).base.find((name) => parseFolderName(name)?.prd === number);
  return folder ? textOnBase(ctx, base, `${dir}/${folder}/roadmap.md`, exec) : null;
}

/** Roadmap `number` as the headline, or `null` when it has no folder or does not parse. */
export function roadmapNamed(ctx: Context, number: IssueNumber, base: string | null, exec: ExecText): NowHeadline | null {
  const text = roadmapText(ctx, number, base, exec);
  const parsed = text === null ? null : parseRoadmap(text);
  if (!parsed?.ok) return null;
  const shipped = new Set(foldersAt(ctx, ctx.layout.dirs.shipped, base, exec).base.map((name) => parseFolderName(name)?.prd));
  const merged = parsed.roadmap.prds.filter((row) => shipped.has(row.prd)).length;
  return roadmapHeadline(number, merged, parsed.roadmap.prds.length);
}

/** The Loop page of loop `loopId` on the Omni page (`<ask.url>/app/loop/<id>`), or `null` without `ask.url`. */
function loopPage(ctx: Context, loopId: string): string | null {
  const askUrl = ctx.config.ask.url;
  return askUrl ? `${askUrl.replace(/\/+$/, '')}/app/loop/${encodeURIComponent(loopId)}` : null;
}

/** The loop this checkout keeps running, live or sleeping at `now`, as the headline; `null` for none. */
export function runningLoop(ctx: Context, { base, exec, now }: { base: string | null; exec: ExecText; now: number }): { headline: NowHeadline; last: LastStep | null } | null {
  const loop = readLocalLoop(ctx.root);
  if (!loop || !RUNNING.includes(loopState(loop, now))) return null;
  const roadmap = loop.roadmap ? roadmapNamed(ctx, loop.roadmap, base, exec) : null;
  return { headline: roadmap ?? loopHeadline(loopPage(ctx, loop.loopId)), last: loop.last ?? null };
}
