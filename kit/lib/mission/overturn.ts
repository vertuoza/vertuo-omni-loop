// A person overturns a decision of the fleet (PRD 2896 s11, spec "6. The committee, at `alone`", criteria 17 and 18). Pure: what a
// decision is called, what the mission's events say of the fleet's decisions, and the words that show them. `omni mission
// overturn`, the Omni app and the Missions tab read the same functions.
//
//   the decision   one the committee carried: the approval of a PRD (`2901`) or the answer to one of its items (`2901/s2-01`).
//                  It is recorded as its `decided` event, which stays as it was, never edited (BR-PRODUCT-12)
//   the overturn   a person's own event, `overturned`, added beside it: signed with their login, naming the decision. It voids an
//                  approval for the mission, reopens an answered item for that person, and takes the PRD off the branch
//   the lists      the mission pull request's body opens with **Approved by the fleet** and **Answered by the fleet**, each line with
//                  the verdicts; the Missions tab shows the trust line, `<n> decisions by the fleet · <k> overturned`
import { PrdNumberSchema, type PrdNumber } from '../ids.ts';

/** The event a person's overturn is recorded as. */
const OVERTURNED = 'overturned';

/** A decision of the fleet: a PRD's approval (`item` null) or the answer to one of its items. */
export type DecisionRef = { prd: PrdNumber; item: string | null };

const REF = /^([1-9][0-9]*)(?:\/([a-z0-9][a-z0-9-]*))?$/;

/** The name a decision goes by on the command line: `2901` for an approval, `2901/s2-01` for an answer. */
export const refOf = ({ prd, item }: DecisionRef): string => (item === null ? String(prd) : `${String(prd)}/${item}`);

/** The decision a name stands for; null for anything else. */
export function parseRef(text: string): DecisionRef | null {
  const match = REF.exec(text);
  const prd = PrdNumberSchema.safeParse(Number(match?.[1]));
  return match && prd.success ? { prd: prd.data, item: match[2] ?? null } : null;
}

/** What a member's overturn says in the mission's events: who, and which decision. Read back by {@link decisionsOf}. */
export const overturnSentence = (login: string, ref: DecisionRef, why: string): string => `${login} overturned fleet decision ${refOf(ref)}: ${why}`;

const OVERTURN = /^\S+ overturned fleet decision (\S+):/;
const APPROVED = /^The committee approved PRD ([1-9][0-9]*):/;
const ANSWERED = /^The committee answered ([a-z0-9][a-z0-9-]*) of PRD ([1-9][0-9]*) with option (\S+):/;
const VERDICT = '(?:pm|architect|reviewer) (?:yes|no|unsure|failed|timeout)';
const VERDICTS = new RegExp(`^${VERDICT}(?:, ${VERDICT})*$`);

/** One event of a mission, as far as the decisions read it: oldest first. */
export type DecisionEvent = { kind: string; prd: PrdNumber | null; sentence: string; link?: string | null; actor?: string | null };

/** A decision the committee carried, with the person who overturned it, if one did. */
export type FleetDecision = {
  ref: DecisionRef;
  /** The verdicts the event kept, `pm yes, architect yes, reviewer yes`; null for a decision recorded before they were kept. */
  verdicts: string | null;
  /** The option an answer settled with; null for an approval. */
  option: string | null;
  link: string | null;
  overturnedBy: string | null;
};

/** The verdicts a sentence's rest names; null when it names none. */
function verdictsOf(rest: string): string | null {
  const text = rest.trim().replace(/\.$/, '');
  return VERDICTS.test(text) ? text : null;
}

/**
 * The decisions the committee carried, in the order they were made, from the mission's events (oldest first): each `decided` event,
 * with the person who overturned it when an `overturned` event names it after it. A decision made again after an overturn (a new
 * committee, a new answer) stands on its own.
 */
export function decisionsOf(events: readonly DecisionEvent[]): FleetDecision[] {
  const out: FleetDecision[] = [];
  for (const event of events) {
    if (event.kind === 'decided') {
      const one = carriedOf(event);
      if (one !== null) out.push(one);
    } else if (event.kind === OVERTURNED) {
      const ref = parseRef(OVERTURN.exec(event.sentence)?.[1] ?? '');
      const target = ref === null ? undefined : out.findLast((one) => one.overturnedBy === null && refOf(one.ref) === refOf(ref));
      if (target !== undefined) target.overturnedBy = event.actor ?? 'a person';
    }
  }
  return out;
}

/** The decision a `decided` event records; null for a sentence that names none. */
function carriedOf(event: DecisionEvent): FleetDecision | null {
  const named = namedBy(event.sentence);
  if (named === null) return null;
  const rest = event.sentence.slice(event.sentence.indexOf(':', event.sentence.indexOf('PRD')) + 1);
  return { ref: named.ref, verdicts: verdictsOf(rest), option: named.option, link: event.link ?? null, overturnedBy: null };
}

/** The decision a `decided` sentence names, and the option an answer settled with. */
function namedBy(sentence: string): { ref: DecisionRef; option: string | null } | null {
  const approved = APPROVED.exec(sentence);
  const answered = ANSWERED.exec(sentence);
  const prd = PrdNumberSchema.safeParse(Number(approved?.[1] ?? answered?.[2]));
  return prd.success ? { ref: { prd: prd.data, item: answered?.[1] ?? null }, option: answered?.[3] ?? null } : null;
}

/** `14 decisions by the fleet · 1 overturned`: what the fleet decided, and how often a person overturned it. */
export const trustLine = (decisions: readonly FleetDecision[]): string =>
  `${String(decisions.length)} decisions by the fleet · ${String(decisions.filter((one) => one.overturnedBy !== null).length)} overturned`;

/** One line of a list: the decision, its verdicts, a link, and who overturned it. */
function lineOf(one: FleetDecision): string {
  const name = one.ref.item === null ? `PRD ${String(one.ref.prd)}` : `${one.ref.item} of PRD ${String(one.ref.prd)}, option ${one.option ?? 'A'}`;
  const verdicts = one.verdicts ?? 'every member who sat answered yes';
  const link = one.link === null ? '' : ` ([link](${one.link}))`;
  const overturned = one.overturnedBy === null ? '' : ` · overturned by ${one.overturnedBy}`;
  return `- ${name}: ${verdicts}${link}${overturned}. Overturn it with \`omni mission overturn <mission> ${refOf(one.ref)}\``;
}

/**
 * The two lists a mission pull request's body opens with: **Approved by the fleet** and **Answered by the fleet**, each line with
 * the verdicts. Empty when the fleet decided nothing, so a mission below `alone` has none.
 */
export function decisionLists(decisions: readonly FleetDecision[]): string[] {
  const lists: [string, FleetDecision[]][] = [
    ['Approved by the fleet', decisions.filter((one) => one.ref.item === null)],
    ['Answered by the fleet', decisions.filter((one) => one.ref.item !== null)],
  ];
  return lists.flatMap(([title, ones]) => (ones.length === 0 ? [] : [`**${title}**`, '', ...ones.map(lineOf), '']));
}

/** What `omni mission overturn` tells the person: the decision stays, theirs is added, and what follows. */
export function overturnWords({ ref, branch, onBranch }: { ref: DecisionRef; branch: string | null; onBranch: boolean }): string[] {
  const what =
    ref.item === null
      ? `The fleet's approval of PRD ${String(ref.prd)} no longer counts for this mission: approve it yourself on its page.`
      : `${ref.item} of PRD ${String(ref.prd)} is open again for you: answer it on the PRD's feature pull request.`;
  const dropped = onBranch && branch !== null ? [`PRD ${String(ref.prd)} leaves ${branch} on the mission's next run, and the default branch is never changed.`] : [];
  return [`Overturned fleet decision ${refOf(ref)}. The decision stays as it was recorded; yours is added beside it.`, what, ...dropped];
}
