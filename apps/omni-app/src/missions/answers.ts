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
//
// Bug #3363: a product PRD's high item too, `/omni:committee <key>-<n> --item <id> --bound <b>`, once its build ended on its red
// gate (./supervisor.ts › redGate). Its item lives on the Omni page: the App records the decision for the mission branch only
// (BR-PRODUCT-145), settling nothing, and the PRD's gate into that branch reads it as answered.
import { tally, type MemberVerdict } from 'omni-loop/kit/lib/committee/vote.ts';
import { PrdNumberSchema, ProductPrdIdSchema, type PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import { itemAnswerOf, unanswered, verdictWords, type Decision } from './committee.ts';
import type { MissionPrd } from './store.prd.ts';
import type { Attempt, NewEvent, RecordedEvent } from './supervisor.ts';

/** The option the fleet settles an item with: what was built. */
const BUILT = 'A';

/** `mandate.hardToRevert`'s default (kit/lib/mission/brief.ts): the bound of a mission whose brief names none. */
export const DEFAULT_BOUND = 0.6;

/**
 * An item committee's decision once recorded: carried or escalated, as an approval's; or deferred (PRD omni-loop-21 s8), with the
 * option it takes meanwhile, open for a person on the mission pull request. A deferred item lets its PRD go on, as a carried one does.
 */
export type ItemVerdict = Decision | { outcome: 'deferred'; why: string[]; verdicts?: Decision['verdicts']; option: string };

/**
 * One item committee the mission sent: its PRD (a product PRD's by its id, bug #3363), the item, its job and the job's attempt, its
 * decision once recorded, and when it was sent (bug #3369: the job's `queued_at`), absent when not read.
 */
export type ItemCommittee<P extends MissionPrd = MissionPrd> = { prd: P; item: string; job: string; attempt: Attempt; decision: ItemVerdict | null; sentAt?: string };

/** An item open at a feature pull request's head: its id and its rank, both null for one that does not read. */
export type OpenAt = { id: string | null; rank: string | null };

const LINE = /^\/omni:committee (\S+) --item ([a-z0-9-]+)(?: --bound [0-9.]+)?$/;

/** The line an item's committee is sent as, `bound` the mission's `mandate.hardToRevert`; a product PRD named by its id (bug #3363). */
export const askLine = (prd: MissionPrd, item: string, bound: number): string => `/omni:committee ${String(prd)} --item ${item} --bound ${String(bound)}`;

/** The start every line of an item's committee shares, whatever its bound: how a run finds it sent. */
export const askPrefix = (prd: MissionPrd, item: string): string => `/omni:committee ${String(prd)} --item ${item}`;

/** A line's PRD: a repository PRD's number, or a product PRD's id (bug #3363); null for anything else. */
function linePrd(named: string): MissionPrd | null {
  const number = /^[1-9][0-9]*$/.test(named) ? PrdNumberSchema.safeParse(Number(named)) : null;
  if (number?.success === true) return number.data;
  const product = ProductPrdIdSchema.safeParse(named);
  return product.success ? product.data : null;
}

/** The PRD and item a line names; null for any other line. */
export function itemOfLine(line: string): { prd: MissionPrd; item: string } | null {
  const match = LINE.exec(line);
  const prd = match === null ? null : linePrd(match[1] ?? '');
  return match !== null && prd !== null ? { prd, item: match[2] ?? '' } : null;
}

/** The kinds of event an item committee's decision is recorded as. */
const DECISION_KINDS: ReadonlySet<string> = new Set(['decided', 'deferred', 'escalated']);

/** A decision as its event names it: `decided` carried, `deferred` deferred with option A (PRD omni-loop-21 s8), `escalated` escalated. */
function decisionOfKind(kind: string | undefined): ItemVerdict | null {
  if (kind === 'decided') return { outcome: 'carried', why: [] };
  if (kind === 'deferred') return { outcome: 'deferred', why: [], option: BUILT };
  return kind === 'escalated' ? { outcome: 'escalated', why: [] } : null;
}

/** Each item committee's decision as its events recorded it: carried, deferred or escalated; none while none is. */
export function withDecisions<P extends MissionPrd>(committees: readonly Omit<ItemCommittee<P>, 'decision'>[], recorded: readonly RecordedEvent[]): ItemCommittee<P>[] {
  return committees.map((one) => ({ ...one, decision: decisionOfKind(recorded.find((event) => event.job === one.job && DECISION_KINDS.has(event.kind))?.kind) }));
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
  const found = itemAnswerOf(prd, one, log);
  if (found === null) return unanswered(one.attempt);
  const vote = tally(found.verdicts, found.author);
  if (found.escalations.length > 0) return { verdicts: vote.verdicts, decision: { outcome: 'escalated', why: found.escalations } };
  if (found.option !== BUILT) return { verdicts: vote.verdicts, decision: { outcome: 'escalated', why: [`it was answered with option ${found.option}: the fleet settles an item with option ${BUILT}, as built, only`] } };
  return { verdicts: vote.verdicts, decision: { outcome: vote.outcome, why: vote.why } };
}

/** An item committee's event: a repository PRD's names its number, a product PRD's its id (bug #3363). */
type AskEvent<P extends MissionPrd> = Omit<NewEvent, 'prd'> & { prd: P };

/** The longest event sentence the database keeps. */
const SENTENCE_MAX = 300;

const cut = (text: string): string => (text.length <= SENTENCE_MAX ? text : `${text.slice(0, SENTENCE_MAX - 1)}…`);

/**
 * What each item committee says: its dispatch, signed `supervisor`; then, once recorded, its decision, signed `pm` (the chair) and
 * `agent`: `decided` when the fleet answered the item, `deferred` with the option it took meanwhile, `escalated` with why when it went
 * to a person. A decision read back from the
 * events carries no why: its event is already recorded, and the run records nothing twice.
 */
export function answerEvents<P extends MissionPrd>(committees: readonly ItemCommittee<P>[], where: string): AskEvent<P>[] {
  return committees.flatMap((one): AskEvent<P>[] => {
    const n = `PRD ${String(one.prd)}`;
    const sent: AskEvent<P> = { kind: 'dispatched', role: 'supervisor', prd: one.prd, job: one.job, link: null, sentence: cut(`Sent ${askPrefix(one.prd, one.item)} to ${where}.`) };
    if (one.decision === null) return [sent];
    const words = decidedWords(one.item, n, one.decision);
    return [sent, { role: 'pm', prd: one.prd, job: one.job, link: null, kind: words.kind, sentence: cut(words.sentence) }];
  });
}

/** What a recorded decision says, signed `pm` (the chair): `decided`, `deferred` with the option it took meanwhile (PRD omni-loop-21 s8), or `escalated`. */
function decidedWords(item: string, n: string, decision: ItemVerdict): Pick<NewEvent, 'kind' | 'sentence'> {
  if (decision.outcome === 'carried') return { kind: 'decided', sentence: `The committee answered ${item} of ${n} with option ${BUILT}: ${verdictWords(decision.verdicts) ?? 'every member who sat answered yes'}.` };
  if (decision.outcome === 'deferred') {
    const why = decision.why.join('; ') || 'not every member who sat answered yes';
    return { kind: 'deferred', sentence: `The committee deferred ${item} of ${n}: option ${decision.option} meanwhile, open for a person on the mission pull request (${why}).` };
  }
  return { kind: 'escalated', sentence: `${item} of ${n} goes to a person: ${decision.why.join('; ') || 'the committee sent it to you'}` };
}
