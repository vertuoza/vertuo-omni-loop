// The fleet's committee answers a high outbox item in a mission's run (PRD 2896 s10, spec "6. The committee, at `alone`",
// criterion 14): pure functions over what one run read. No database, no model call: ./job.ts reads, calls these, then writes.
//
//   who it runs for   a PRD of a mission at `alone` whose build ended Waiting on answers: each high item open at its feature
//                     pull request's head is sent to the fleet's committee (`/omni:committee <n> --item <id> --bound <b>`, the
//                     bound the mission's `mandate.hardToRevert`), one job per item, sent once, with no mission key (the
//                     database's key shape holds no item): a run finds it again by its line. A human-action item, and an item
//                     that does not read, wait for a person, no committee sent. No slot of `mandate.parallel` is taken
//   what it decides   the job's answer record (kit/lib/committee/record.ts), read from its log, decided again here with the
//                     kit's own functions: escalated by rule when the list named anything, an option other than A, else every
//                     member who sat must answer yes. A job that failed, or left no record, escalates with each member failed
//   after             carried, the App settles the item on the feature branch, `answered by fleet <key>` (./settle.ts): the
//                     merge gate into the mission branch then reads it as answered; a pull request into the default branch
//                     still holds it (BR-PRODUCT-5). Escalated, the item waits for a person, why attached. Once no high or
//                     human-action item is open, the PRD's run is sent again: its gate is green, so it ships and goes to the
//                     Reviewer as any build does
//   the record        what a decision was is its event: `decided` once settled, `escalated` otherwise, signed `pm` (the chair)
//                     and `agent`, never in a person's name, keyed by the job so it is recorded once
import { answerOf } from 'omni-loop/kit/lib/committee/record.ts';
import { tally, type MemberVerdict } from 'omni-loop/kit/lib/committee/vote.ts';
import { PrdNumberSchema, type PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import { noRecord, verdictWords, type Decision } from './committee.ts';
import type { Attempt, NewEvent, RecordedEvent } from './supervisor.ts';

/** The option the fleet settles an item with: what was built. */
const BUILT = 'A';

/** `mandate.hardToRevert`'s default (kit/lib/mission/brief.ts): the bound of a mission whose brief names none. */
export const DEFAULT_BOUND = 0.6;

/** One item committee the mission sent: its PRD, the item, its job and the job's attempt, and its decision once recorded. */
export type ItemCommittee = { prd: PrdNumber; item: string; job: string; attempt: Attempt; decision: Decision | null };

/** An item open at a feature pull request's head: its id and its rank, both null for one that does not read. */
export type OpenAt = { id: string | null; rank: string | null };

const LINE = /^\/omni:committee ([1-9][0-9]*) --item ([a-z0-9-]+)(?: --bound [0-9.]+)?$/;

/** The line an item's committee is sent as, `bound` the mission's `mandate.hardToRevert`. */
export const askLine = (prd: PrdNumber, item: string, bound: number): string => `/omni:committee ${String(prd)} --item ${item} --bound ${String(bound)}`;

/** The start every line of an item's committee shares, whatever its bound: how a run finds it sent. */
export const askPrefix = (prd: PrdNumber, item: string): string => `/omni:committee ${String(prd)} --item ${item}`;

/** The PRD and item a line names; null for any other line. */
export function itemOfLine(line: string): { prd: PrdNumber; item: string } | null {
  const match = LINE.exec(line);
  const prd = PrdNumberSchema.safeParse(Number(match?.[1]));
  return match && prd.success ? { prd: prd.data, item: match[2] ?? '' } : null;
}

/** Each item committee's decision as its events recorded it: `decided` carried, `escalated` escalated; none while neither is. */
export function withDecisions(committees: readonly Omit<ItemCommittee, 'decision'>[], recorded: readonly RecordedEvent[]): ItemCommittee[] {
  return committees.map((one) => {
    const kind = recorded.find((event) => event.job === one.job && (event.kind === 'decided' || event.kind === 'escalated'))?.kind;
    const decision: Decision | null = kind === 'decided' ? { outcome: 'carried', why: [] } : kind === 'escalated' ? { outcome: 'escalated', why: [] } : null;
    return { ...one, decision };
  });
}

/** What a PRD's open items come to at `alone`: the items to send to the committee, whether one is being decided, and why a person is needed. */
export type AnswersNext = { send: string[]; deciding: boolean; person: string[] };

/** The latest committee of `item`, by the order the run read them in. */
const latestOf = (committees: readonly ItemCommittee[], item: string): ItemCommittee | undefined => committees.filter((one) => one.item === item).at(-1);

/** What each open item of a PRD waits on: its committee to send, its committee at work, or a person, why attached. */
export function answersNext(open: readonly OpenAt[], committees: readonly ItemCommittee[]): AnswersNext {
  const next: AnswersNext = { send: [], deciding: false, person: [] };
  for (const { id, rank } of open) {
    if (id === null || rank === null) next.person.push('an item of its outbox does not read');
    else if (rank === 'human-action') next.person.push(`${id} is a human-action item: only a person can act on it`);
    else if (rank === 'high') {
      const latest = latestOf(committees, id);
      if (latest === undefined) next.send.push(id);
      else if (latest.decision?.outcome === 'escalated') next.person.push(`the committee sent ${id} to you`);
      // At work, or carried and not yet settled at the head the run read: decided either way.
      else next.deciding = true;
    }
  }
  return next;
}

/** Whether a PRD's items hold it: any high or human-action item, or one that does not read, is open. */
export const itemsOpen = (open: readonly OpenAt[]): boolean => open.some(({ rank }) => rank === null || rank === 'high' || rank === 'human-action');

/**
 * The decision on item committee `one` of PRD `prd`, from its job's log `log`: the answer record decided again (by rule when it
 * names a reason, an option other than A escalated, else by vote), never its own word on the outcome. A job that failed, or whose
 * log holds no answer record for the item, escalates. `verdicts` are the members' as recorded.
 */
export function answeredOf(prd: PrdNumber, one: ItemCommittee, log: string | null): { verdicts: MemberVerdict[]; decision: Decision } {
  const found = one.attempt.status === 'done' && log !== null ? answerOf(log, prd, one.item) : null;
  if (found === null) {
    const vote = noRecord(one.attempt);
    return { verdicts: vote.verdicts, decision: { outcome: 'escalated', why: vote.why } };
  }
  const vote = tally(found.verdicts, found.author);
  if (found.escalations.length > 0) return { verdicts: vote.verdicts, decision: { outcome: 'escalated', why: found.escalations } };
  if (found.option !== BUILT) return { verdicts: vote.verdicts, decision: { outcome: 'escalated', why: [`it was answered with option ${found.option}: the fleet settles an item with option ${BUILT}, as built, only`] } };
  return { verdicts: vote.verdicts, decision: { outcome: vote.outcome, why: vote.why } };
}

/** The longest event sentence the database keeps. */
const SENTENCE_MAX = 300;

const cut = (text: string): string => (text.length <= SENTENCE_MAX ? text : `${text.slice(0, SENTENCE_MAX - 1)}…`);

/**
 * What each item committee says: its dispatch, signed `supervisor`; then, once recorded, its decision, signed `pm` (the chair) and
 * `agent`: `decided` when the fleet answered the item, `escalated` with why when it went to a person. A decision read back from the
 * events carries no why: its event is already recorded, and the run records nothing twice.
 */
export function answerEvents(committees: readonly ItemCommittee[], where: string): NewEvent[] {
  return committees.flatMap((one) => {
    const n = `PRD ${String(one.prd)}`;
    const sent: NewEvent = { kind: 'dispatched', role: 'supervisor', prd: one.prd, job: one.job, link: null, sentence: cut(`Sent ${askPrefix(one.prd, one.item)} to ${where}.`) };
    if (one.decision === null) return [sent];
    const decided: NewEvent =
      one.decision.outcome === 'carried'
        ? { kind: 'decided', role: 'pm', prd: one.prd, job: one.job, link: null, sentence: cut(`The committee answered ${one.item} of ${n} with option ${BUILT}: ${verdictWords(one.decision.verdicts) ?? 'every member who sat answered yes'}.`) }
        : { kind: 'escalated', role: 'pm', prd: one.prd, job: one.job, link: null, sentence: cut(`${one.item} of ${n} goes to a person: ${one.decision.why.join('; ') || 'the committee sent it to you'}`) };
    return [sent, decided];
  });
}
