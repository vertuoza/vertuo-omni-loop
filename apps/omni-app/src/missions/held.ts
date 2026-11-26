// What a product PRD's build waits on (bug #3345), pure:
//
//   heldOnOf      the PRDs a build ended held on: the last line of its log that reads `Held: PRD <id> waits on PRD <a> and PRD <b>`
//                 (or `is blocked by`, `waits for`), as /omni:ultra-yolo ends a build its plan holds until other PRDs are in, its
//                 stamp, bold and page link left out. Only PRDs of the same product, never the PRD itself
//   gateRedOf     whether a build ended on its red gate (bug #3345): the hand-off's last line is `/omni:ultra-yolo-fix <id>`, which
//                 /omni:ultra-yolo ends on when open items hold its gate. Its items wait for an answer: no failure, no stop mid-way
//   endedOf       a build that ended ready (bug #3373): the hand-off's last line is `/omni:mega-pr-care <id>`, which /omni:ultra-yolo
//                 ends on once its target PRs read ready; the runner gives an ultra-yolo job no result word, so it reads `ready` here
//   specBlockersOf the PRDs a product PRD's spec says it is blocked by: its front matter's `blocked-by: [27, 28]` (the kit's own
//                 field, kit/lib/schema/front-matter.ts), each a PRD of the same product
//   heldBuildsOf  the builds sent before a PRD of the scope they wait on joined the mission branch (`early`): they built nothing it
//                 holds, so none of their ends counts as a failure, a stop mid-way or a hold of the build itself; with them, every build
//                 that ended on a held line (`held`)
//   withoutHeld   the mission's repairs without the rows of those sent for a held build: none of the 3 per cause or the 9 per mission
import { parseFrontMatterLines } from 'omni-loop/kit/lib/front-matter.ts';
import { parseProductPrdId, productPrdParts, type ProductPrdId } from 'omni-loop/kit/lib/ids.ts';
import { SpecFrontMatterSchema } from 'omni-loop/kit/lib/schema/front-matter.ts';
import type { RepairView } from './repair.ts';
import type { MissionPrd } from './store.prd.ts';
import type { Attempt, ProductRun } from './supervisor.ts';

const STAMP = /^\d{2}:\d{2}:\d{2} /;
const HELD = /^held: PRD (\S+) (?:is blocked by|waits on|waits for) (.+)$/i;

/** A PRD of `prd`'s product named `seq`. */
const sibling = (prd: ProductPrdId, seq: number): ProductPrdId => parseProductPrdId(`${productPrdParts(prd).key}-${String(seq)}`);

/** The PRDs of `prd`'s product that `text` names, `omni-loop-28` or `PRD omni-loop-28`, in order, each once, `prd` left out. */
function siblingsIn(text: string, prd: ProductPrdId): ProductPrdId[] {
  const { key } = productPrdParts(prd);
  const named = [...text.matchAll(/(?<![\w-])([a-z][a-z0-9-]*)-([1-9]\d{0,9})(?![\w-])/g)].flatMap((match) => (match[1] === key ? [sibling(prd, Number(match[2]))] : []));
  return [...new Set(named)].filter((one) => one !== prd);
}

/** The PRDs build `prd`'s log ends held on: its last held line naming `prd`, read up to its page link; none without one. */
export function heldOnOf(log: string, prd: ProductPrdId): ProductPrdId[] {
  const lines = log.split('\n').map((line) => line.trim().replace(STAMP, '').replaceAll('**', '').trim());
  for (const line of lines.reverse()) {
    const match = HELD.exec(line);
    if (match?.[1]?.replace(/[.:,]$/, '') !== prd) continue;
    return siblingsIn((match[2] ?? '').split(' · ')[0] ?? '', prd);
  }
  return [];
}

/**
 * `attempt`, a build of `prd` that ended done with no result word, with what its log `log` says it ended on: ready (bug #3373), held on
 * PRDs, or its red gate.
 */
export function endedOf(attempt: Attempt, log: string, prd: ProductPrdId): Attempt {
  if (endsOn(log, '/omni:mega-pr-care', prd)) return { ...attempt, outcome: 'ready' };
  const heldOn = heldOnOf(log, prd);
  const red = gateRedOf(log, prd);
  return { ...attempt, ...(heldOn.length === 0 ? {} : { heldOn }), ...(red ? { gateRed: true } : {}) };
}

/** The line claude prints when one of the session's hooks fails, which may come after the hand-off (kit/lib/runner/log.ts). */
const HOOK_FAILED = /^[A-Za-z]+ hook \[.*\] failed: /;

/** Whether build `prd`'s log ends on `command <prd>`: its last line, stamp, backticks and a failed hook's line left out, its flags after. */
function endsOn(log: string, command: string, prd: ProductPrdId): boolean {
  const last = log.split('\n').map((line) => line.trim()).filter((line) => line !== '' && !HOOK_FAILED.test(line)).at(-1) ?? '';
  const words = last.replace(STAMP, '').replaceAll('`', '').trim().split(/\s+/);
  return words[0] === command && words[1] === prd;
}

/** Whether build `prd`'s log ends on its red gate: its last line `/omni:ultra-yolo-fix <prd>`. */
export const gateRedOf = (log: string, prd: ProductPrdId): boolean => endsOn(log, '/omni:ultra-yolo-fix', prd);

/** The PRDs product PRD `prd`'s spec says it is blocked by (`blocked-by: [27, 28]`); none when the spec or its field does not read. */
export function specBlockersOf(spec: string | null, prd: ProductPrdId): ProductPrdId[] {
  const block = spec === null ? null : /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(spec);
  if (block === null) return [];
  const raw = parseFrontMatterLines(block[1] ?? '').data['blocked-by'];
  const read = raw === undefined ? null : SpecFrontMatterSchema.shape['blocked-by'].safeParse(raw);
  if (read?.success !== true || read.data === 'none') return [];
  return [...new Set(read.data.map((seq) => sibling(prd, seq)))].filter((one) => one !== prd);
}

/** An event as the run reads it back: a product PRD's names it as `product`. */
type Event = { kind: string; prd: MissionPrd | null; product?: ProductPrdId; job: string | null };

/** What the builds are read against: each PRD's blockers its spec or roadmap names, the scope's PRDs, and those on the branch or merged. */
type EarlyAt = { blockers: ReadonlyMap<MissionPrd, readonly MissionPrd[]>; scope: ReadonlySet<MissionPrd>; done: ReadonlySet<MissionPrd> };

/**
 * The jobs of `runs` sent before a PRD of the scope they wait on (their PRD's blockers, and what their build ended held on) joined
 * the mission branch: not joined yet, or joined after the build's dispatch (`events`, in the order recorded). A blocker done with no
 * join recorded (a repository PRD merged), or a build with no dispatch recorded, makes no build early.
 */
function sentEarly(runs: readonly ProductRun[], events: readonly Event[], { blockers, scope, done }: EarlyAt): Set<string> {
  const at = (kind: string, match: (event: Event) => boolean): number => events.findIndex((event) => event.kind === kind && match(event));
  const early = new Set<string>();
  for (const one of runs) {
    const sent = at('dispatched', (event) => event.job === one.job);
    if (sent < 0) continue;
    const waits = [...(blockers.get(one.prd) ?? []), ...(one.attempts.at(-1)?.heldOn ?? [])].filter((prd) => prd !== one.prd && scope.has(prd));
    const joinedAt = (prd: MissionPrd): number => at('prd-joined', (event) => (event.product ?? event.prd) === prd);
    if (waits.some((prd) => (done.has(prd) ? joinedAt(prd) > sent : true))) early.add(one.job);
  }
  return early;
}

/** The builds of `runs` that were held (bug #3345): those sent early (`sentEarly`), and with them every build that ended on a held line. */
export function heldBuildsOf(runs: readonly ProductRun[], events: readonly Event[], at: EarlyAt): { early: Set<string>; held: Set<string> } {
  const early = sentEarly(runs, events, at);
  const named = runs.filter((one) => (one.attempts.at(-1)?.heldOn ?? []).length > 0).map((one) => one.job);
  return { early, held: new Set([...early, ...named]) };
}

/**
 * The mission's repairs without the rows of those sent for a build of `held` (bug #3345): they spend none of the 3 per cause or the 9
 * per mission. Their jobs stay, so the next repair of the PRD takes a key of its own; an ended job spends nothing by itself.
 */
export function withoutHeld(view: RepairView, held: ReadonlySet<string>): RepairView {
  if (held.size === 0) return view;
  return { ...view, rows: view.rows.filter((row) => !held.has(row.failedJob)) };
}
