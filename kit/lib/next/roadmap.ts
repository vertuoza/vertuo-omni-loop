// PRD 1162, slice s7: `omni next --roadmap <n>` — what a roadmap holds each of its PRDs on. Pure: the
// command reads the roadmap, the answers on its issue and every PRD's pull requests, and this says,
// per PRD, whether a tick may take it up. Earlier rows win:
//
// | the PRD                                                        | gate                                        |
// | -------------------------------------------------------------- | ------------------------------------------- |
// | a `person` question blocking it has no answer                  | `park`, naming the question and the issue   |
// | a blocker's feature PR was closed without merging              | `park`: `blocker #<pr> closed unmerged: …`  |
// | a blocker not merged (in a plan repository: the plan PR and    | `hold` its first step: `waits on <repo>#<pr>|
// | every target PR it lands in)                                   | (<id> <title>): <state>`                    |
// | a `## Prerequisites` row that blocks it is not ok, fixed or     | `hold` its first step: `waits on            |
// | ticked on this machine (PRD 1218, s4)                          | prerequisite <id> (<category>): <need>`     |
// | anything else                                                  | none: its steps run                         |
//
// A prerequisite is read from this machine's last `omni roadmap prereqs` result (`prerequisites`, by
// row id), a `person` row also from the ticks on the roadmap issue since then (`ticks`). A row this
// machine never checked holds too, saying how to check it: a check that did not run never counts as
// passed. The first open row in table order names the hold; its link is the Prerequisites tab's.
//
// The waits-on line is s6's (`../roadmap/push.ts`, the one the roadmap's page shows), given the finer
// words only a tick reads: `building wave <k>/<m>` from the blocker's board, `CI red` from its ready
// PR's checks. A PRD with no gate, or whose blockers all merged, runs as `omni next` decides it.
import type { PrdNumber } from '../ids.ts';
import type { Roadmap, RoadmapPrerequisite, RoadmapRow } from '../roadmap/parse.ts';
import { isMet } from '../roadmap/prereqs/run.ts';
import type { PrerequisiteState } from '../roadmap/prereqs/run.ts';
import { prdState, rowStates, waitsOn } from '../roadmap/push.ts';
import type { PrdStanding, PrStanding, RoadmapPrdState } from '../roadmap/push.ts';
import type { PrdFacts } from './decide.ts';
import type { PlanSliceInput } from './plan.ts';

/** What a roadmap holds a PRD on: `park` passes over every step of it, `hold` its first step only. */
export type Gate = { kind: 'hold' | 'park'; why: string; link?: string };

/** What the command read of a roadmap. `standings` and `live` are by row id; `issueLink` is the roadmap
 * issue's link, where `omni roadmap answer` posts. `prerequisites` is this machine's last result, by
 * row id (null or absent: none); `ticks` the rows ticked on the issue; `prerequisitesLink` the
 * Prerequisites tab's link (null or absent: the issue's stands in). */
export type RoadmapRead = {
  roadmap: Roadmap;
  answers: ReadonlyMap<string, string>;
  standings: ReadonlyMap<string, PrdStanding>;
  live: ReadonlyMap<string, string>;
  issueLink: string | null;
  prerequisites?: ReadonlyMap<string, PrerequisiteState> | null;
  ticks?: ReadonlySet<string>;
  prerequisitesLink?: string | null;
};

/** The longest question a park line quotes. */
const QUESTION_MAX = 120;

/** `text` on one line, cut to `max`. */
function cut(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

/** A blocker's state in a tick's finer words, or null to keep the state's own: the wave it builds
 * (the lowest wave with a slice not merged, of the plan's last), or `CI red` on a ready PR. */
export function liveWords(state: RoadmapPrdState, facts: PrdFacts, slices: readonly PlanSliceInput[] | null): string | null {
  if (state === 'building') {
    const waves = (slices ?? []).map((slice) => slice.wave).filter((wave): wave is number => wave !== null);
    if (waves.length === 0) return null;
    const last = Math.max(...waves);
    const open = (slices ?? []).filter((slice) => slice.state !== 'merged' && slice.wave !== null).map((slice) => slice.wave ?? last);
    return `building wave ${open.length > 0 ? Math.min(...open) : last}/${last}`;
  }
  if (state !== 'ready') return null;
  const prs = [facts.feature, ...(facts.across?.targets ?? []).map((target) => target.pr)];
  const red = prs.some((pr) => pr !== null && pr !== 'unreadable' && pr.state === 'OPEN' && !pr.isDraft && pr.checks === 'red');
  return red ? 'CI red' : null;
}

/** The first blocker of `blockedBy` whose feature PR was closed without merging, as its closed PR. */
function closedBlocker(blockedBy: readonly string[], standings: ReadonlyMap<string, PrdStanding>): PrStanding | null {
  for (const id of blockedBy) {
    const standing = standings.get(id);
    if (!standing || prdState(standing) !== 'closed') continue;
    const closed = standing.prs.find((pr) => pr.state === 'CLOSED');
    if (closed) return closed;
  }
  return null;
}

/** The first prerequisite in table order that blocks `row` and is not met on this machine, as the
 * words of its hold; null when none is open. */
function openPrerequisite(row: RoadmapRow, read: RoadmapRead): string | null {
  const blocking = (read.roadmap.prerequisites ?? []).filter((p) => p.blocks === 'all' || p.blocks.includes(row.id));
  for (const prerequisite of blocking) {
    const words = prerequisiteWords(prerequisite, read);
    if (words !== null) return words;
  }
  return null;
}

/** Why `prerequisite` holds what it blocks, or null when it is met: ok, fixed or ticked on this
 * machine, or a `person` row ticked on the issue since. */
function prerequisiteWords(prerequisite: RoadmapPrerequisite, read: RoadmapRead): string | null {
  if (prerequisite.who === 'person' && read.ticks?.has(prerequisite.id)) return null;
  const state = read.prerequisites?.get(prerequisite.id);
  if (state !== undefined && isMet(state)) return null;
  const line = `waits on prerequisite ${prerequisite.id} (${prerequisite.category}): ${prerequisite.need}`;
  return state === undefined ? `${line} — not checked on this machine yet: omni roadmap prereqs ${read.roadmap.roadmap} --fix` : line;
}

/** Each PRD of the roadmap the roadmap holds, with its gate; a PRD free to run is absent. */
export function roadmapGates(read: RoadmapRead): Map<PrdNumber, Gate> {
  const { roadmap, answers, standings, live, issueLink } = read;
  const rows = rowStates(roadmap, standings);
  const gates = new Map<PrdNumber, Gate>();
  const withLink = (gate: Gate, link: string | null): Gate => (link ? { ...gate, link } : gate);
  for (const row of roadmap.prds) {
    const question = roadmap.questions.find((q) => q.kind === 'person' && q.blocks.includes(row.id) && !answers.has(q.id));
    if (question) {
      const why = `waits on a person: roadmap ${roadmap.roadmap} question ${question.id} is not answered (${cut(question.question, QUESTION_MAX)}); answer it with omni roadmap answer ${roadmap.roadmap} ${question.id} "<answer>"`;
      gates.set(row.prd, withLink({ kind: 'park', why }, issueLink));
      continue;
    }
    const closed = closedBlocker(row.blockedBy, standings);
    if (closed) {
      gates.set(row.prd, { kind: 'park', why: `blocker #${closed.number} closed unmerged: fix the roadmap`, link: closed.url });
      continue;
    }
    const wait = waitsOn(row, rows, live);
    if (wait.waitsOn !== null) {
      gates.set(row.prd, withLink({ kind: 'hold', why: wait.waitsOn }, wait.waitsOnUrl));
      continue;
    }
    const open = openPrerequisite(row, read);
    if (open !== null) gates.set(row.prd, withLink({ kind: 'hold', why: open }, read.prerequisitesLink ?? issueLink));
  }
  return gates;
}
