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
import { isProductPrdId, PrdNumberSchema, ProductPrdIdSchema, type PrdNumber, type ProductPrdId } from '../ids.ts';
import { baseOfFlag, type BaseOfEntry } from '../ultra/base-of.ts';

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

// ── Landing: the deferred decisions, Agree and Overturn (PRD omni-loop-21 s12, spec "7. Landing") ──────────────────────────────
//
//   the list    every item the fleet's meeting deferred, or carried off the escalation list (s2, s8), with the option taken, its
//               PRD, why it was on the list, and two links, Agree and Overturn; a product PRD's named `omni-loop-15/s2-01`, a
//               repository's `2901/s2-01`
//   agree       a person's own `agreed` event, signed with their login, beside the fleet's decision, which stays as it was
//               (BL-ASK-1); on a repository PRD it also settles the item on the mission branch as theirs ({@link agreeEntry}): one
//               more ledger entry, `Approved by: <login>`, after the fleet's, so the outbox check into the default branch no longer
//               holds it (BR-PRODUCT-145)
//   overturn    their `overturned` event (BR-PRODUCT-146), and the PRD's rework on the mission branch ({@link reworkLine}):
//               `/omni:yolo-fix <n> --base <branch>`, or `/omni:ultra-yolo-fix <key>-<n> --base-of …` for a product PRD

/** The event a person's Agree is recorded as. */
const AGREED = 'agreed';

/** A PRD a decision names: a repository's number or a product's id (`omni-loop-15`). */
export type DecisionPrd = PrdNumber | ProductPrdId;

/** The name a decision goes by on the mission pull request: `2901/s2-01`, `omni-loop-15/s2-01`; the PRD alone for an approval. */
export const decisionName = (prd: DecisionPrd, item: string | null): string => (item === null ? String(prd) : `${String(prd)}/${item}`);

const NAMED = /^([^/]+)(?:\/([a-z0-9][a-z0-9-]*))?$/;

/** The decision a name stands for, a product PRD's too; null for anything else. */
export function parseDecisionName(text: string): { prd: DecisionPrd; item: string | null } | null {
  const match = NAMED.exec(text);
  const head = match?.[1] ?? '';
  const number = PrdNumberSchema.safeParse(/^[1-9][0-9]*$/.test(head) ? Number(head) : null);
  const product = ProductPrdIdSchema.safeParse(head);
  const prd = number.success ? number.data : product.success ? product.data : null;
  return match === null || prd === null ? null : { prd, item: match[2] ?? null };
}

/** What a person's Agree says in the mission's events: who, and which decision. Read back by {@link deferredOf}. */
export const agreeSentence = (login: string, name: string): string => `${login} agreed with fleet decision ${name}.`;

const AGREE = /^\S+ agreed with fleet decision (\S+?)\.?$/;

/** A decision the mission's committee recorded, as the store reads it (`mission_decisions`). */
export type RecordedDecision = {
  kind: 'approve' | 'answer';
  prd: DecisionPrd;
  item: string | null;
  outcome: 'carried' | 'deferred' | 'escalated';
  why: readonly string[];
  option: string | null;
};

/** A person's answer to a deferred decision: Agree or Overturn, and who gave it. */
export type PersonAnswer = { answer: 'agree' | 'overturn'; by: string };

/** One deferred decision, as the mission pull request lists it. */
export type DeferredDecision = { prd: DecisionPrd; item: string; outcome: 'carried' | 'deferred'; option: string; why: string[]; answer: PersonAnswer | null };

/** How a case of the escalation list starts in a decision's why (apps/omni-app/src/missions/committee.ts). */
const LISTED = 'on the escalation list';

/** Whether an item's decision is one the meeting took instead of a person: deferred, or carried off the escalation list. */
const isDeferred = (row: RecordedDecision): row is RecordedDecision & { item: string; outcome: 'carried' | 'deferred' } =>
  row.kind === 'answer' && row.item !== null && (row.outcome === 'deferred' || (row.outcome === 'carried' && row.why.some((line) => line.startsWith(LISTED))));

/** The person's latest answer to each decision, by its name, from the mission's events (oldest first). */
function answersOf(events: readonly DecisionEvent[]): Map<string, PersonAnswer> {
  const answers = new Map<string, PersonAnswer>();
  for (const event of events) {
    const agreed = event.kind === AGREED ? AGREE.exec(event.sentence)?.[1] : undefined;
    const overturned = event.kind === OVERTURNED ? OVERTURN.exec(event.sentence)?.[1] : undefined;
    const by = event.actor ?? 'a person';
    if (agreed !== undefined) answers.set(agreed, { answer: 'agree', by });
    if (overturned !== undefined) answers.set(overturned, { answer: 'overturn', by });
  }
  return answers;
}

/**
 * The deferred decisions of a mission, in the order they were taken: each item the meeting deferred or carried off the escalation
 * list, with the option it took (A, as built, when none was kept) and the person's latest answer, read from the events.
 */
export function deferredOf(decisions: readonly RecordedDecision[], events: readonly DecisionEvent[]): DeferredDecision[] {
  const answers = answersOf(events);
  return decisions.filter(isDeferred).map((row) => ({
    prd: row.prd,
    item: row.item,
    outcome: row.outcome,
    option: row.option ?? 'A',
    why: [...row.why],
    answer: answers.get(decisionName(row.prd, row.item)) ?? null,
  }));
}

/** Where a rework goes: the mission branch of a repository PRD, or each repository's mission branch for a product PRD. */
export type ReworkBase = { branch: string } | { bases: readonly BaseOfEntry[] };

/** The line that reworks a PRD on the mission branch once a person overturned one of its decisions. */
export function reworkLine(prd: DecisionPrd, base: ReworkBase): string {
  if (isProductPrdId(prd)) {
    const flag = 'bases' in base ? baseOfFlag(base.bases) : '';
    return flag === '' ? `/omni:ultra-yolo-fix ${prd}` : `/omni:ultra-yolo-fix ${prd} ${flag}`;
  }
  return 'branch' in base ? `/omni:yolo-fix ${String(prd)} --base ${base.branch}` : `/omni:yolo-fix ${String(prd)}`;
}

/** The PRDs to rework, each once, in the order their decisions were taken: those with a decision a person overturned. */
export const reworksOf = (deferred: readonly DeferredDecision[]): DecisionPrd[] => [...new Set(deferred.filter((one) => one.answer?.answer === 'overturn').map((one) => one.prd))];

/** The Agree or Overturn link of one decision, by its name: the caller knows where a person answers. */
export type AnswerLinks = (name: string, answer: PersonAnswer['answer']) => string;

const flat = (text: string): string => text.replace(/\s+/g, ' ').trim().replace(/\.$/, '');

/** What the person did with a decision, or the two links while they did nothing. */
function answerWords(one: DeferredDecision, name: string, links: AnswerLinks): string {
  if (one.answer === null) return `[Agree](${links(name, 'agree')}) · [Overturn](${links(name, 'overturn')})`;
  return one.answer.answer === 'agree' ? `Agreed by ${one.answer.by}.` : `Overturned by ${one.answer.by}: the fleet reworks PRD ${String(one.prd)} on the mission branch.`;
}

/** One line of the list: the item, its PRD, carried or deferred with the option taken, why, then the links or the person's answer. */
function deferredLine(one: DeferredDecision, links: AnswerLinks): string {
  const name = decisionName(one.prd, one.item);
  const what = one.outcome === 'carried' ? `carried by the fleet, option ${one.option}` : `deferred, option ${one.option} taken meanwhile`;
  const why = one.why.length === 0 ? 'no why was kept' : one.why.map(flat).join('; ');
  return `- ${one.item} of PRD ${String(one.prd)} · ${what} · ${why}. ${answerWords(one, name, links)}`;
}

/**
 * The **Deferred decisions** section of a mission pull request: every decision the fleet's meeting took instead of a person, with
 * the option taken, its PRD, why it was on the escalation list, and Agree and Overturn. Empty when there is none.
 */
export function deferredLines(deferred: readonly DeferredDecision[], links: AnswerLinks): string[] {
  if (deferred.length === 0) return [];
  return [
    '**Deferred decisions**',
    '',
    'The fleet decided these for you so the mission could carry on. Agree settles one. Overturn records your answer beside it, and the fleet reworks the PRD on the mission branch.',
    '',
    ...deferred.map((one) => deferredLine(one, links)),
    '',
  ];
}
