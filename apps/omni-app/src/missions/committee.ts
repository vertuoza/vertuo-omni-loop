// The fleet's committee in a mission's run (PRD 2896 s9, spec "6. The committee, at `alone`"): pure functions over what one
// run read. No database, no model call: ./job.ts reads, calls these, then writes.
//
//   who it runs for   a PRD of a mission at `alone` whose approval is not standing (none yet, or voided by a push): instead of
//                     waiting for a person to approve it, the mission sends `/omni:committee <n> --approve` to its fleet, under
//                     `mission:<id>:prd:<n>:approve:<k>`, its k-th committee. It takes no slot of `mandate.parallel`: no code runs
//   what it decides   the job's record line (kit/lib/committee/record.ts), read from its log, decided again here with the
//                     kit's own functions: escalated by rule for a case only a person decides, else every member who sits must
//                     answer yes. A job that failed, or left no record, escalates with each member counted `failed`. The
//                     database decides last (mission_decide_approval(): a phase-0 PRD, a red business law, a file changed since)
//   after             carried, the PRD's approval stands for this mission and it is built; escalated, it waits for a person to
//                     approve it on its page, why attached. A carried approval a push voided sends the committee again, three
//                     times at most; then a person approves it
//   the events        each committee's dispatch, signed `supervisor`; its decision, `decided` or `escalated`, signed `pm` (the
//                     chair) and `agent`, never in a person's name
//
// PRD omni-loop-21 s8, spec "4. The fleet's meeting decides, and defers to the end": a case of the escalation list no longer
// sends a PRD or an item to a person mid-mission. It goes to the members ({@link routedOf}): every sitting yes carries it
// (`on the escalation list`); any other vote defers an item with option A, the most reversible ({@link itemDecisionOf}), and
// the mission goes on, the decision open for a person on the mission pull request. A PRD the vote did not carry still goes to
// a person (a PRD is never approved without every sitting yes), and so does a PRD approved by its phase-0 pull request, which
// only a person merges (N-PRODUCT-15). A carried or deferred item is decided with its why, never an empty one.
import { routes } from 'omni-loop/kit/lib/committee/escalation.ts';
import { answerOf, committeeOf, type CommitteeRecord } from 'omni-loop/kit/lib/committee/record.ts';
import { COMMITTEE_ROLES, tally, type CommitteeRole, type MemberVerdict } from 'omni-loop/kit/lib/committee/vote.ts';
import { PrdNumberSchema, type PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import type { MissionPrd } from './store.prd.ts';
import type { Approval, Attempt, MissionStatus } from './supervisor.ts';

/** The most committees a PRD is sent for its approval: a third carried approval a push voided waits for a person. */
const COMMITTEE_ROUNDS = 3;

/** What a committee's job came to, once the App recorded it: its outcome and why, one line each. */
export type Decision = { outcome: 'carried' | 'escalated'; why: string[]; verdicts?: readonly { role: string; answer: string }[] };

/** The verdicts as the mission's events say them, `pm yes, architect yes, reviewer yes`; null when none were kept. */
export const verdictWords = (verdicts: Decision['verdicts']): string | null =>
  verdicts === undefined || verdicts.length === 0 ? null : verdicts.map(({ role, answer }) => `${role} ${answer}`).join(', ');

/** One committee the mission sent for a PRD: its round, its job, the job's attempt, and the decision recorded for it, if any. */
export type Committee = { prd: PrdNumber; round: number; job: string; attempt: Attempt; decision: Decision | null };

/** Where a PRD's approval stands at `alone`: standing (it builds), its committee to send, its committee at work, or a person's. */
export type ApprovalNext =
  | { next: 'standing' }
  | { next: 'send'; round: number }
  | { next: 'deciding'; round: number }
  | { next: 'person'; why: string | null };

const KEY = /^mission:([0-9a-f-]{36}):prd:([1-9][0-9]*):approve:([1-9][0-9]*)$/;

/** The key of the k-th committee of PRD `prd` in mission `mission`: never sent twice. */
export const committeeKey = (mission: string, prd: PrdNumber, round: number): string => `mission:${mission}:prd:${String(prd)}:approve:${String(round)}`;

/** The PRD and round a committee's key names; null for any other key. */
export function committeeOfKey(key: string): { prd: PrdNumber; round: number } | null {
  const match = KEY.exec(key);
  const prd = PrdNumberSchema.safeParse(Number(match?.[2]));
  return match && prd.success ? { prd: prd.data, round: Number(match[3]) } : null;
}

/**
 * The line a committee is sent as: with `--author pm` for a PRD the mission's PM wrote (PRD 2896 s12), whose committee the PM sits
 * out, the Architect and the Reviewer approving it.
 */
export const approveLine = (prd: PrdNumber, author: CommitteeRole | null = null): string =>
  `/omni:committee ${String(prd)} --approve${author === null ? '' : ` --author ${author}`}`;

/** Whether the job is still to end: queued, claimed or running. */
const working = ({ status }: Attempt): boolean => status === 'queued' || status === 'claimed' || status === 'running';

/**
 * Where PRD `prd`'s approval stands, its approval `approval` as the run read it, at a mission whose level is `alone` when `alone`:
 * below it, a PRD not standing waits for a person, as before this PRD.
 */
export function approvalNext(approval: Approval, committees: readonly Committee[], alone: boolean): ApprovalNext {
  if (approval === 'standing') return { next: 'standing' };
  if (!alone) return { next: 'person', why: null };
  // A person overturned the fleet's approval (PRD 2896 s11): the committee does not judge it again, a person approves it.
  if (approval === 'overturned') return { next: 'person', why: 'you overturned the fleet\'s approval' };
  const latest = committees.reduce<Committee | null>((last, one) => (last === null || one.round > last.round ? one : last), null);
  if (latest === null) return { next: 'send', round: 1 };
  if (working(latest.attempt) || latest.decision === null) return { next: 'deciding', round: latest.round };
  if (latest.decision.outcome === 'escalated') return { next: 'person', why: `the committee sent it to you: ${latest.decision.why.join('; ')}` };
  // Carried, and no longer standing: a push voided the fleet's approval.
  if (latest.round >= COMMITTEE_ROUNDS) return { next: 'person', why: `the fleet's approval was voided ${String(COMMITTEE_ROUNDS)} times` };
  return { next: 'send', round: latest.round + 1 };
}

/** Whether the run sends committees: while the mission runs or waits. */
export const sendsCommittees = (status: MissionStatus): boolean => status === 'running' || status === 'waiting';

const failedAll = (sentence: string): MemberVerdict[] => COMMITTEE_ROLES.map((role) => ({ role, answer: 'failed', sentence }));

/** The vote of a committee job that failed, was cancelled, or ended with no record: every member counted failed, why each. */
function noRecord(attempt: Pick<Attempt, 'status'>): { verdicts: MemberVerdict[]; why: string[] } {
  const sentence = attempt.status === 'done' ? 'Its job ended with no record of the vote.' : `Its job ${attempt.status === 'cancelled' ? 'was cancelled' : 'failed'}.`;
  const vote = tally(failedAll(sentence), null);
  return { verdicts: vote.verdicts, why: vote.why };
}

/** Item committee `one`'s answer record in its job's log `log`; null when its job did not end done or its log holds none. */
export function itemAnswerOf(prd: MissionPrd, one: { item: string; attempt: Pick<Attempt, 'status'> }, log: string | null): ReturnType<typeof answerOf> {
  return one.attempt.status === 'done' && log !== null ? answerOf(log, prd, one.item) : null;
}

/** An item committee whose job left no answer record: escalated, every member counted failed ({@link noRecord}). */
export function unanswered(attempt: Pick<Attempt, 'status'>): { verdicts: MemberVerdict[]; decision: { outcome: 'escalated'; why: string[] } } {
  const vote = noRecord(attempt);
  return { verdicts: vote.verdicts, decision: { outcome: 'escalated', why: vote.why } };
}

/** How the escalation list's lines read, before each case it was on (kit/lib/committee/escalation.ts). */
const ON_THE_LIST = 'on the escalation list';

/**
 * The cases only a person decides, whatever the members answer: those the kit routes `to a person`, read from the kit's own
 * routing so the App never words them itself. Today one: a PRD approved by its phase-0 pull request (N-PRODUCT-15).
 */
const PERSON_CASES: ReadonlySet<string> = new Set(
  routes({ kind: 'approve', phase0: 'pr', lockedLaws: [], legal: [], redBusinessLaws: [], dataMigrations: [] })
    .filter((route) => route.to === 'to a person')
    .map((route) => route.case),
);

/** A record's escalation-list cases, routed (PRD omni-loop-21 s8): those only a person decides, and the members' own, each as its why says it. */
export function routedOf(escalations: readonly string[]): { person: string[]; listed: string[] } {
  return {
    person: escalations.filter((line) => PERSON_CASES.has(line)),
    listed: escalations.filter((line) => !PERSON_CASES.has(line)).map((line) => `${ON_THE_LIST}: ${line}`),
  };
}

/** What the App records for an ended committee job: the record its log holds, and the decision taken again from it. */
export type Recorded = { record: Pick<CommitteeRecord, 'author' | 'read' | 'verdicts'>; decision: Decision };

/**
 * The decision on committee `one` of PRD `prd`, from its job's log `log`: the record decided again, never its own word on the
 * outcome. A case only a person decides escalates by rule; every other case of the escalation list goes to the members (PRD
 * omni-loop-21 s8): every sitting yes carries the PRD, any other vote sends it to a person, each case it was on in its why. A
 * carried approval is sent with no why: mission_decide_approval() refuses one. A job that failed, or whose log holds no record,
 * escalates. `author` the hero the App knows wrote the PRD (PRD 2896 s12: the PM, for a PRD its fleet added), who sits out
 * whatever the record says.
 */
export function recordedOf(prd: PrdNumber, one: Committee, log: string | null, author: CommitteeRole | null = null): Recorded {
  const found = one.attempt.status === 'done' && log !== null ? committeeOf(log, prd) : null;
  if (found === null) {
    const vote = noRecord(one.attempt);
    return { record: { author: null, read: [], verdicts: vote.verdicts }, decision: { outcome: 'escalated', why: vote.why } };
  }
  const { person, listed } = routedOf(found.escalations);
  const vote = person.length > 0 ? { outcome: 'escalated' as const, why: person, verdicts: found.verdicts } : tally(found.verdicts, author ?? found.author);
  const why = vote.outcome === 'carried' ? [] : person.length > 0 ? vote.why : [...listed, ...vote.why];
  return { record: { author: author ?? found.author, read: found.read, verdicts: vote.verdicts }, decision: { outcome: vote.outcome, why } };
}

/** The option the fleet settles an item with: A, what was built, the most reversible (`/omni:do-work`, step 3). */
const BUILT = 'A';

/** An item committee's decision (PRD omni-loop-21 s8), as mission_decide_item() keeps it: its outcome, its why, the option a deferred item takes. */
export type ItemDecided = { outcome: 'carried' | 'deferred' | 'escalated'; why: string[]; option: typeof BUILT | null };

/** Why the members carried an item off the list, in words: what it is sent with, never an empty why. */
const allYes = (verdicts: readonly MemberVerdict[]): string => `every member who sat answered yes: ${verdictWords(verdicts) ?? 'none sat'}`;

/**
 * The decision on item `item` of PRD `prd` (PRD omni-loop-21 s8, AC-5), from its committee job's attempt and log: the answer record
 * decided again, never its own word on the outcome.
 *
 *   escalated   the job failed or left no answer record for the item (each member counted failed), the record answers it with
 *               an option other than A, or one of its cases is a person's alone
 *   carried     every sitting member answered yes; its why each case of the escalation list it was on (`on the escalation list:
 *               …`), or, off the list, the members' yes
 *   deferred    any other vote: option A, as built, the most reversible, taken meanwhile; its why the cases it was on, then each
 *               verdict that was not yes
 *
 * Carried and deferred both let the PRD go on ({@link goesOn}): the item is answered for the mission branch only, and a person
 * answers it on the mission pull request (BR-PRODUCT-145). Its why is never empty.
 */
export function itemDecisionOf(prd: MissionPrd, one: { item: string; attempt: Pick<Attempt, 'status'> }, log: string | null): { verdicts: MemberVerdict[]; decision: ItemDecided } {
  const found = itemAnswerOf(prd, one, log);
  if (found === null) {
    const none = unanswered(one.attempt);
    return { verdicts: none.verdicts, decision: { ...none.decision, option: null } };
  }
  const vote = tally(found.verdicts, found.author);
  const { person, listed } = routedOf(found.escalations);
  if (person.length > 0) return { verdicts: vote.verdicts, decision: { outcome: 'escalated', why: person, option: null } };
  if (found.option !== BUILT) {
    const why = `it was answered with option ${found.option}: the fleet settles an item with option ${BUILT}, as built, only`;
    return { verdicts: vote.verdicts, decision: { outcome: 'escalated', why: [why], option: null } };
  }
  if (vote.outcome === 'carried') return { verdicts: vote.verdicts, decision: { outcome: 'carried', why: listed.length > 0 ? listed : [allYes(vote.verdicts)], option: null } };
  return { verdicts: vote.verdicts, decision: { outcome: 'deferred', why: [...listed, ...vote.why], option: BUILT } };
}

/** Whether an item's decision lets its PRD go on to join the mission branch: carried or deferred, never escalated. */
export const goesOn = (decision: Pick<ItemDecided, 'outcome'>): boolean => decision.outcome !== 'escalated';
