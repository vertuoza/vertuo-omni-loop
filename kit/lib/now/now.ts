// What a Claude session is on now (PRD 1208's spec, "omni now"): pure. The one reading that the
// status line, the `omni-hud` band and any other agent draw from. `read.ts` gathers the facts; this
// module turns them into the answer and its plain lines.
//
// - **The answer** is `{ headline, work, doing }`. `headline` is a running loop or the roadmap it
//   drives, or a recorded roadmap (s3): `{ kind: 'loop', links }`, or
//   `{ kind: 'roadmap', number, progress: '<m>/<k> merged', links }`; `work` is what the session is
//   on, or `null`; `doing` is one line, or `null`. Under a loop's last step, `doing` is that step,
//   `step <k>: <action> PRD <n> · <result>`.
// - **A PRD's work** is `{ kind: 'prd', number, topic, stage, slices, links }`. Its stage is PRD
//   324's (`in review`, `inbox`, `outbox`, `shipped`), worded `building` instead of `outbox` while a
//   slice of its cached board is not merged; a board with no slice, or none at all, leaves it as PRD
//   324 says. Its slices are those of the board in flight (`in-flight`, `claimed-stale`) or `stuck`,
//   in the board's order, each `{ id, name, state }` with `name` `null` when the board keeps none.
// - **A fix's work** (PRD 1208's s2) is `{ kind: 'bug' | 'visual', number, topic, stage, slices,
//   links }`: its stage `merged` once its folder is on the base, else `fix PR open` while its links
//   hold its pull request (s4), else `in progress`; it has no slices.
// - **The links** (s4) are those the background refresh kept for the work and for a roadmap headline
//   (`links.ts`), and the Loop page's for a loop headline: `linked()` adds them to an answer.
// - **Doing**, for a PRD with slices in flight: `building <id> <name>, <id> <name>`; else `null`.
// - **The plain lines**: the headline when there is one (`roadmap 7 · 3/7 merged`, `loop`), then the work (`PRD <n> <topic> · <stage>`, `bug #<n> <topic> · <stage>`), then, when there is one, a line of
//   what it is doing and what is stuck (`building s3 tabs · stuck s5`), and last the approval wait's
//   line when there is one. The session on nothing prints the status line's own no-PRD line, or the
//   wait's line alone.
// - **The approval wait** (PRD 1322's s5, `wait.ts`), only while `omni wait approval` has something
//   to show: `wait: { prd, line, toast, until }`, the line the band draws, `toast` while it is the
//   approved or voided line highlighted until `until` (milliseconds). No wait, no `wait` key.
import type { IssueNumber, PrdNumber } from '../ids.ts';
import type { NamedSlice } from '../statusline/board-cache.ts';
import { IN_FLIGHT, MERGED, OUTBOX, STUCK } from '../statusline/stage.ts';
import type { PrdStage } from '../statusline/stage.ts';

const BUILDING = 'building';

/** A PRD's stage as `omni now` words it. */
export type WorkStage = PrdStage | typeof BUILDING;

/** A link of what the session is on. */
export type NowLink = { label: string; href: string };

/** A slice being built, or stuck. */
export type NowSlice = { id: string; name: string | null; state: string };

/** A fix's stage: `merged` once its folder is on the base, else `fix PR open` while its pull request is, else `in progress`. */
export type FixStage = 'in progress' | 'fix PR open' | 'merged';

/** The kinds of fix a session works on. */
export type FixKind = 'bug' | 'visual';

/** What the session works on: a PRD, or a bug or visual fix (which has no slices). */
export type NowWork =
  | { kind: 'prd'; number: PrdNumber; topic: string; stage: WorkStage | null; slices: NowSlice[]; links: NowLink[] }
  | { kind: FixKind; number: IssueNumber; topic: string; stage: FixStage; slices: NowSlice[]; links: NowLink[] };

/** The loop, or the roadmap it drives, above the work. */
export type NowHeadline = { kind: 'loop' | 'roadmap'; number?: number; progress?: string; links: NowLink[] };

/** The approval wait's line, a toast until `until` (milliseconds) when `toast`. */
export type NowWait = { prd: PrdNumber; line: string; toast: boolean; until: number | null };

/** `omni now`'s answer; `wait` only while an approval wait shows something. */
export type Now = { headline: NowHeadline | null; work: NowWork | null; doing: string | null; wait?: NowWait };

/** The answer for a session on nothing. */
export const NOTHING: Now = Object.freeze({ headline: null, work: null, doing: null });

const NO_WORK_LINE = 'no PRD · /omni:brainstorm to start';
const SEPARATOR = ' · ';

/** The stage of a PRD whose PRD 324 stage is `stage`, with the slices of its cached board. */
export function workStage(stage: PrdStage | null, slices: readonly NamedSlice[] | null): WorkStage | null {
  if (stage !== OUTBOX || !slices || slices.length === 0) return stage;
  return slices.every((slice) => slice.state === MERGED) ? OUTBOX : BUILDING;
}

const inFlight = (slice: NowSlice): boolean => IN_FLIGHT.includes(slice.state);
const label = ({ id, name }: NowSlice): string => (name ? `${id} ${name}` : id);

/** The answer for a session on PRD `number` (`topic`), at PRD 324's `stage`, with its cached board's `slices`. */
export function nowOfPrd({ number, topic, stage, slices }: { number: PrdNumber; topic: string; stage: PrdStage | null; slices: readonly NamedSlice[] | null }): Now {
  const shown = (slices ?? [])
    .filter((slice) => IN_FLIGHT.includes(slice.state) || slice.state === STUCK)
    .map(({ id, name, state }) => ({ id, name: name ?? null, state }));
  const building = shown.filter(inFlight);
  return {
    headline: null,
    work: { kind: 'prd', number, topic, stage: workStage(stage, slices), slices: shown, links: [] },
    doing: building.length > 0 ? `${BUILDING} ${building.map(label).join(', ')}` : null,
  };
}

/** The answer for a session on the `kind` fix of issue `number` (`topic`), `merged` once its folder is on the base. */
export function nowOfFix({ kind, number, topic, merged }: { kind: FixKind; number: IssueNumber; topic: string; merged: boolean }): Now {
  return { headline: null, work: { kind, number, topic, stage: merged ? 'merged' : 'in progress', slices: [], links: [] }, doing: null };
}

/** A loop that drives no roadmap, as the headline, with its page's link when it has one. */
export function loopHeadline(page: string | null): NowHeadline {
  return { kind: 'loop', links: page ? [{ label: 'loop page', href: page }] : [] };
}

/** The label of a fix's pull request link, which reads its stage as `fix PR open`. */
export const FIX_PR = 'fix PR';

/** The links kept for the work, or the roadmap, of `kind` numbered `n`. */
export type LinksOf = (kind: 'prd' | FixKind | 'roadmap', n: number) => NowLink[];

/** `answer` with the links `linksOf` keeps for its work and its roadmap headline; a fix not merged
 * whose links hold its pull request reads `fix PR open`. A loop headline keeps its own. */
export function linked(answer: Now, linksOf: LinksOf): Now {
  const { headline, work } = answer;
  const headlineLinks = headline?.kind === 'roadmap' && headline.number !== undefined ? linksOf('roadmap', headline.number) : null;
  const links = work ? linksOf(work.kind, work.number) : [];
  const prOpen = links.some((link) => link.label.startsWith(`${FIX_PR} `));
  return {
    ...answer,
    headline: headline && headlineLinks ? { ...headline, links: headlineLinks } : headline,
    work: work && (work.kind === 'prd' ? { ...work, links } : { ...work, links, stage: work.stage === 'in progress' && prOpen ? 'fix PR open' : work.stage }),
  };
}

/** Roadmap `number` as the headline, `merged` of its `rows` PRDs shipped. */
export function roadmapHeadline(number: IssueNumber, merged: number, rows: number): NowHeadline {
  return { kind: 'roadmap', number, progress: `${merged}/${rows} ${MERGED}`, links: [] };
}

/** The step a loop's last tick recorded. */
export type LastStep = { step: number; prd: PrdNumber; action: string; result: string };

/** `answer` under `headline`: its work, and the loop's `last` step as what it is doing, else its own doing line. */
export function underHeadline(answer: Now, headline: NowHeadline, last: LastStep | null): Now {
  const doing = last ? `step ${last.step}: ${last.action} PRD ${last.prd}${SEPARATOR}${last.result}` : answer.doing;
  return { headline, work: answer.work, doing };
}

/** The work's name: `PRD <n> <topic>`, or `<kind> #<n> <topic>` for a fix. */
const workName = ({ kind, number, topic }: NowWork): string => (kind === 'prd' ? `PRD ${number} ${topic}` : `${kind} #${number} ${topic}`);

/** The headline's line: `roadmap <n> · <m>/<k> merged`, or `loop`. */
const headlineLine = ({ kind, number, progress }: NowHeadline): string => [number === undefined ? kind : `${kind} ${number}`, ...(progress ? [progress] : [])].join(SEPARATOR);

/** The work's lines: its name and stage, then what it is doing and what is stuck. */
function workLines(work: NowWork | null, doing: string | null): string[] {
  const stuck = work?.slices.filter((slice) => slice.state === STUCK) ?? [];
  const status = [...(doing ? [doing] : []), ...(stuck.length > 0 ? [`stuck ${stuck.map(label).join(', ')}`] : [])];
  const head = work ? [[workName(work), ...(work.stage ? [work.stage] : [])].join(SEPARATOR)] : [];
  return status.length > 0 ? [...head, status.join(SEPARATOR)] : head;
}

/** The answer as plain lines: the headline, when there is one, then the work. */
export function nowLines({ headline, work, doing, wait }: Now): string[] {
  const waitLines = wait ? [wait.line] : [];
  if (!work && !headline) return waitLines.length > 0 ? waitLines : [NO_WORK_LINE];
  return [...(headline ? [headlineLine(headline)] : []), ...workLines(work, doing), ...waitLines];
}

/** `answer` with the approval `wait` it shows, when there is one. */
export const withWait = (answer: Now, wait: NowWait | null): Now => (wait ? { ...answer, wait } : answer);
