// The fleet's committee in a mission's run (PRD 2896 s9, spec "6. The committee, at `alone`"): pure functions over what one
// run read. No database, no model call: ./job.ts reads, calls these, then writes.
//
//   who it runs for   a PRD of a mission at `alone` whose approval is not standing (none yet, or voided by a push): instead of
//                     waiting for a person to approve it, the mission sends `/omni:committee <n> --approve` to its fleet, under
//                     `mission:<id>:prd:<n>:approve:<k>`, its k-th committee. It takes no slot of `mandate.parallel`: no code runs
//   what it decides   the job's record line (kit/lib/committee/record.ts), read from its log, decided again here with the
//                     kit's own functions: escalated by rule when the list named anything, else every member who sits must
//                     answer yes. A job that failed, or left no record, escalates with each member counted `failed`. The
//                     database decides last (mission_decide_approval(): a phase-0 PRD, a red business law, a file changed since)
//   after             carried, the PRD's approval stands for this mission and it is built; escalated, it waits for a person to
//                     approve it on its page, why attached. A carried approval a push voided sends the committee again, three
//                     times at most; then a person approves it
//   the events        each committee's dispatch, signed `supervisor`; its decision, `decided` or `escalated`, signed `pm` (the
//                     chair) and `agent`, never in a person's name
import { committeeOf, type CommitteeRecord } from 'omni-loop/kit/lib/committee/record.ts';
import { COMMITTEE_ROLES, tally, type CommitteeRole, type MemberVerdict } from 'omni-loop/kit/lib/committee/vote.ts';
import { PrdNumberSchema, type PrdNumber } from 'omni-loop/kit/lib/ids.ts';
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
export function noRecord(attempt: Pick<Attempt, 'status'>): { verdicts: MemberVerdict[]; why: string[] } {
  const sentence = attempt.status === 'done' ? 'Its job ended with no record of the vote.' : `Its job ${attempt.status === 'cancelled' ? 'was cancelled' : 'failed'}.`;
  const vote = tally(failedAll(sentence), null);
  return { verdicts: vote.verdicts, why: vote.why };
}

/** What the App records for an ended committee job: the record its log holds, and the decision taken again from it. */
export type Recorded = { record: Pick<CommitteeRecord, 'author' | 'read' | 'verdicts'>; decision: Decision };

/**
 * The decision on committee `one` of PRD `prd`, from its job's log `log`: the record decided again (by rule when it names a
 * reason, else by vote), never its own word on the outcome. A job that failed, or whose log holds no record, escalates. `author` the
 * hero the App knows wrote the PRD (PRD 2896 s12: the PM, for a PRD its fleet added), who sits out whatever the record says.
 */
export function recordedOf(prd: PrdNumber, one: Committee, log: string | null, author: CommitteeRole | null = null): Recorded {
  const found = one.attempt.status === 'done' && log !== null ? committeeOf(log, prd) : null;
  if (found === null) {
    const vote = noRecord(one.attempt);
    return { record: { author: null, read: [], verdicts: vote.verdicts }, decision: { outcome: 'escalated', why: vote.why } };
  }
  const vote = found.escalations.length > 0 ? { outcome: 'escalated' as const, why: found.escalations, verdicts: found.verdicts } : tally(found.verdicts, author ?? found.author);
  return { record: { author: author ?? found.author, read: found.read, verdicts: vote.verdicts }, decision: { outcome: vote.outcome, why: vote.why } };
}
